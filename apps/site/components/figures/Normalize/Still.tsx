import type { DemoLine } from '../../../lib/strkey-demo';
import { ArrowIcon } from '../../icons';
import { BARS, RawSegment, routesOf, StoredRoute, TableHead, type NormalizeLabels } from './shared';
import styles from '../figures.module.css';

/**
 * The finished state, with no motion: each raw path beside the route it is
 * stored as, then the grouped table. Also the frame shown without JavaScript.
 */
export function NormalizeStill({ lines, labels }: { lines: DemoLine[]; labels: NormalizeLabels }) {
  const routes = routesOf(lines);
  return (
    <div className={styles.normalize}>
      <div className={styles.pairs}>
        <div className={`${styles.pair} ${styles.pairHead}`}>
          <span className="label">{labels.rawHeading}</span>
          <span />
          <span className="label">{labels.storedHeading}</span>
        </div>
        {lines.map((line, i) => {
          const first = lines.findIndex(
            other => other.method === line.method && other.before === line.before && other.after === line.after,
          );
          const route = routes.find(r => r.method === line.method && r.before === line.before && r.after === line.after);
          return (
          // On narrow screens, lines that repeat a route are folded into its first line.
          <div key={i} className={styles.pair} data-repeat={first !== i || undefined}>
            <span className={styles.path}>
              <span className={styles.method}>{line.method}</span>
              {line.before}
              <RawSegment line={line} />
              {line.after}
            </span>
            <ArrowIcon className={styles.pairArrow} />
            <span className={styles.path}>
              <StoredRoute route={line} />
              {first === i && route && route.requests > 1 ? (
                <span className={`label ${styles.badge} ${styles.pairBadge}`}>{labels.merged}</span>
              ) : null}
            </span>
          </div>
          );
        })}
      </div>

      <div className={styles.table}>
        <TableHead labels={labels} />
        {routes.map((route, i) => (
          <div key={i} className={styles.tableRow}>
            <span className={styles.path}>
              <StoredRoute route={route} />
            </span>
            {BARS[i % BARS.length]!.map((value, j) => (
              <span key={j} className={styles.barCell}>
                <span className={styles.bar} style={{ transform: `scaleX(${value})` }} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
