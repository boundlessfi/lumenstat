import type { ReactNode } from 'react';
import styles from './figures.module.css';

/**
 * The shared figure frame: a label row on top, the figure, a caption below.
 * The figure's controls are rendered by its client island into the top row.
 */
export function FigureFrame({
  label,
  caption,
  children,
  className = '',
}: {
  label: string;
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`${styles.frame} ${className}`}>
      <div className={styles.head}>
        <span className="label">{label}</span>
      </div>
      {children}
      <figcaption className={`small ${styles.caption}`}>{caption}</figcaption>
    </figure>
  );
}

/** The drawing itself. One image to assistive technology, described by its label. */
export function Canvas({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={`${styles.canvas} ${className}`}>
      {children}
    </div>
  );
}
