// Where things sit, for the two orientations of the figure. The model works in
// distance along the track; this maps it to SVG coordinates.
import type { Geom } from './model';

export type Orientation = 'h' | 'v';

export type Layout = {
  orientation: Orientation;
  width: number;
  height: number;
  geom: Geom;
  /** A point on the track, `s` px from its start. */
  point: (s: number) => { x: number; y: number };
  /** Each gate: its line, and where its label goes. */
  gates: { x1: number; y1: number; x2: number; y2: number; lx: number; ly: number }[];
  labelAnchor: 'middle' | 'start';
  bin: { x: number; y: number; w: number; h: number; lx: number; ly: number; anchor: 'middle' | 'start' };
  /** Resting dots drawn in the still frame. */
  pips: { x: number; y: number }[];
  tray: { x: number; right: number; labelY: number; ruleY: number; top: number; ringX: number; textX: number };
  /** Control point of the curve a flagged dot follows from its gate into the tray. */
  peelControl: (gate: { x: number; y: number }) => { x: number; y: number };
};

const H_GATES = [96, 216, 336, 456] as const;
const V_GATES = [60, 120, 180, 240] as const;

export const LAYOUTS: Record<Orientation, Layout> = {
  h: {
    orientation: 'h',
    width: 640,
    height: 316,
    geom: { length: 536, gates: H_GATES },
    point: s => ({ x: 20 + s, y: 72 }),
    gates: H_GATES.map(s => ({ x1: 20 + s, y1: 46, x2: 20 + s, y2: 98, lx: 20 + s, ly: 28 })),
    labelAnchor: 'middle',
    bin: { x: 556, y: 52, w: 64, h: 40, lx: 588, ly: 28, anchor: 'middle' },
    pips: [578, 588, 598].map(x => ({ x, y: 108 })),
    tray: { x: 20, right: 620, labelY: 160, ruleY: 172, top: 182, ringX: 30, textX: 46 },
    peelControl: gate => ({ x: gate.x, y: 156 }),
  },
  v: {
    orientation: 'v',
    width: 360,
    height: 560,
    geom: { length: 292, gates: V_GATES },
    point: s => ({ x: 56, y: 20 + s }),
    gates: V_GATES.map(s => ({ x1: 42, y1: 20 + s, x2: 70, y2: 20 + s, lx: 84, ly: 24 + s })),
    labelAnchor: 'start',
    bin: { x: 28, y: 312, w: 56, h: 40, lx: 98, ly: 336, anchor: 'start' },
    pips: [174, 184, 194].map(x => ({ x, y: 332 })),
    tray: { x: 16, right: 344, labelY: 398, ruleY: 410, top: 418, ringX: 26, textX: 42 },
    peelControl: gate => ({ x: -10, y: gate.y + (432 - gate.y) * 0.5 }),
  },
};

/** Containers narrower than this get the vertical figure. Matches the CSS. */
export const NARROW_BELOW = 520;

/** Position on the quadratic curve from a gate into the top tray row. */
export function peelPoint(layout: Layout, gateIndex: number, k: number) {
  const from = layout.point(layout.geom.gates[gateIndex]!);
  const to = { x: layout.tray.ringX, y: layout.tray.top + 14 };
  const c = layout.peelControl(from);
  const u = 1 - k;
  return {
    x: u * u * from.x + 2 * u * k * c.x + k * k * to.x,
    y: u * u * from.y + 2 * u * k * c.y + k * k * to.y,
  };
}
