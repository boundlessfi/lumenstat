import type pg from 'pg';
import { BUCKET_COUNT, percentile } from './histogram.ts';
import type { MinuteRow } from './ingest.ts';
import { generateKey, hashKey } from './keys.ts';

export type ReadScope = { scope: 'operator' } | { scope: 'tenant'; tenantId: string };

export interface RouteStat {
  service: string;
  method: string;
  route: string;
  requests: number;
  status: { '2xx': number; '3xx': number; '4xx': number; '5xx': number; other: number };
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
}

export interface TenantStat {
  tenantId: string;
  name: string;
  status: string;
  services: number;
  routes: number;
  requests: number;
  errorRate: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
}

const UPSERT_CHUNK = 500;
const KEY_CACHE_MS = 60_000;

function toBuckets(value: unknown): number[] {
  const list = Array.isArray(value) ? value.map(Number) : [];
  return list.length === BUCKET_COUNT ? list : new Array(BUCKET_COUNT).fill(0);
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export class Store {
  readonly pool: pg.Pool;
  private readonly keyCache = new Map<string, { tenantId: string | null; at: number }>();

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  /** Maps plaintext ingest keys to active tenants. Unknown or revoked keys are left out. */
  async tenantsForKeys(keys: readonly string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const now = Date.now();
    const missing: string[] = [];

    for (const key of new Set(keys)) {
      const cached = this.keyCache.get(key);
      if (cached && now - cached.at < KEY_CACHE_MS) {
        if (cached.tenantId) result.set(key, cached.tenantId);
      } else {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      const hashes = missing.map(hashKey);
      const { rows } = await this.pool.query<{ key_hash: string; tenant_id: string }>(
        `select k.key_hash, k.tenant_id
           from scf_api.ingest_key k join scf_api.tenant t using (tenant_id)
          where k.key_hash = any($1) and k.revoked_at is null and t.status = 'active'`,
        [hashes],
      );
      const byHash = new Map(rows.map(r => [r.key_hash, r.tenant_id]));
      missing.forEach((key, i) => {
        const tenantId = byHash.get(hashes.at(i) ?? '') ?? null;
        this.keyCache.set(key, { tenantId, at: now });
        if (tenantId) result.set(key, tenantId);
      });
    }

    return result;
  }

  async knownRoutes(tenantId: string, serviceName: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ route: string }>(
      `select distinct route from scf_api.api_metric_minute
        where tenant_id = $1 and service_name = $2 and bucket_start > now() - interval '30 days'`,
      [tenantId, serviceName],
    );
    return rows.map(r => r.route);
  }

  async upsert(rows: readonly MinuteRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
      const chunk = rows.slice(start, start + UPSERT_CHUNK);
      const params: unknown[] = [];
      const values = chunk.map(row => {
        const base = params.length;
        params.push(
          row.tenantId,
          row.serviceName,
          row.route,
          row.method,
          row.statusCode,
          row.source,
          row.bucketStart,
          row.requestCount,
          row.durationSumMs,
          row.bucketCounts,
        );
        const p = (n: number) => `$${base + n}`;
        return `(${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)}, ${p(9)}, ${p(10)}::bigint[])`;
      });

      await this.pool.query(
        `insert into scf_api.api_metric_minute
           (tenant_id, service_name, route, method, status_code, source, bucket_start,
            request_count, duration_sum_ms, bucket_counts)
         values ${values.join(', ')}
         on conflict (tenant_id, service_name, route, method, status_code, source, bucket_start)
         do update set
           request_count   = scf_api.api_metric_minute.request_count + excluded.request_count,
           duration_sum_ms = scf_api.api_metric_minute.duration_sum_ms + excluded.duration_sum_ms,
           bucket_counts   = scf_api.array_add(scf_api.api_metric_minute.bucket_counts, excluded.bucket_counts)`,
        params,
      );
    }
  }

  async createTenant(name: string): Promise<{ tenantId: string; ingestKey: string }> {
    const { rows } = await this.pool.query<{ tenant_id: string }>(
      'insert into scf_api.tenant (name) values ($1) returning tenant_id',
      [name],
    );
    const tenantId = rows[0]?.tenant_id;
    if (!tenantId) throw new Error('tenant insert returned no id');
    const ingestKey = generateKey('scf_ingest');
    await this.pool.query('insert into scf_api.ingest_key (key_hash, tenant_id, label) values ($1, $2, $3)', [
      hashKey(ingestKey),
      tenantId,
      'default',
    ]);
    return { tenantId, ingestKey };
  }

  async createApiKey(label: string, tenantId: string | null, expiresAt: Date | null): Promise<{ apiKeyId: string; key: string }> {
    const key = generateKey('scf_read');
    const { rows } = await this.pool.query<{ api_key_id: string }>(
      `insert into scf_api.api_key (key_hash, tenant_id, label, expires_at) values ($1, $2, $3, $4) returning api_key_id`,
      [hashKey(key), tenantId, label, expiresAt],
    );
    const apiKeyId = rows[0]?.api_key_id;
    if (!apiKeyId) throw new Error('api key insert returned no id');
    return { apiKeyId, key };
  }

  async revokeApiKey(apiKeyId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'update scf_api.api_key set revoked_at = now() where api_key_id = $1 and revoked_at is null',
      [apiKeyId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Resolves a metrics API read key to its scope, and records its use. */
  async authenticateReadKey(key: string): Promise<ReadScope | null> {
    const { rows } = await this.pool.query<{ tenant_id: string | null }>(
      `update scf_api.api_key set last_used_at = now()
        where key_hash = $1 and revoked_at is null and (expires_at is null or expires_at > now())
        returning tenant_id`,
      [hashKey(key)],
    );
    const row = rows[0];
    if (!row) return null;
    return row.tenant_id ? { scope: 'tenant', tenantId: row.tenant_id } : { scope: 'operator' };
  }

  async tenantStats(from: Date, to: Date, onlyTenantId: string | null): Promise<TenantStat[]> {
    const { rows } = await this.pool.query(
      `with scoped as (
         select * from scf_api.api_metric_minute
          where bucket_start >= $1 and bucket_start < $2 and ($3::uuid is null or tenant_id = $3)
       ),
       pref as (
         select tenant_id, service_name, bool_or(source = 'metrics') as has_metrics
           from scoped group by tenant_id, service_name
       ),
       chosen as (
         select s.* from scoped s join pref p using (tenant_id, service_name)
          where s.source = case when p.has_metrics then 'metrics' else 'spans' end
       )
       select t.tenant_id, t.name, t.status,
              count(distinct c.service_name)::int as services,
              count(distinct (c.service_name, c.route))::int as routes,
              coalesce(sum(c.request_count), 0)::bigint as requests,
              coalesce(sum(c.request_count) filter (where c.status_code >= 500), 0)::bigint as errors,
              scf_api.array_sum(c.bucket_counts) as bucket_counts
         from scf_api.tenant t left join chosen c on c.tenant_id = t.tenant_id
        where ($3::uuid is null or t.tenant_id = $3)
        group by t.tenant_id, t.name, t.status
        order by requests desc, t.name`,
      [from, to, onlyTenantId],
    );

    return rows.map(r => {
      const requests = Number(r.requests);
      const buckets = toBuckets(r.bucket_counts);
      return {
        tenantId: r.tenant_id,
        name: r.name,
        status: r.status,
        services: r.services,
        routes: r.routes,
        requests,
        errorRate: requests > 0 ? Number(r.errors) / requests : null,
        p50Ms: round(percentile(buckets, 0.5)),
        p95Ms: round(percentile(buckets, 0.95)),
      };
    });
  }

  async routeStats(tenantId: string, from: Date, to: Date): Promise<RouteStat[]> {
    const { rows } = await this.pool.query(
      `with scoped as (
         select * from scf_api.api_metric_minute
          where tenant_id = $1 and bucket_start >= $2 and bucket_start < $3
       ),
       pref as (
         select service_name, bool_or(source = 'metrics') as has_metrics from scoped group by service_name
       )
       select s.service_name, s.method, s.route,
              sum(s.request_count)::bigint as requests,
              coalesce(sum(s.request_count) filter (where s.status_code between 200 and 299), 0)::bigint as s2xx,
              coalesce(sum(s.request_count) filter (where s.status_code between 300 and 399), 0)::bigint as s3xx,
              coalesce(sum(s.request_count) filter (where s.status_code between 400 and 499), 0)::bigint as s4xx,
              coalesce(sum(s.request_count) filter (where s.status_code between 500 and 599), 0)::bigint as s5xx,
              sum(s.duration_sum_ms) as duration_sum_ms,
              scf_api.array_sum(s.bucket_counts) as bucket_counts
         from scoped s join pref p using (service_name)
        where s.source = case when p.has_metrics then 'metrics' else 'spans' end
        group by s.service_name, s.method, s.route
        order by requests desc
        limit 500`,
      [tenantId, from, to],
    );

    return rows.map(r => {
      const requests = Number(r.requests);
      const buckets = toBuckets(r.bucket_counts);
      const known = Number(r.s2xx) + Number(r.s3xx) + Number(r.s4xx) + Number(r.s5xx);
      return {
        service: r.service_name,
        method: r.method,
        route: r.route,
        requests,
        status: {
          '2xx': Number(r.s2xx),
          '3xx': Number(r.s3xx),
          '4xx': Number(r.s4xx),
          '5xx': Number(r.s5xx),
          other: requests - known,
        },
        avgMs: requests > 0 ? round(Number(r.duration_sum_ms) / requests) : null,
        p50Ms: round(percentile(buckets, 0.5)),
        p95Ms: round(percentile(buckets, 0.95)),
        p99Ms: round(percentile(buckets, 0.99)),
      };
    });
  }

  async tenantExists(tenantId: string): Promise<{ tenantId: string; name: string; status: string } | null> {
    const { rows } = await this.pool.query('select tenant_id, name, status from scf_api.tenant where tenant_id = $1', [tenantId]);
    const row = rows[0];
    return row ? { tenantId: row.tenant_id, name: row.name, status: row.status } : null;
  }
}
