import { describe, expect, it } from 'vitest';
import { LAYOUTS } from '../../components/figures/FourChecks/layout';
import {
  EVENTS,
  FAILS,
  frameAt,
  loopLength,
  MAX_DOTS,
  MAX_ROWS,
  SPAWN_TIMES,
  STILL_STEPS,
  stillAt,
  stillTime,
  TIMING,
} from '../../components/figures/FourChecks/model';
import { reasons } from '../../content/copy';

describe.each(['h', 'v'] as const)('four checks model (%s layout)', orientation => {
  const { geom } = LAYOUTS[orientation];
  const loop = loopLength(geom);

  it('has 24 events: 18 pass and 6 fail, spread through the loop', () => {
    expect(EVENTS).toHaveLength(24);
    expect(FAILS).toHaveLength(6);
    const gaps = FAILS.slice(1).map((fail, i) => fail.index - FAILS[i]!.index);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3);
  });

  it('fails each gate with the reasons the dashboard shows', () => {
    const byGate = (gate: number) => FAILS.filter(f => f.failGate === gate).map(f => f.reason).sort();
    expect(byGate(1)).toEqual([reasons.notBrowser, reasons.otherDomain].sort());
    expect(byGate(2)).toEqual([reasons.invalidProof, reasons.noProof].sort());
    expect(byGate(3)).toEqual([reasons.dataCenter]);
    expect(byGate(4)).toEqual([reasons.perNetwork]);
  });

  it('spawns every 420ms, give or take 140ms', () => {
    for (let i = 1; i < SPAWN_TIMES.length; i++) {
      const gap = SPAWN_TIMES[i]! - SPAWN_TIMES[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(TIMING.spawnEvery - TIMING.spawnJitter - 1);
      expect(gap).toBeLessThanOrEqual(TIMING.spawnEvery + TIMING.spawnJitter + 1);
    }
  });

  it('starts empty', () => {
    const frame = frameAt(0, geom);
    expect(frame.dots).toHaveLength(0);
    expect(frame.rows).toHaveLength(0);
    expect(frame.counted).toBe(0);
    expect(frame.presence).toBe(0);
  });

  it('moves the first event along the track at constant speed', () => {
    const t = SPAWN_TIMES[0]! + 500;
    const [dot] = frameAt(t, geom).dots;
    expect(dot?.s).toBeCloseTo(500 * TIMING.speed, 5);
    expect(dot?.turn).toBe(0);
  });

  it('stops a failing event at its gate, turns it, and flashes the gate', () => {
    const first = FAILS[0]!;
    const gate = geom.gates[first.failGate - 1]!;
    const arrive = SPAWN_TIMES[first.index]! + (gate - TIMING.approachPx) / TIMING.speed;
    const holding = arrive + TIMING.approach + TIMING.hold / 2;
    const frame = frameAt(holding, geom);
    const dot = frame.dots.find(d => d.gate === first.failGate);
    expect(dot?.s).toBe(gate);
    expect(dot?.turn).toBe(0);
    expect(frame.flash[first.failGate - 1]).toBeGreaterThan(0);

    const turned = frameAt(arrive + TIMING.approach + TIMING.hold + TIMING.turn, geom);
    expect(turned.dots.find(d => d.gate === first.failGate)?.turn).toBe(1);
  });

  it('never counts a failing event, and gives it a tray row', () => {
    const first = FAILS[0]!;
    const gate = geom.gates[first.failGate - 1]!;
    const rowOpen =
      SPAWN_TIMES[first.index]! +
      (gate - TIMING.approachPx) / TIMING.speed +
      TIMING.approach + TIMING.hold + TIMING.turn + TIMING.peel + TIMING.rowOpen;
    const frame = frameAt(rowOpen + 1, geom);
    expect(frame.rows.map(r => r.fail)).toContain(0);
    expect(frame.rows.find(r => r.fail === 0)?.opacity).toBe(1);
  });

  it('ends with 18 counted and the 4 newest flagged rows, newest on top', () => {
    const settled = loop - TIMING.fadeOut - TIMING.tallyHold / 2;
    const frame = frameAt(settled, geom);
    expect(frame.counted).toBe(18);
    expect(frame.roll).toBe(1);
    expect(frame.presence).toBe(1);
    expect(frame.dots).toHaveLength(0);
    expect(frame.rows.map(r => r.fail)).toEqual([5, 4, 3, 2]);
    expect(frame.rows).toHaveLength(MAX_ROWS);
  });

  it('loops without a jump: the last frame fades to the first', () => {
    const end = frameAt(loop - 1, geom);
    expect(end.presence).toBeLessThan(0.01);
    expect(end.dots).toHaveLength(0);
    expect(frameAt(loop, geom)).toEqual(frameAt(0, geom));
    expect(frameAt(loop + 1234, geom)).toEqual(frameAt(1234, geom));
  });

  it('never needs more dots than the pool holds', () => {
    let most = 0;
    for (let t = 0; t < loop; t += 16) most = Math.max(most, frameAt(t, geom).dots.length);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(MAX_DOTS);
  });

  it('keeps every value in range through the whole loop', () => {
    for (let t = 0; t < loop; t += 16) {
      const frame = frameAt(t, geom);
      for (const dot of frame.dots) {
        expect(dot.s).toBeGreaterThanOrEqual(0);
        expect(dot.s).toBeLessThanOrEqual(geom.length);
        expect(dot.scale).toBeGreaterThanOrEqual(0);
        expect(dot.scale).toBeLessThanOrEqual(1);
      }
      for (const row of frame.rows) {
        expect(row.opacity).toBeGreaterThan(0);
        expect(row.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('hands over from the still frame at a matching moment', () => {
    const frame = frameAt(stillTime(geom), geom);
    expect(frame.rows.map(r => FAILS[r.fail]!.reason)).toEqual([reasons.dataCenter, reasons.noProof]);
  });
});

describe('still frame', () => {
  it('shows three counted, two flagged and one on its way', () => {
    const still = stillAt(STILL_STEPS);
    expect(still.counted).toBe(3);
    expect(still.rows.map(r => `${r.reason} · GATE 0${r.failGate}`)).toEqual([
      'Data-center IP · GATE 03',
      'No proof of JavaScript · GATE 02',
    ]);
    expect(still.travelling).toBe(true);
  });

  it('steps through to the end of the sequence', () => {
    const end = stillAt(EVENTS.length);
    expect(end.counted).toBe(18);
    expect(end.rows).toHaveLength(MAX_ROWS);
    expect(end.travelling).toBe(false);
  });
});
