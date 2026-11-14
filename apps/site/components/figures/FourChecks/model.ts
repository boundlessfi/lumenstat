// The "Four checks" animation as a pure function of time.
//
// frameAt(t, geom) describes everything on screen at t milliseconds into the
// loop. The renderer only maps it to coordinates, so Pause, Step, reduced
// motion and the unit tests all read the same model.
import { reasons } from '../../../content/copy';
import { clamp01, easeOut, easePanel, mulberry32 } from '../../../lib/seq';

export type Geom = {
  /** Track length in px, from the spawn point to the Counted bin. */
  length: number;
  /** Distance of each of the four gates along the track. */
  gates: readonly [number, number, number, number];
};

export type SimEvent = {
  /** 0 = passes every check. 1 to 4 = the gate it fails at. */
  failGate: 0 | 1 | 2 | 3 | 4;
  reason?: string;
};

const pass: SimEvent = { failGate: 0 };
const fail = (failGate: 1 | 2 | 3 | 4, reason: string): SimEvent => ({ failGate, reason });

/** 24 simulated events: 18 pass, 6 fail, with the failures spread out. */
export const EVENTS: readonly SimEvent[] = [
  pass,
  fail(2, reasons.noProof),
  pass,
  pass,
  fail(3, reasons.dataCenter),
  pass,
  pass,
  pass,
  fail(1, reasons.otherDomain),
  pass,
  pass,
  pass,
  fail(4, reasons.perNetwork),
  pass,
  pass,
  pass,
  fail(1, reasons.notBrowser),
  pass,
  pass,
  pass,
  fail(2, reasons.invalidProof),
  pass,
  pass,
  pass,
];

/** The failing events in order, which is also the order of the tray rows. */
export const FAILS = EVENTS.flatMap((event, index) => (event.failGate ? [{ ...event, index }] : []));

export const TIMING = {
  speed: 180 / 1000, // px per ms
  spawnEvery: 420,
  spawnJitter: 140,
  approachPx: 24,
  approach: 160,
  hold: 80,
  flash: 200,
  turn: 120,
  peel: 520,
  rowOpen: 220,
  sink: 160,
  roll: 300,
  tallyHold: 1200,
  fadeOut: 300,
  fadeIn: 300,
} as const;

export const ROW_HEIGHT = 28;
export const MAX_ROWS = 4;
export const MAX_DOTS = 14;

/** Spawn time of each event: every 420ms, plus or minus 140ms of seeded jitter. */
export const SPAWN_TIMES: readonly number[] = (() => {
  const random = mulberry32(7);
  const times: number[] = [];
  let t = TIMING.fadeIn;
  for (let i = 0; i < EVENTS.length; i++) {
    times.push(Math.round(t));
    t += TIMING.spawnEvery + (random() * 2 - 1) * TIMING.spawnJitter;
  }
  return times;
})();

type Plan = {
  event: SimEvent;
  index: number;
  spawn: number;
  /** Pass: reaches the Counted bin. Fail: starts easing into its gate. */
  arrive: number;
  /** Fail only. */
  holdStart: number;
  turnStart: number;
  peelStart: number;
  rowStart: number;
  /** When the event has fully left the track. */
  end: number;
};

function plan(geom: Geom): Plan[] {
  return EVENTS.map((event, index) => {
    const spawn = SPAWN_TIMES[index]!;
    if (!event.failGate) {
      const arrive = spawn + geom.length / TIMING.speed;
      return {
        event,
        index,
        spawn,
        arrive,
        holdStart: 0,
        turnStart: 0,
        peelStart: 0,
        rowStart: 0,
        end: arrive + TIMING.sink,
      };
    }
    const gate = geom.gates[event.failGate - 1]!;
    const arrive = spawn + (gate - TIMING.approachPx) / TIMING.speed;
    const holdStart = arrive + TIMING.approach;
    const turnStart = holdStart + TIMING.hold;
    const peelStart = turnStart + TIMING.turn;
    const rowStart = peelStart + TIMING.peel;
    return { event, index, spawn, arrive, holdStart, turnStart, peelStart, rowStart, end: rowStart + TIMING.rowOpen };
  });
}

const planCache = new Map<string, { plans: Plan[]; settle: number; loop: number }>();

function timeline(geom: Geom) {
  const key = `${geom.length}:${geom.gates.join(',')}`;
  let cached = planCache.get(key);
  if (!cached) {
    const plans = plan(geom);
    const settle = Math.max(...plans.map(p => (p.event.failGate ? p.end : p.arrive + TIMING.roll)));
    cached = { plans, settle, loop: settle + TIMING.tallyHold + TIMING.fadeOut };
    planCache.set(key, cached);
  }
  return cached;
}

/** Length of one loop in ms. */
export const loopLength = (geom: Geom) => timeline(geom).loop;

export type Dot = {
  /** Distance along the track, while the dot is on it. */
  s: number;
  /** 0 = on the track. Otherwise 0 to 1 along the curve into the tray. */
  peel: number;
  /** 0 = filled lilac dot. 1 = hollow amber ring. */
  turn: number;
  scale: number;
  /** The gate the dot leaves the track at, when it is failing. */
  gate: 0 | 1 | 2 | 3 | 4;
};

