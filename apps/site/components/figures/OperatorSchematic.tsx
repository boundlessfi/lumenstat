import type { Copy } from '../../content/copy';
import styles from './figures.module.css';

// Widths of the skeleton bars, as a share of each cell. Shapes only.
const ROWS = [
  [0.72, 0.3, 0.55, 0.62, 0.58, 0.28, 0.44],
  [0.54, 0.3, 0.42, 0.5, 0.7, 0.2, 0.52],
  [0.64, 0.3, 0.6, 0.44, 0.4, 0.32, 0.38],
];

/**
 * A numberless, coded mock of the operator table: real view and column names,
 * skeleton bars where the data would be. No numbers and no project names.
 */
export function OperatorSchematic({ copy }: { copy: Copy['operators'] }) {
  return (
    <figure className={styles.frame}>
      {/* Focusable so keyboard users can scroll the table sideways on small screens. */}
      <div className={styles.schematic} role="img" aria-label={copy.schematic.aria} tabIndex={0}>
        <div className={styles.schematicInner}>
          <ul className={styles.schematicNav}>
            {copy.operators.views.map((view, i) => (
              <li key={view} className={i === 0 ? styles.schematicActive : undefined}>
                {view}
              </li>
            ))}
          </ul>
          <div className={styles.schematicTable}>
            <div className={styles.schematicRow}>
              {copy.schematic.columns.map(column => (
                <span key={column} className="label">
                  {column}
                </span>
              ))}
            </div>
            {ROWS.map((row, i) => (
              <div key={i} className={styles.schematicRow}>
                {row.map((width, j) => (
                  <span key={j}>
                    <span className={styles.skeleton} style={{ width: `${width * 100}%` }} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className={`small ${styles.caption}`}>{copy.schematic.caption}</figcaption>
    </figure>
  );
}
