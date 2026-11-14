'use client';

import type { ReactNode } from 'react';
import styles from './figures.module.css';

/** Sits in the figure frame's top row, on the right. */
export function Controls({ children }: { children: ReactNode }) {
  return <div className={styles.controls}>{children}</div>;
}

export function ControlButton({
  label,
  onClick,
  children,
  showLabel = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Show the label as text next to the icon, instead of only to screen readers. */
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className={`label ${styles.control}`}
      onClick={onClick}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
    >
      {children}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
