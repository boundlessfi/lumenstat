'use client';

import { useEffect, useRef, useState } from 'react';
import { microcopy } from '../content/copy';
import { CheckIcon, CopyIcon } from './icons';
import styles from './ui.module.css';

/** Id of the page's one shared live region, rendered in app/layout.tsx. */
export const LIVE_REGION_ID = 'live';

export function CopyButton({ text, event, label }: { text: string; event?: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // Clipboard blocked: leave the button as it is rather than claim success.
    }
    setCopied(true);
    const live = document.getElementById(LIVE_REGION_ID);
    if (live) live.textContent = microcopy.copiedLive;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      if (live) live.textContent = '';
    }, 1200);
  }

  return (
    <button
      type="button"
      className={`label ${styles.copy}`}
      onClick={copy}
      data-umami-event={event}
      data-copied={copied}
      aria-label={label}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span aria-hidden="true">{copied ? microcopy.copied : microcopy.copy}</span>
    </button>
  );
}
