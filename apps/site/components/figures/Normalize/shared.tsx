// Pieces shared by the still frame and the animation. No hooks.
import type { DemoLine } from '../../../lib/strkey-demo';
import styles from '../figures.module.css';

export type NormalizeLabels = {
  rawHeading: string;
  storedHeading: string;
  routeHeading: string;
  latencyHeading: string;
  validAccount: string;
  validContract: string;
  merged: string;
};

export type Route = { method: string; before: string; placeholder: string; after: string; requests: number };

/** One row per distinct stored route, in first-seen order. */
export function routesOf(lines: DemoLine[]): Route[] {
  const routes: Route[] = [];
  for (const line of lines) {
    const found = routes.find(
      r => r.method === line.method && r.before === line.before && r.after === line.after,
    );
    if (found) found.requests += 1;
    else
      routes.push({
        method: line.method,
        before: line.before,
        placeholder: line.placeholder,
        after: line.after,
        requests: 1,
      });
  }
  return routes;
}

/** Bar lengths for the latency cells. Shapes only: the figure shows no numbers. */
export const BARS: readonly (readonly [number, number, number])[] = [
  [0.3, 0.56, 0.82],
  [0.38, 0.62, 0.92],
  [0.22, 0.44, 0.66],
  [0.42, 0.7, 0.96],
];

export const PERCENTILES = ['p50', 'p95', 'p99'] as const;

export function StoredRoute({ route }: { route: Pick<Route, 'method' | 'before' | 'placeholder' | 'after'> }) {
  return (
    <>
      <span className={styles.method}>{route.method}</span>
      {route.before}
      <span className={styles.placeholder}>{route.placeholder}</span>
      {route.after}
    </>
  );
}

/** The raw variable segment, shortened in the middle. The full value is in the title. */
export function RawSegment({ line }: { line: DemoLine }) {
  return (
    <span className={styles.rawSeg} title={line.raw === line.short ? undefined : line.raw}>
      {line.short}
    </span>
  );
}

export function TableHead({ labels }: { labels: NormalizeLabels }) {
  return (
    <div className={`${styles.tableRow} ${styles.tableHead}`}>
      <span className="label">{labels.routeHeading}</span>
      <span className={`label ${styles.latencyHead}`}>{labels.latencyHeading}</span>
      {PERCENTILES.map(p => (
        <span key={p} className={`label ${styles.pHead}`}>
          {p}
        </span>
      ))}
    </div>
  );
}
