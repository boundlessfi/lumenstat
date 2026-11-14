// The drawing shared by the server-rendered still frame, the reduced-motion
// stepper and the running animation. No hooks, so it renders anywhere.
import type { ReactNode } from 'react';
import { LAYOUTS, type Layout, type Orientation } from './layout';
import { FAILS, ROW_HEIGHT, stillAt } from './model';
import styles from '../figures.module.css';

export type ChecksLabels = { gates: string[]; counted: string; tray: string };

const gateLabel = (gate: number) => `GATE 0${gate}`;

/** The fixed parts: track, gates, labels, the Counted bin and the tray heading. */
export function Chrome({ layout, labels, children }: { layout: Layout; labels: ChecksLabels; children?: ReactNode }) {
  const start = layout.point(0);
  const end = layout.point(layout.geom.length);
  const { bin, tray } = layout;
  return (
    <svg
      className={styles.checksSvg}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      data-orientation={layout.orientation}
      aria-hidden="true"
      focusable="false"
    >
      <line className={styles.track} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      {layout.gates.map((gate, i) => (
        <g key={i}>
          <line className={styles.gate} x1={gate.x1} y1={gate.y1} x2={gate.x2} y2={gate.y2} />
          {/* The notch: a short tick across the top of the gate. */}
          {layout.orientation === 'h' ? (
            <line className={styles.gate} x1={gate.x1 - 4} y1={gate.y1} x2={gate.x1 + 4} y2={gate.y1} />
          ) : (
            <line className={styles.gate} x1={gate.x2} y1={gate.y1 - 4} x2={gate.x2} y2={gate.y1 + 4} />
          )}
          <text className={styles.svgLabel} x={gate.lx} y={gate.ly} textAnchor={layout.labelAnchor}>
            {labels.gates[i]}
          </text>
        </g>
      ))}

      <rect className={styles.bin} x={bin.x} y={bin.y} width={bin.w} height={bin.h} rx="6" />
      <text className={`${styles.svgLabel} ${styles.countedLabel}`} x={bin.lx} y={bin.ly} textAnchor={bin.anchor}>
        {labels.counted}
      </text>

      <text className={`${styles.svgLabel} ${styles.trayLabel}`} x={tray.x} y={tray.labelY}>
        {labels.tray}
      </text>
      <line className={styles.trayRule} x1={tray.x} y1={tray.ruleY} x2={tray.right} y2={tray.ruleY} />
      {children}
    </svg>
  );
}

/** One row of the tray: a hollow amber ring, the reason, and the gate it failed at. */
export function TrayRowContent({ layout, fail }: { layout: Layout; fail: number }) {
  const item = FAILS[fail]!;
  return (
    <>
      <circle className={styles.ring} cx={layout.tray.ringX} cy={ROW_HEIGHT / 2} r="4.5" />
      <text className={styles.reason} x={layout.tray.textX} y={ROW_HEIGHT / 2 + 4.5}>
        {item.reason}
      </text>
      <text className={styles.svgLabel} x={layout.tray.right} y={ROW_HEIGHT / 2 + 4.5} textAnchor="end">
        {gateLabel(item.failGate)}
      </text>
    </>
  );
}

/** A still frame: `steps` events are done and, if any remain, one is mid-track. */
export function Still({
  orientation,
  steps,
  labels,
}: {
  orientation: Orientation;
  steps: number;
  labels: ChecksLabels;
}) {
  const layout = LAYOUTS[orientation];
  const state = stillAt(steps);
  const mid = layout.point(layout.geom.gates[0]! / 2);
  const tallyX = layout.bin.x + layout.bin.w / 2;
  const tallyY = layout.bin.y + layout.bin.h / 2 + 6;
  return (
    <Chrome layout={layout} labels={labels}>
      <g key={steps} data-fade>
        <text className={styles.tally} x={tallyX} y={tallyY} textAnchor="middle">
          {state.counted}
        </text>
        {layout.pips.slice(0, Math.min(3, state.counted)).map((pip, i) => (
          <circle key={i} className={styles.dot} cx={pip.x} cy={pip.y} r="3.5" />
        ))}
        {state.travelling ? <circle className={styles.dot} cx={mid.x} cy={mid.y} r="4.5" /> : null}
        {state.rows.map((row, i) => (
          <g key={row.index} transform={`translate(0 ${layout.tray.top + i * ROW_HEIGHT})`}>
            <TrayRowContent layout={layout} fail={FAILS.findIndex(f => f.index === row.index)} />
          </g>
        ))}
      </g>
    </Chrome>
  );
}

/**
 * The still frame in both orientations. CSS shows the one that fits the
 * container, so only one is ever rendered.
 */
export function ResponsiveStill({ labels, steps }: { labels: ChecksLabels; steps: number }) {
  return (
    <div className={styles.responsive}>
      <Still orientation="h" steps={steps} labels={labels} />
      <Still orientation="v" steps={steps} labels={labels} />
    </div>
  );
}
