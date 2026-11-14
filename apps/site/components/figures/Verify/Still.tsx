import type { ReactNode } from 'react';
import { CheckIcon } from '../../icons';
import styles from '../figures.module.css';

export type VerifyData = {
  /** The tracker URL, the full integrity value and the digest alone. */
  url: string;
  integrity: string;
  digest: string;
  command: string;
  labels: { snippet: string; terminal: string; match: string; release: string };
};

/** The snippet, with the integrity value marked up so it can be highlighted. */
export function SnippetCode({ data, value }: { data: VerifyData; value: ReactNode }) {
  return (
    <pre className={styles.verifyCode}>
      <code>
        {`<script defer src="${data.url}"\n  integrity="`}
        {value}
        {`"\n  crossorigin="anonymous" data-website-id="YOUR-WEBSITE-ID"></script>`}
      </code>
    </pre>
  );
}

export function MatchBadge({ label }: { label: string }) {
  return (
    <span className={`label ${styles.match}`}>
      <CheckIcon width={12} height={12} />
      {label}
    </span>
  );
}

/** The final, matched state. Shown for reduced motion and without JavaScript. */
export function VerifyStill({ data }: { data: VerifyData }) {
  return (
    <div className={styles.verify}>
      <div className={styles.verifyPanel}>
        <p className={`label ${styles.verifyHead}`}>{data.labels.snippet}</p>
        <SnippetCode
          data={data}
          value={
            <span className={styles.integrity}>
              sha384-<span className={styles.matched}>{data.digest}</span>
            </span>
          }
        />
      </div>
      <div className={styles.verifyPanel}>
        <p className={`label ${styles.verifyHead}`}>{data.labels.terminal}</p>
        <pre className={styles.verifyCode}>
          <code>
            <span className={styles.prompt}>$ </span>
            {data.command}
            {'\n'}
            <span className={styles.matched}>{data.digest}</span>
          </code>
        </pre>
        <p className={styles.verifyResult}>
          <MatchBadge label={data.labels.match} />
        </p>
      </div>
      <p className={`small ${styles.release}`}>{data.labels.release}</p>
    </div>
  );
}
