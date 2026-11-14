'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { microcopy } from '../../../content/copy';
import { PauseIcon, PlayIcon, StepIcon } from '../../icons';
import { Controls, ControlButton } from '../Controls';
import { Canvas } from '../Frame';
import { useInView, useNarrow, usePageVisible, useReducedMotion } from '../hooks';
import { LAYOUTS, NARROW_BELOW, peelPoint, type Layout } from './layout';
import { EVENTS, FAILS, frameAt, MAX_DOTS, STILL_STEPS, stillTime } from './model';
import { Chrome, Still, TrayRowContent, type ChecksLabels } from './Scene';
import styles from '../figures.module.css';

export type ChecksProps = { labels: ChecksLabels; aria: string };

/** The page's entrance settles first: the figure starts about 700ms after load. */
const START_AFTER_MS = 700;

export default function ChecksAnimated({ labels, aria, children }: ChecksProps & { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(wrap, NARROW_BELOW);
  const reduced = useReducedMotion();
  const inView = useInView(wrap, 0.2);
  const visible = usePageVisible();
  const [paused, setPaused] = useState(false);
  const [steps, setSteps] = useState(STILL_STEPS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), Math.max(0, START_AFTER_MS - performance.now()));
    return () => clearTimeout(timer);
  }, []);

  const layout = narrow === null ? null : LAYOUTS[narrow ? 'v' : 'h'];
  const animate = Boolean(layout) && ready && !reduced;

  return (
    <div ref={wrap}>
      <Controls>
        {reduced ? (
          <ControlButton
            label={microcopy.step}
            showLabel
            onClick={() => setSteps(n => (n >= EVENTS.length ? 0 : n + 1))}
          >
            <StepIcon />
          </ControlButton>
        ) : (
          <ControlButton label={paused ? microcopy.play : microcopy.pause} onClick={() => setPaused(p => !p)}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </ControlButton>
        )}
      </Controls>
      {animate && layout ? (
        <Canvas label={aria} className={styles.checks}>
          <Running key={layout.orientation} layout={layout} labels={labels} running={!paused && inView && visible} />
        </Canvas>
      ) : reduced && layout ? (
        <Canvas label={aria} className={styles.checks}>
          <Still orientation={layout.orientation} steps={steps} labels={labels} />
        </Canvas>
      ) : (
        children
      )}
    </div>
  );
}

/** Draws frameAt(t) every animation frame by writing to a fixed pool of nodes. */
function Running({ layout, labels, running }: { layout: Layout; labels: ChecksLabels; running: boolean }) {
  const dots = useRef<(SVGGElement | null)[]>([]);
  const rows = useRef<(SVGGElement | null)[]>([]);
  const flashes = useRef<(SVGLineElement | null)[]>([]);
  const tallyNow = useRef<SVGTextElement>(null);
  const tallyBefore = useRef<SVGTextElement>(null);
  // The clock only advances while the figure is running. It starts at the
  // moment that matches the still frame, so the hand-over does not jump.
  const clock = useRef(stillTime(layout.geom));

  useEffect(() => {
    const draw = () => {
      const frame = frameAt(clock.current, layout.geom);

      for (let i = 0; i < MAX_DOTS; i++) {
        const node = dots.current[i];
        if (!node) continue;
        const dot = frame.dots[i];
        if (!dot) {
          node.style.opacity = '0';
          continue;
        }
        const at = dot.peel > 0 ? peelPoint(layout, dot.gate - 1, dot.peel) : layout.point(dot.s);
        node.style.opacity = '1';
        node.setAttribute('transform', `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)}) scale(${dot.scale.toFixed(3)})`);
        (node.firstElementChild as SVGElement).style.opacity = String(1 - dot.turn);
        (node.lastElementChild as SVGElement).style.opacity = String(dot.turn);
      }

      const shown = new Map(frame.rows.map(row => [row.fail, row]));
      rows.current.forEach((node, i) => {
        if (!node) return;
        const row = shown.get(i);
        node.style.opacity = row ? String(row.opacity * frame.presence) : '0';
        if (row) node.setAttribute('transform', `translate(0 ${(layout.tray.top + row.y).toFixed(2)})`);
      });

      flashes.current.forEach((node, i) => {
        if (node) node.style.opacity = String(frame.flash[i] ?? 0);
      });

      const now = tallyNow.current;
      const before = tallyBefore.current;
      if (now && before) {
        const text = String(frame.counted);
        if (now.textContent !== text) {
          now.textContent = text;
          before.textContent = String(Math.max(0, frame.counted - 1));
        }
        now.style.opacity = String(frame.roll * frame.presence);
        now.setAttribute('transform', `translate(0 ${((1 - frame.roll) * 8).toFixed(2)})`);
        before.style.opacity = String((1 - frame.roll) * frame.presence);
        before.setAttribute('transform', `translate(0 ${(-frame.roll * 8).toFixed(2)})`);
      }
    };

    draw();
    if (!running) return;

    let raf = 0;
    let last = performance.now();
    const tick = (time: number) => {
      // Cap the step so a long frame does not skip part of the sequence.
      clock.current += Math.min(time - last, 64);
      last = time;
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, running]);

  const tallyX = layout.bin.x + layout.bin.w / 2;
  const tallyY = layout.bin.y + layout.bin.h / 2 + 6;

  return (
    <Chrome layout={layout} labels={labels}>
      {layout.gates.map((gate, i) => (
        <line
          key={i}
          ref={node => {
            flashes.current[i] = node;
          }}
          className={styles.gateFlash}
          x1={gate.x1}
          y1={gate.y1}
          x2={gate.x2}
          y2={gate.y2}
        />
      ))}
      <g>
        <text ref={tallyBefore} className={styles.tally} x={tallyX} y={tallyY} textAnchor="middle" />
        <text ref={tallyNow} className={styles.tally} x={tallyX} y={tallyY} textAnchor="middle" />
      </g>
      {FAILS.map((_, i) => (
        <g
          key={i}
          ref={node => {
            rows.current[i] = node;
          }}
          style={{ opacity: 0 }}
        >
          <TrayRowContent layout={layout} fail={i} />
        </g>
      ))}
      {Array.from({ length: MAX_DOTS }, (_, i) => (
        <g
          key={i}
          ref={node => {
            dots.current[i] = node;
          }}
          style={{ opacity: 0 }}
        >
          <circle className={styles.dot} r="4.5" />
          <circle className={styles.ring} r="4.5" />
        </g>
      ))}
    </Chrome>
  );
}
