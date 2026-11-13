import { addBuckets, rebucket } from './histogram.ts';
import { resolveRoute } from './normalize.ts';
import type { HistogramPoint } from './otlp.ts';

export type Source = 'metrics' | 'spans';

/** One row of `scf_api.api_metric_minute`. Only these fields ever reach storage. */
export interface MinuteRow {
  tenantId: string;
  serviceName: string;
  route: string;
  method: string;
  statusCode: number;
  source: Source;
  bucketStart: Date;
  requestCount: number;
  durationSumMs: number;
  bucketCounts: number[];
}

export type DropReason =
  | 'unknown_metric'
  | 'unknown_ingest_key'
  | 'not_server_span'
  | 'not_delta'
  | 'empty';

interface AcceptedMetric {
  source: Source;
  defaultUnit: string;
}

/** HTTP server latency histograms we accept. Everything else is dropped. */
export const ACCEPTED_METRICS: Readonly<Record<string, AcceptedMetric>> = {
  'http.server.request.duration': { source: 'metrics', defaultUnit: 's' },
  'http.server.duration': { source: 'metrics', defaultUnit: 'ms' },
  'traces.span.metrics.duration': { source: 'spans', defaultUnit: 'ms' },
};

const MS_PER_UNIT: Readonly<Record<string, number>> = { s: 1000, ms: 1, us: 0.001, ns: 0.000001 };

function msFactor(unit: string, fallback: string): number {
  return MS_PER_UNIT[unit] ?? MS_PER_UNIT[fallback] ?? 1;
}

function readMethod(attrs: HistogramPoint['attrs']): string {
  const raw = attrs['http.request.method'] ?? attrs['http.method'];
  return typeof raw === 'string' && raw !== '' ? raw.toUpperCase().slice(0, 16) : '_OTHER';
}

function readStatus(attrs: HistogramPoint['attrs']): number {
  const raw = Number(attrs['http.response.status_code'] ?? attrs['http.status_code'] ?? 0);
  return Number.isInteger(raw) && raw >= 0 && raw < 1000 ? raw : 0;
}

function minuteStart(timeUnixNano: bigint): Date {
  const minutes = timeUnixNano / 60_000_000_000n;
  return new Date(Number(minutes) * 60_000);
}

function rowKey(row: MinuteRow): string {
  return [row.tenantId, row.serviceName, row.route, row.method, row.statusCode, row.source, row.bucketStart.toISOString()].join('\u0000');
}

/**
 * Turns histogram points into storage rows. Tenant identity comes only from the
 * ingest key the collector attached, mapped through `tenantsByKey`; nothing in the
 * payload can choose a tenant.
 */
export function toRows(
  points: readonly HistogramPoint[],
  tenantsByKey: ReadonlyMap<string, string>,
): { rows: MinuteRow[]; dropped: Partial<Record<DropReason, number>> } {
  const rows: MinuteRow[] = [];
  const dropped: Partial<Record<DropReason, number>> = {};
  const drop = (reason: DropReason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };

  for (const point of points) {
    const accepted = ACCEPTED_METRICS[point.metricName];
    if (!accepted) {
      drop('unknown_metric');
      continue;
    }

    const tenantId = point.ingestKey ? tenantsByKey.get(point.ingestKey) : undefined;
    if (!tenantId) {
      drop('unknown_ingest_key');
      continue;
    }

    if (accepted.source === 'spans' && point.attrs['span.kind'] !== 'SPAN_KIND_SERVER') {
      drop('not_server_span');
      continue;
    }

    // The collector converts cumulative series to delta before they reach us.
    if (point.temporality === 'cumulative') {
      drop('not_delta');
      continue;
    }

    if (point.count <= 0) {
      drop('empty');
      continue;
    }

    const factor = msFactor(point.unit, accepted.defaultUnit);
    const boundsMs = point.explicitBounds.map(b => b * factor);
    const sumMs = point.sum * factor;

    const row: MinuteRow = {
      tenantId,
      serviceName: point.serviceName.slice(0, 128),
      route: resolveRoute(point.attrs),
      method: readMethod(point.attrs),
      statusCode: readStatus(point.attrs),
      source: accepted.source,
      bucketStart: minuteStart(point.timeUnixNano),
      requestCount: point.count,
      durationSumMs: sumMs,
      bucketCounts: rebucket(point.bucketCounts, boundsMs, sumMs, point.count),
    };

    rows.push(row);
  }

  return { rows: mergeRows(rows), dropped };
}

/** Sums rows that share a storage key, so one upsert never touches a row twice. */
export function mergeRows(rows: readonly MinuteRow[]): MinuteRow[] {
  const merged = new Map<string, MinuteRow>();
  for (const row of rows) {
    const key = rowKey(row);
    const existing = merged.get(key);
    if (existing) {
      existing.requestCount += row.requestCount;
      existing.durationSumMs += row.durationSumMs;
      existing.bucketCounts = addBuckets(existing.bucketCounts, row.bucketCounts);
    } else {
      merged.set(key, { ...row, bucketCounts: [...row.bucketCounts] });
    }
  }
  return [...merged.values()];
}

/**
 * Caps distinct routes per tenant service. New routes past the limit are folded
 * into `{other}` so a tenant sending raw, unnormalized paths cannot blow up storage.
 */
export class RouteGuard {
  readonly limit: number;
  private readonly known = new Map<string, Set<string>>();

  constructor(limit: number) {
    this.limit = limit;
  }

  isLoaded(tenantId: string, serviceName: string): boolean {
    return this.known.has(`${tenantId}\u0000${serviceName}`);
  }

  load(tenantId: string, serviceName: string, routes: Iterable<string>): void {
    this.known.set(`${tenantId}\u0000${serviceName}`, new Set(routes));
  }

  admit(tenantId: string, serviceName: string, route: string): string {
    const key = `${tenantId}\u0000${serviceName}`;
    let routes = this.known.get(key);
    if (!routes) {
      routes = new Set();
      this.known.set(key, routes);
    }
    if (routes.has(route)) return route;
    if (routes.size >= this.limit) return '{other}';
    routes.add(route);
    return route;
  }
}
