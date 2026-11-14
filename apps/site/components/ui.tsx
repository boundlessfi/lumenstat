import type { ReactNode } from 'react';
import { microcopy, type TwoTone } from '../content/copy';
import { ArrowIcon } from './icons';
import { CopyButton } from './CopyButton';
import styles from './ui.module.css';

export function Eyebrow({ children }: { children: ReactNode }) {
  // A paragraph, not a heading: eyebrows stay out of the document outline.
  return <p className={`label ${styles.eyebrow}`}>{children}</p>;
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  /** Name of the analytics event sent on click (a data attribute, no script). */
  event?: string;
  /** Visually hidden suffix for links that leave the page. */
  opens?: string;
  arrow?: boolean;
  external?: boolean;
  className?: string;
};

export function Button({
  href,
  children,
  variant = 'primary',
  event,
  opens,
  arrow = variant === 'primary',
  external = false,
  className = '',
}: ButtonProps) {
  return (
    <a
      href={href}
      className={`${styles.button} ${styles[variant]} ${className}`}
      data-umami-event={event}
      {...(external ? { target: '_blank', rel: 'noopener' } : {})}
    >
      {children}
      {opens ? <span className="vh"> {opens}</span> : null}
      {arrow ? <ArrowIcon className={styles.arrow} /> : null}
    </a>
  );
}

export function Chip({ children, flagged = false }: { children: ReactNode; flagged?: boolean }) {
  return <span className={`label ${styles.chip} ${flagged ? styles.chipFlagged : ''}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}

export function CodeBlock({
  label,
  code,
  event,
  copyLabel,
}: {
  label: string;
  code: string;
  event: string;
  /** What the Copy button copies, for its accessible name. */
  copyLabel: string;
}) {
  return (
    <div className={styles.code}>
      <div className={styles.codeHead}>
        <span className="label">{label}</span>
        <CopyButton text={code} event={event} label={`${microcopy.copy}: ${copyLabel}`} />
      </div>
      {/* Focusable so keyboard users can scroll a long line sideways. */}
      <pre className={styles.codeBody} tabIndex={0} role="region" aria-label={copyLabel}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** A headline in two tones: the first sentence in the text color, the rest in the accent. */
export function TwoToneText({ title }: { title: TwoTone | string }) {
  if (typeof title === 'string') return <>{title}</>;
  return (
    <>
      {title.lead} <span className="accent">{title.rest}</span>
    </>
  );
}
