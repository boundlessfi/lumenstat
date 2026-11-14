import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createPool, migrate } from './db.ts';
import { mergeRows, RouteGuard, toRows } from './ingest.ts';
import { safeEqual } from './keys.ts';
import { extractHistogramPoints } from './otlp.ts';
import { type EnrollmentStatus, type ReadScope, Store } from './store.ts';

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

async function requireOperator(req: http.IncomingMessage): Promise<void> {
  const scope = await authenticate(req);
  if (scope.scope !== 'operator') throw new HttpError(403, 'operator key required');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(req);
  if (body.length > 64 * 1024) throw new HttpError(413, 'body too large');
  try {
    const value: unknown = JSON.parse(body.toString('utf8') || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'body must be a JSON object');
}

function text(value: unknown, field: string, max: number, required = true): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > max) throw new HttpError(400, `${field} is invalid`);
  return value.trim();
}

function uuid(value: unknown, field: string, required = true): string | null {
  const v = text(value, field, 36, required);
  if (v !== null && !UUID_RE.test(v)) throw new HttpError(400, `${field} must be a UUID`);
  return v;
}

/** Operator-only control API used by the dashboard for enrollment and keys. */
async function admin(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith('/v1/admin/')) return false;
  await requireOperator(req);

  if (req.method === 'POST' && path === '/v1/admin/tenants') {
    const body = await readJson(req);
    const name = text(body.name, 'name', 80) ?? '';
    const teamId = uuid(body.umamiTeamId, 'umamiTeamId', false);
    const { tenantId, ingestKey } = await store.createTenant(name);
    if (teamId) await store.linkUmamiTeam(tenantId, teamId);
    log('info', 'tenant created', { tenantId, umamiTeamId: teamId });
    send(res, 201, { tenantId, ingestKey });
    return true;
  }

  const keyMatch = /^\/v1\/admin\/tenants\/([0-9a-f-]{36})\/ingest-keys$/.exec(path);
  if (req.method === 'POST' && keyMatch) {
    const tenantId = keyMatch[1] ?? '';
    const body = await readJson(req);
    if (!(await store.tenantExists(tenantId))) throw new HttpError(404, 'tenant not found');
    const ingestKey = await store.createIngestKey(tenantId, text(body.label, 'label', 60, false) ?? 'dashboard');
    log('info', 'ingest key issued', { tenantId });
    send(res, 201, { ingestKey });
    return true;
  }

  if (req.method === 'POST' && path === '/v1/admin/enrollments') {
    const body = await readJson(req);
    const domains = Array.isArray(body.domains) ? body.domains : [];
    if (domains.length < 1 || domains.length > 10 || !domains.every(d => typeof d === 'string' && d.length <= 253)) {
      throw new HttpError(400, 'domains must list 1 to 10 hostnames');
    }
    const enrollment = await store.createEnrollment({
      projectName: text(body.projectName, 'projectName', 80) ?? '',
      domains: domains as string[],
      stellarLink: text(body.stellarLink, 'stellarLink', 300) ?? '',
      contact: text(body.contact, 'contact', 254) ?? '',
      umamiUserId: uuid(body.umamiUserId, 'umamiUserId') ?? '',
      umamiTeamId: uuid(body.umamiTeamId, 'umamiTeamId') ?? '',
    });
    log('info', 'enrollment received', { enrollmentId: enrollment.enrollmentId });
    send(res, 201, { enrollment });
    return true;
  }

  if (req.method === 'GET' && path === '/v1/admin/enrollments') {
    const status = url.searchParams.get('status');
    if (status && !['pending', 'approved', 'rejected'].includes(status)) throw new HttpError(400, 'invalid status');
    const teamId = uuid(url.searchParams.get('teamId'), 'teamId', false);
    const enrollments = await store.listEnrollments({
      status: (status as EnrollmentStatus | null) ?? undefined,
      teamId: teamId ?? undefined,
    });
    send(res, 200, { enrollments });
    return true;
  }

  const decisionMatch = /^\/v1\/admin\/enrollments\/([0-9a-f-]{36})\/decision$/.exec(path);
  if (req.method === 'POST' && decisionMatch) {
    const body = await readJson(req);
    if (body.status !== 'approved' && body.status !== 'rejected') throw new HttpError(400, 'status must be approved or rejected');
    const enrollment = await store.decideEnrollment(decisionMatch[1] ?? '', {
      status: body.status,
      decidedBy: text(body.decidedBy, 'decidedBy', 254) ?? '',
      tenantId: uuid(body.tenantId, 'tenantId', false),
      note: text(body.note, 'note', 500, false),
    });
    if (!enrollment) throw new HttpError(409, 'enrollment not found or already decided');
    log('info', 'enrollment decided', { enrollmentId: enrollment.enrollmentId, status: enrollment.status });
    send(res, 200, { enrollment });
    return true;
  }

  throw new HttpError(404, 'not found');
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
  if (await admin(req, res, url)) return;

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
      if (error.status >= 500 || error.status === 401 || error.status === 403) log('warn', error.message, { status: error.status, path: req.url });
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
