import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeRows, RouteGuard, toRows } from '../src/ingest.ts';
import { extractHistogramPoints, INGEST_KEY_ATTR } from '../src/otlp.ts';

const T0 = 1_794_556_800_000_000_000n; // a whole minute, in ns

function str(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function int(key: string, value: number) {
  return { key, value: { intValue: String(value) } };
}

/** Shapes a request the way the collector's otlphttp exporter sends it (JSON encoding). */
function body(resource: unknown[], metrics: unknown[]) {
  return { resourceMetrics: [{ resource: { attributes: resource }, scopeMetrics: [{ scope: { name: 'test' }, metrics }] }] };
}

function histogram(name: string, unit: string, points: unknown[], temporality = 1) {
  return { name, unit, histogram: { aggregationTemporality: temporality, dataPoints: points } };
}

function point(attributes: unknown[], count: number, sum: number, bounds: number[], counts: number[], offsetNs = 0n) {
  return {
    attributes,
    startTimeUnixNano: String(T0 - 60_000_000_000n),
    timeUnixNano: String(T0 + offsetNs),
    count: String(count),
    sum,
    explicitBounds: bounds,
    bucketCounts: counts.map(String),
  };
}

const keys = new Map([['key-a', 'tenant-a']]);

describe('extractHistogramPoints + toRows', () => {
  it('stores SDK http.server.request.duration in milliseconds under the key-mapped tenant', () => {
    const payload = body(
      [str('service.name', 'api'), str(INGEST_KEY_ATTR, 'key-a'), str('tenant.id', 'tenant-b')],
      [histogram('http.server.request.duration', 's', [
        point([str('http.route', '/users/:id'), str('http.request.method', 'get'), int('http.response.status_code', 200)], 3, 0.3, [0.05, 0.1, 0.25], [0, 3, 0, 0]),
      ])],
    );
    const { rows, dropped } = toRows(extractHistogramPoints(payload), keys);
    assert.deepEqual(dropped, {});
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.ok(row);
    // tenant.id in the payload is ignored; the ingest key decides.
    assert.equal(row.tenantId, 'tenant-a');
    assert.equal(row.serviceName, 'api');
    assert.equal(row.route, '/users/:id');
    assert.equal(row.method, 'GET');
    assert.equal(row.statusCode, 200);
    assert.equal(row.source, 'metrics');
    assert.equal(row.requestCount, 3);
    assert.equal(Math.round(row.durationSumMs), 300);
    assert.equal(row.bucketCounts[5], 3); // (75, 100] ms
    assert.equal(row.bucketStart.getTime(), Number(T0 / 1_000_000n));
  });

  it('keeps server spans from spanmetrics and drops client spans', () => {
    const payload = body(
      [str('service.name', 'api'), str(INGEST_KEY_ATTR, 'key-a')],
      [histogram('traces.span.metrics.duration', 'ms', [
        point([str('span.kind', 'SPAN_KIND_SERVER'), str('url.path', '/orders/42'), str('http.method', 'POST'), int('http.status_code', 503)], 2, 40, [10, 50], [0, 2, 0]),
        point([str('span.kind', 'SPAN_KIND_CLIENT'), str('url.path', '/upstream')], 5, 50, [10, 50], [5, 0, 0]),
      ])],
    );
    const { rows, dropped } = toRows(extractHistogramPoints(payload), keys);
    assert.deepEqual(dropped, { not_server_span: 1 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.route, '/orders/{id}');
    assert.equal(rows[0]?.source, 'spans');
    assert.equal(rows[0]?.statusCode, 503);
  });

  it('drops unknown keys, unknown metrics and cumulative series', () => {
    const payload = body(
      [str('service.name', 'api'), str(INGEST_KEY_ATTR, 'not-a-key')],
      [histogram('http.server.request.duration', 's', [point([], 1, 0.01, [], [1])])],
    );
    assert.deepEqual(toRows(extractHistogramPoints(payload), keys).dropped, { unknown_ingest_key: 1 });

    const other = body(
      [str('service.name', 'api'), str(INGEST_KEY_ATTR, 'key-a')],
      [
        histogram('db.client.operation.duration', 's', [point([], 1, 0.01, [], [1])]),
        histogram('http.server.request.duration', 's', [point([], 1, 0.01, [], [1])], 2),
      ],
    );
    assert.deepEqual(toRows(extractHistogramPoints(other), keys).dropped, { unknown_metric: 1, not_delta: 1 });
  });

  it('merges points that land on the same row', () => {
    const attrs = [str('http.route', '/health'), str('http.request.method', 'GET'), int('http.response.status_code', 200)];
    const payload = body(
      [str('service.name', 'api'), str(INGEST_KEY_ATTR, 'key-a')],
      [histogram('http.server.request.duration', 's', [
        point(attrs, 1, 0.001, [0.01], [1, 0]),
        point(attrs, 2, 0.002, [0.01], [2, 0], 30_000_000_000n),
      ])],
    );
    const { rows } = toRows(extractHistogramPoints(payload), keys);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.requestCount, 3);
  });
});

describe('RouteGuard', () => {
  it('folds new routes past the limit into {other}', () => {
    const guard = new RouteGuard(2);
    guard.load('t', 's', ['/a']);
    assert.equal(guard.admit('t', 's', '/a'), '/a');
    assert.equal(guard.admit('t', 's', '/b'), '/b');
    assert.equal(guard.admit('t', 's', '/c'), '{other}');
    assert.equal(guard.admit('t', 's', '/b'), '/b');
    assert.equal(guard.admit('t', 'other-service', '/c'), '/c');
  });

  it('re-merges rows that collapse onto {other}', () => {
    const base = { tenantId: 't', serviceName: 's', method: 'GET', statusCode: 200, source: 'metrics' as const, bucketStart: new Date(0), durationSumMs: 1 };
    const rows = mergeRows([
      { ...base, route: '{other}', requestCount: 1, bucketCounts: [1, 0] },
      { ...base, route: '{other}', requestCount: 2, bucketCounts: [0, 2] },
    ]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.bucketCounts, [1, 2]);
  });
});
