'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { microcopy } from '../content/copy';
import styles from './Header.module.css';

/** Below 768px the nav collapses into this disclosure. The links are rendered on the server. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.mobile}>
      <button
        type="button"
        className={styles.menuButton}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(value => !value)}
      >
        {open ? microcopy.menuClose : microcopy.menuOpen}
      </button>
      <div
        id={id}
        className={styles.panel}
        hidden={!open}
        onClick={event => {
          // Following a link closes the menu.
          if ((event.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