export type TrayRow = {
  /** Index into FAILS. */
  fail: number;
  /** Vertical offset in px from the top of the tray list. */
  y: number;
  opacity: number;
};

export type Frame = {
  dots: Dot[];
  counted: number;
  /** 0 to 1 while the Counted tally rolls from counted - 1 to counted. */
  roll: number;
  /** Opacity of the tally and the tray: fades in at the start, out at the end. */
  presence: number;
  rows: TrayRow[];
  /** 0 to 1 flash of each gate line. */
  flash: [number, number, number, number];
};

export function frameAt(tMs: number, geom: Geom): Frame {
  const { plans, settle, loop } = timeline(geom);
  const t = ((tMs % loop) + loop) % loop;

  const dots: Dot[] = [];
  const flash: Frame['flash'] = [0, 0, 0, 0];
  let counted = 0;
  let lastCountAt = -Infinity;
  const opens: number[] = [];

  for (const p of plans) {
    if (t < p.spawn) continue;
    const gate = p.event.failGate;

    if (!gate) {
      if (t >= p.arrive) {
        counted += 1;
        if (p.arrive > lastCountAt) lastCountAt = p.arrive;
      }
      if (t < p.end) {
        const sinking = t >= p.arrive;
        dots.push({
          s: sinking ? geom.length : (t - p.spawn) * TIMING.speed,
          peel: 0,
          turn: 0,
          scale: sinking ? 1 - clamp01((t - p.arrive) / TIMING.sink) : 1,
          gate: 0,
        });
      }
      continue;
    }

    const at = geom.gates[gate - 1]!;
    if (t >= p.holdStart) {
      const f = (t - p.holdStart) / TIMING.flash;
      if (f < 1) flash[gate - 1] = Math.max(flash[gate - 1]!, 1 - f);
    }
    if (t >= p.rowStart) {
      opens.push(easeOut(clamp01((t - p.rowStart) / TIMING.rowOpen)));
      continue;
    }
    if (t < p.arrive) {
      dots.push({ s: (t - p.spawn) * TIMING.speed, peel: 0, turn: 0, scale: 1, gate });
    } else if (t < p.holdStart) {
      const k = easeOut((t - p.arrive) / TIMING.approach);
      dots.push({ s: at - TIMING.approachPx * (1 - k), peel: 0, turn: 0, scale: 1, gate });
    } else if (t < p.peelStart) {
      const turn = t < p.turnStart ? 0 : clamp01((t - p.turnStart) / TIMING.turn);
      dots.push({ s: at, peel: 0, turn, scale: 1, gate });
    } else {
      // Keep the curve parameter above 0 so the renderer knows the dot has left the track.
      const k = Math.max(1e-4, easePanel((t - p.peelStart) / TIMING.peel));
      dots.push({ s: at, peel: k, turn: 1, scale: 1, gate });
    }
  }

  // Newest row on top. Each newer row pushes the older ones down as it opens.
  const rows: TrayRow[] = [];
  let offset = 0;
  for (let i = opens.length - 1; i >= 0; i--) {
    const open = opens[i]!;
    const age = opens.length - 1 - i;
    // The fifth row fades out as the row that displaces it opens.
    const newestOpen = opens[opens.length - 1]!;
    const opacity = age === 0 ? open : age < MAX_ROWS ? 1 : age === MAX_ROWS ? 1 - newestOpen : 0;
    if (opacity > 0) rows.push({ fail: i, y: offset, opacity });
    offset += ROW_HEIGHT * open;
  }

  let presence = 1;
  if (t < TIMING.fadeIn) presence = t / TIMING.fadeIn;
  else if (t > settle + TIMING.tallyHold) presence = 1 - clamp01((t - settle - TIMING.tallyHold) / TIMING.fadeOut);

  return {
    dots,
    counted,
    roll: counted ? easeOut(clamp01((t - lastCountAt) / TIMING.roll)) : 1,
    presence,
    rows,
    flash,
  };
}

/**
 * The still frame for reduced motion, for no JavaScript and for the first
 * paint: the first `steps` events are done, and the next one is mid-track.
 */
export function stillAt(steps: number) {
  const done = EVENTS.slice(0, Math.max(0, Math.min(steps, EVENTS.length)));
  const failed = FAILS.filter(f => f.index < done.length);
  return {
    counted: done.filter(e => !e.failGate).length,
    /** Newest first, at most MAX_ROWS. */
    rows: failed.slice(-MAX_ROWS).reverse(),
    /** True while there is another event to show mid-track. */
    travelling: steps < EVENTS.length,
  };
}

/** The server-rendered still: three counted, two flagged, one on its way. */
export const STILL_STEPS = 5;

/**
 * A time at which the running animation looks like the still frame, so the
 * hand-over from the server-rendered still does not jump back to empty.
 */
export function stillTime(geom: Geom): number {
  const { plans } = timeline(geom);
  const second = plans[FAILS[1]!.index]!;
  return second.end;
}
