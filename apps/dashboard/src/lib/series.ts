import type { Window } from './range';

export interface Point {
  x: string;
  y: number;
}

const HOUR = 3600e3;
const DAY = 86400e3;

function bucketKey(time: number, unit: Window['unit']): string {
  const d = new Date(time);
  if (unit === 'day') d.setUTCHours(0, 0, 0, 0);
  else d.setUTCMinutes(0, 0, 0);
  return d.toISOString().replace('.000Z', 'Z');
}

/** Puts every hour or day of the window on the axis, with zeros where Umami returned nothing. */
export function fillSeries(points: Point[], w: Window): Point[] {
  const values = new Map(points.map(p => [bucketKey(Date.parse(p.x), w.unit), p.y]));
  const step = w.unit === 'day' ? DAY : HOUR;
  const out: Point[] = [];
  for (let t = Date.parse(bucketKey(w.startAt, w.unit)); t <= w.endAt; t += step) {
    const key = bucketKey(t, w.unit);
    out.push({ x: key, y: values.get(key) ?? 0 });
  }
  return out;
}

export function axisLabel(iso: string, unit: Window['unit']): string {
  const d = new Date(iso);
  return unit === 'day'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : `${String(d.getUTCHours()).padStart(2, '0')}:00`;
}
