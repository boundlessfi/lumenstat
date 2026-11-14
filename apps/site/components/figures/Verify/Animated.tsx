'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { microcopy } from '../../../content/copy';
import { ReplayIcon } from '../../icons';
import { Controls, ControlButton } from '../Controls';
import { Canvas } from '../Frame';
import { useReducedMotion, useSeen } from '../hooks';
import { MatchBadge, SnippetCode, type VerifyData } from './Still';
import styles from '../figures.module.css';

export type VerifyProps = { data: VerifyData; aria: string };

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// The sequence, in seconds.
const CHUNK = 4;
const T = {
  dots: 0.3, // a "…" while the command runs
  print: 0.7, // output starts printing
  perChunk: 0.012,
  connector: 0.95,
  green: 1.25,
  perChar: 0.006,
} as const;

export default function VerifyAnimated({ data, aria, children }: VerifyProps & { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const seen = useSeen(wrap, 0.35);
  const [run, setRun] = useState(0);

  return (
    <div ref={wrap}>
      {seen && !reduced ? (
        <>
          <Controls>
            <ControlButton label={microcopy.replay} showLabel onClick={() => setRun(value => value + 1)}>
              <ReplayIcon />
            </ControlButton>
          </Controls>
          <Canvas label={aria}>
            <LazyMotion features={domAnimation} strict>
              <MotionConfig reducedMotion="user">
                <Sequence key={run} data={data} />
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

/** The digest as characters that turn green one after another, left to right. */
function Characters({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {Array.from(text, (char, i) => (
        <span key={i} className={styles.char} style={{ '--i': from + i } as CSSProperties}>
          {char}
        </span>
      ))}
    </>
  );
}

function Sequence({ data }: { data: VerifyData }) {
  const root = useRef<HTMLDivElement>(null);
  const integrity = useRef<HTMLSpanElement>(null);
  const output = useRef<HTMLSpanElement>(null);
  const [rail, setRail] = useState<{ top: number; height: number } | null>(null);

  // The connector runs from the integrity value down to the printed output.
  useLayoutEffect(() => {
    const measure = () => {
      const box = root.current?.getBoundingClientRect();
      const a = integrity.current?.getBoundingClientRect();
      const b = output.current?.getBoundingClientRect();
      if (!box || !a || !b) return;
      const top = a.top + a.height / 2 - box.top;
      setRail({ top, height: b.top + b.height / 2 - box.top - top });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const chunks = data.digest.match(new RegExp(`.{1,${CHUNK}}`, 'g')) ?? [];
  const printed = T.print + chunks.length * T.perChunk;
  const greenDone = T.green + data.digest.length * T.perChar;
  const greenVars = { '--green-at': `${T.green}s`, '--per-char': `${T.perChar}s` } as CSSProperties;

  return (
    <div ref={root} className={`${styles.verify} ${styles.verifyLive}`} style={greenVars}>
      <div className={styles.verifyPanel}>
        <p className={`label ${styles.verifyHead}`}>{data.labels.snippet}</p>
        <SnippetCode
          data={data}
          value={
            <span ref={integrity} className={styles.integrity}>
              sha384-
              <Characters text={data.digest} />
            </span>
          }
        />
      </div>

      <div className={styles.verifyPanel}>
        <p className={`label ${styles.verifyHead}`}>{data.labels.terminal}</p>
        <pre className={styles.verifyCode}>
          <code>
            <span className={styles.prompt}>$ </span>
            {/* The command is shown in full from the start: typing it out would only delay reading. */}
            {data.command}
            {'\n'}
            <span ref={output} className={styles.output}>
              <m.span
                className={styles.waiting}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: T.print - T.dots, delay: T.dots, times: [0, 0.1, 0.9, 1] }}
              >
                …
              </m.span>
              {chunks.map((chunk, i) => (
                <m.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.001, delay: T.print + i * T.perChunk }}
                >
                  <Characters text={chunk} from={i * CHUNK} />
                </m.span>
              ))}
            </span>
          </code>
        </pre>
        <p className={styles.verifyResult}>
          <m.span
            className={styles.matchWrap}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: greenDone, ease: EASE_OUT }}
          >
            <MatchBadge label={data.labels.match} />
          </m.span>
        </p>
      </div>

      {rail ? (
        <m.span
          className={styles.rail}
          style={{ top: rail.top, height: rail.height }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3, delay: Math.max(T.connector, printed), ease: EASE_OUT }}
        />
      ) : null}

      <p className={`small ${styles.release}`}>{data.labels.release}</p>
    </div>
  );
}
