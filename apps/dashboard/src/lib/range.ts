export const RANGES = {
  '24h': { label: 'Last 24 hours', ms: 24 * 3600e3, unit: 'hour' },
  '7d': { label: 'Last 7 days', ms: 7 * 86400e3, unit: 'day' },
  '30d': { label: 'Last 30 days', ms: 30 * 86400e3, unit: 'day' },
} as const;

export type RangeKey = keyof typeof RANGES;

export interface Window {
  key: RangeKey;
  startAt: number;
  endAt: number;
  unit: 'hour' | 'day';
}

export function parseRange(value: string | string[] | undefined): RangeKey {
  return typeof value === 'string' && value in RANGES ? (value as RangeKey) : '7d';
}

export function rangeWindow(key: RangeKey, now = Date.now()): Window {
  const range = RANGES[key];
  return { key, startAt: now - range.ms, endAt: now, unit: range.unit };
}
