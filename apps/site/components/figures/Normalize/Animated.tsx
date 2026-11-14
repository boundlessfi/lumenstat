'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { useRef, useState, type ReactNode } from 'react';
import { microcopy } from '../../../content/copy';
import type { DemoLine } from '../../../lib/strkey-demo';
import { CheckIcon, ReplayIcon } from '../../icons';
import { Controls, ControlButton } from '../Controls';
import { Canvas } from '../Frame';
import { useNarrow, useReducedMotion, useSeen } from '../hooks';
import { BARS, routesOf, StoredRoute, TableHead, type NormalizeLabels } from './shared';
import styles from '../figures.module.css';

export type NormalizeProps = { lines: DemoLine[]; labels: NormalizeLabels; aria: string };

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_PANEL = [0.32, 0.72, 0, 1] as const;

// The sequence, in seconds. About 4.4s in total.
const T = {
  lineStagger: 0.08,
  first: 0.6, // the first address is checked
  between: 0.25, // then one line every 250ms
  sweep: 0.4,
  tag: 0.16,
  collapse: 0.45,
  merge: 2.9,
  table: 3.5,
} as const;

const ROW = 28;
/** Containers narrower than this show addresses shortened in the middle. Matches the CSS. */
const NARROW_BELOW = 620;

export default function NormalizeAnimated({
  lines,
  labels,
  aria,
  children,
}: NormalizeProps & { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const seen = useSeen(wrap, 0.35);
  const narrow = useNarrow(wrap, NARROW_BELOW);
  // Each replay bumps this and restarts the sequence.
  const [run, setRun] = useState(0);

  // Plays once, the first time the figure is seen.
  const playing = seen && !reduced && narrow !== null;

  return (
    <div ref={wrap}>
      {playing ? (
        <>
          <Controls>
            <ControlButton label={microcopy.replay} showLabel onClick={() => setRun(value => value + 1)}>
              <ReplayIcon />
            </ControlButton>
          </Controls>
          <Canvas label={aria}>
            <LazyMotion features={domAnimation} strict>
              <MotionConfig reducedMotion="user">
                <Sequence key={run} lines={lines} labels={labels} narrow={narrow} />
              </MotionConfig>
            </LazyMotion>
          </Canvas>
        </>
      ) : (
        children
      )}
    </div>
  );
}

function Sequence({ lines, labels, narrow }: { lines: DemoLine[]; labels: NormalizeLabels; narrow: boolean }) {
  const routes = routesOf(lines);
  // Lines that share a route with an earlier line slide up into it.
  const firstOf = lines.map(line =>
    lines.findIndex(other => other.method === line.method && other.before === line.before && other.after === line.after),
  );
  const duplicatesBefore = (i: number) => firstOf.slice(0, i + 1).filter((first, j) => first !== j).length;

  return (
    <div className={styles.normalize} data-narrow={narrow}>
      <m.div
        className={styles.lines}
        initial={{ height: lines.length * ROW }}
        animate={{ height: routes.length * ROW }}
        transition={{ duration: T.collapse, delay: T.merge, ease: EASE_PANEL }}
      >
        {lines.map((line, i) => {
          const start = T.first + i * T.between;
          const collapseAt = start + T.sweep + T.tag;
          const raw = narrow ? line.short : line.raw;
          const duplicate = firstOf[i] !== i;
          const shift = duplicate ? (i - firstOf[i]!) * ROW : duplicatesBefore(i) * ROW;
          const tag =
            line.kind === 'account' ? labels.validAccount : line.kind === 'contract' ? labels.validContract : null;
          return (
            <m.div
              key={i}
              className={styles.line}
              style={{ top: i * ROW }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: duplicate ? [0, 1, 1, 0] : 1, y: -shift }}
              transition={{
                opacity: duplicate
                  ? { duration: T.merge + T.collapse - i * T.lineStagger, delay: i * T.lineStagger, times: [0, 0.08, 0.9, 1] }
                  : { duration: 0.3, delay: i * T.lineStagger },
                y: { duration: T.collapse, delay: T.merge, ease: EASE_PANEL },
              }}
            >
              <span className={styles.path}>
                <span className={styles.method}>{line.method}</span>
                {line.before}
                <m.span
                  className={styles.seg}
                  initial={{ width: `${raw.length}ch` }}
                  animate={{ width: `${line.placeholder.length}ch` }}
                  transition={{ duration: T.collapse, delay: collapseAt, ease: EASE_PANEL }}
                >
                  <m.span
                    className={styles.sweep}
                    initial={{ scaleX: 0, opacity: 1 }}
                    animate={{ scaleX: 1, opacity: 0 }}
                    transition={{
                      scaleX: { duration: T.sweep, delay: start, ease: 'linear' },
                      opacity: { duration: 0.2, delay: collapseAt },
                    }}
                  />
                  <m.span
                    className={styles.segRaw}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: collapseAt }}
                  >
                    {raw}
                  </m.span>
                  <m.span
                    className={`${styles.segPlaceholder} ${styles.placeholder}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: collapseAt + 0.25 }}
                  >
                    {line.placeholder}
                  </m.span>
                </m.span>
                {line.after}
                {i === 0 ? (
                  <m.span
                    className={`label ${styles.badge}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: T.merge + T.collapse - 0.1 }}
                  >
                    {labels.merged}
                  </m.span>
                ) : null}
              </span>
              {tag ? (
                <m.span
                  className={`label ${styles.tag}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  // Appears as the address starts to collapse, so it never sits on top of it.
                  transition={{ duration: T.collapse + 0.45, delay: collapseAt + 0.05, times: [0, 0.18, 0.75, 1] }}
                >
                  <CheckIcon width={12} height={12} />
                  {tag}
                </m.span>
              ) : null}
            </m.div>
          );
        })}
      </m.div>

      <m.div
        className={styles.table}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: T.table }}
      >
        <TableHead labels={labels} />
        {routes.map((route, i) => (
          <div key={i} className={styles.tableRow}>
            <span className={styles.path}>
              <StoredRoute route={route} />
            </span>
            {BARS[i % BARS.length]!.map((value, j) => (
              <span key={j} className={styles.barCell}>
                <m.span
                  className={styles.bar}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: value }}
                  transition={{ duration: 0.6, delay: T.table + 0.1 + (i * 3 + j) * 0.02, ease: EASE_OUT }}
                />
              </span>
            ))}
          </div>
        ))}
      </m.div>
    </div>
  );
}
