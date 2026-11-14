import type { ReactNode } from 'react';
import { microcopy } from '../../../content/copy';
import { facts } from '../../../content/facts';
import { CopyButton } from '../../CopyButton';
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

/**
 * The figure's two panels, each with a Copy button in its head.
 *
 * The buttons sit outside the drawing so they stay reachable: the terminal
 * panel is the image the figure's label describes, and the snippet panel is
 * hidden from assistive technology because the same snippet is real text in
 * the code block right below the figure.
 */
export function VerifyPanels({
  data,
  aria,
  snippet,
  terminal,
}: {
  data: VerifyData;
  aria: string;
  snippet: ReactNode;
  terminal: ReactNode;
}) {
  return (
    <>
      <div className={styles.verifyPanel}>
        <div className={styles.verifyHead}>
          <span className="label">{data.labels.snippet}</span>
          <CopyButton text={facts.snippet} event="copy-snippet" label={`${microcopy.copy}: Tracker snippet`} />
        </div>
        <div aria-hidden="true">{snippet}</div>
      </div>
      <div className={styles.verifyPanel}>
        <div className={styles.verifyHead}>
          <span className="label">{data.labels.terminal}</span>
          <CopyButton text={data.command} event="copy-verify-command" label={`${microcopy.copy}: Verify command`} />
        </div>
        <div role="img" aria-label={aria}>
          {terminal}
        </div>
      </div>
      <p className={`small ${styles.release}`}>{data.labels.release}</p>
    </>
  );
}

/** The final, matched state. Shown for reduced motion and without JavaScript. */
export function VerifyStill({ data, aria }: { data: VerifyData; aria: string }) {
  return (
    <div className={styles.canvas}>
      <div className={styles.verify}>
        <VerifyPanels
          data={data}
          aria={aria}
          snippet={
            <SnippetCode
              data={data}
              value={
                <span className={styles.integrity}>
                  sha384-<span className={styles.matched}>{data.digest}</span>
                </span>
              }
            />
          }
          terminal={
            <>
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
            </>
          }
        />
      </div>
    </div>
  );
}
