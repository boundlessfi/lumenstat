import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createPool, migrate } from './db.ts';
import { mergeRows, RouteGuard, toRows } from './ingest.ts';
import { safeEqual } from './keys.ts';
import { extractHistogramPoints } from './otlp.ts';
import { type ReadScope, Store } from './store.ts';

const PORT = Number(process.env.PORT ?? 8080);
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const COLLECTOR_SECRET = process.env.SCF_COLLECTOR_SECRET ?? '';
const BOOTSTRAP_OPERATOR_KEY = process.env.SCF_BOOTSTRAP_OPERATOR_KEY ?? '';
const ROUTE_LIMIT = Number(process.env.SCF_ROUTE_LIMIT ?? 500);
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_RANGE_MS = 800 * 24 * 3600 * 1000;
const RANGES: Readonly<Record<string, number>> = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 };

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (COLLECTOR_SECRET.length < 16) throw new Error('SCF_COLLECTOR_SECRET must be at least 16 characters');

function log(level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields })}\n`);
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: http.ServerResponse, status: number, body: unknown, type = 'application/json'): void {
  const payload = type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);
  return req.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body;
}

function readRange(url: URL): { from: Date; to: Date } {
  const range = url.searchParams.get('range');
  const toParam = url.searchParams.get('to');
  const fromParam = url.searchParams.get('from');
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - (RANGES[range ?? '24h'] ?? RANGES['24h'] ?? 86400e3));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new HttpError(400, 'invalid time range');
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) throw new HttpError(400, 'time range too long');
  return { from, to };
}

const pool = createPool(DATABASE_URL);
const store = new Store(pool);
const guard = new RouteGuard(ROUTE_LIMIT);
const dashboardHtml = await readFile(new URL('./dashboard.html', import.meta.url), 'utf8');

async function authenticate(req: http.IncomingMessage): Promise<ReadScope> {
  const header = req.headers.authorization ?? '';
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!key) throw new HttpError(401, 'missing bearer key');
  if (BOOTSTRAP_OPERATOR_KEY.length >= 16 && safeEqual(key, BOOTSTRAP_OPERATOR_KEY)) return { scope: 'operator' };
  const scope = await store.authenticateReadKey(key);
  if (!scope) throw new HttpError(401, 'invalid or revoked key');
  return scope;
}

/** POST /v1/metrics: OTLP/JSON from our own collector, never from the public internet. */
async function ingestMetrics(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const secret = String(req.headers['x-scf-collector-secret'] ?? '');
  if (!safeEqual(secret, COLLECTOR_SECRET)) throw new HttpError(401, 'unknown collector');

  let body: unknown;
  try {
    body = JSON.parse((await readBody(req)).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // A malformed batch will never succeed; answer 400 so the collector does not retry it.
    throw new HttpError(400, 'body is not OTLP/JSON');
  }

  const points = extractHistogramPoints(body);
  const keys = points.map(p => p.ingestKey).filter((k): k is string => typeof k === 'string');
  const tenants = await store.tenantsForKeys(keys);
  const { rows, dropped } = toRows(points, tenants);

  for (const row of rows) {
    if (!guard.isLoaded(row.tenantId, row.serviceName)) {
      guard.load(row.tenantId, row.serviceName, await store.knownRoutes(row.tenantId, row.serviceName));
    }
    row.route = guard.admit(row.tenantId, row.serviceName, row.route);
  }

  const finalRows = mergeRows(rows);
  await store.upsert(finalRows);
  log('info', 'ingested', { points: points.length, rows: finalRows.length, dropped });
  send(res, 200, {});
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'POST' && path === '/v1/metrics') return ingestMetrics(req, res);

  if (req.method === 'GET' && path === '/healthz') {
    await pool.query('select 1');
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && (path === '/' || path === '/dashboard')) {
    res.setHeader('content-security-policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'");
    return send(res, 200, dashboardHtml, 'text/html');
  }

  if (req.method === 'GET' && path === '/v1/api-metrics/tenants') {
    const scope = await authenticate(req);
    const { from, to } = readRange(url);
    const tenants = await store.tenantStats(from, to, scope.scope === 'tenant' ? scope.tenantId : null);
    return send(res, 200, { scope: scope.scope, from, to, tenants });
  }

  const routesMatch = /^\/v1\/api-metrics\/tenants\/([0-9a-f-]{36})\/routes$/.exec(path);
  if (req.method === 'GET' && routesMatch) {
    const tenantId = routesMatch[1] ?? '';
    const scope = await authenticate(req);
    // A tenant key sees only its own tenant; anything else looks like "not found".
    if (scope.scope === 'tenant' && scope.tenantId !== tenantId) throw new HttpError(404, 'tenant not found');
    const tenant = await store.tenantExists(tenantId);
    if (!tenant) throw new HttpError(404, 'tenant not found');
    const { from, to } = readRange(url);
    const routes = await store.routeStats(tenantId, from, to);
    return send(res, 200, { tenant, from, to, routes });
  }

  throw new HttpError(404, 'not found');
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error: unknown) => {
    if (error instanceof HttpError) {
      if (error.status >= 500 || error.status === 401) log('warn', error.message, { status: error.status, path: req.url });
      send(res, error.status, { error: error.message });
      return;
    }
    log('error', 'request failed', { path: req.url, error: String(error) });
    // 503 makes the collector retry the batch instead of dropping it.
    send(res, 503, { error: 'temporarily unavailable' });
  });
});

const applied = await migrate(pool);
if (applied.length) log('info', 'migrations applied', { applied });

server.listen(PORT, () => log('info', 'writer listening', { port: PORT, routeLimit: ROUTE_LIMIT }));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}
