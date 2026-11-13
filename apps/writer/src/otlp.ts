/**
 * Minimal reader for OTLP/JSON `ExportMetricsServiceRequest` bodies, as sent by the
 * collector's otlphttp exporter with `encoding: json`. Only histogram data points
 * are read; everything else in the payload is ignored.
 */

export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue>;

/** Resource attribute the collector sets from the request's ingest-key header. */
export const INGEST_KEY_ATTR = 'scf.ingest_key';

export type Temporality = 'delta' | 'cumulative' | 'unspecified';

export interface HistogramPoint {
  ingestKey: string | undefined;
  serviceName: string;
  metricName: string;
  unit: string;
  attrs: Attrs;
  timeUnixNano: bigint;
  count: number;
  sum: number;
  bucketCounts: number[];
  explicitBounds: number[];
  temporality: Temporality;
}

interface KeyValue {
  key?: string;
  value?: Record<string, unknown>;
}

function readAnyValue(value: Record<string, unknown> | undefined): AttrValue | undefined {
  if (!value) return undefined;
  if (typeof value.stringValue === 'string') return value.stringValue;
  if (value.intValue !== undefined) return Number(value.intValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (typeof value.boolValue === 'boolean') return value.boolValue;
  return undefined;
}

export function readAttributes(list: unknown): Attrs {
  const out: Attrs = {};
  if (!Array.isArray(list)) return out;
  for (const item of list as KeyValue[]) {
    if (!item?.key) continue;
    const value = readAnyValue(item.value);
    if (value !== undefined) out[item.key] = value;
  }
  return out;
}

function readTemporality(value: unknown): Temporality {
  if (value === 1 || value === 'AGGREGATION_TEMPORALITY_DELTA') return 'delta';
  if (value === 2 || value === 'AGGREGATION_TEMPORALITY_CUMULATIVE') return 'cumulative';
  return 'unspecified';
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toBigInt(value: unknown): bigint {
  try {
    return BigInt(String(value ?? '0'));
  } catch {
    return 0n;
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function extractHistogramPoints(body: unknown): HistogramPoint[] {
  const points: HistogramPoint[] = [];

  for (const rm of asArray(asRecord(body).resourceMetrics)) {
    const resourceAttrs = readAttributes(asRecord(asRecord(rm).resource).attributes);
    const ingestKey = typeof resourceAttrs[INGEST_KEY_ATTR] === 'string' ? (resourceAttrs[INGEST_KEY_ATTR] as string) : undefined;
    const serviceName = typeof resourceAttrs['service.name'] === 'string' ? (resourceAttrs['service.name'] as string) : 'unknown_service';

    for (const sm of asArray(asRecord(rm).scopeMetrics)) {
      for (const rawMetric of asArray(asRecord(sm).metrics)) {
        const metric = asRecord(rawMetric);
        const histogram = asRecord(metric.histogram);
        if (!metric.histogram) continue;

        const temporality = readTemporality(histogram.aggregationTemporality);

        for (const rawPoint of asArray(histogram.dataPoints)) {
          const point = asRecord(rawPoint);
          points.push({
            ingestKey,
            serviceName,
            metricName: String(metric.name ?? ''),
            unit: String(metric.unit ?? ''),
            attrs: readAttributes(point.attributes),
            timeUnixNano: toBigInt(point.timeUnixNano),
            count: toNumber(point.count),
            sum: toNumber(point.sum),
            bucketCounts: asArray(point.bucketCounts).map(toNumber),
            explicitBounds: asArray(point.explicitBounds).map(toNumber),
            temporality,
          });
        }
      }
    }
  }

  return points;
}
