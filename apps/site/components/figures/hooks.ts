'use client';

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribeReduce(callback: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/** True when the visitor asked for reduced motion. Follows live changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/** True while at least `threshold` of the element is on screen. */
export function useInView(ref: RefObject<Element | null>, threshold = 0.2): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), {
      threshold,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}

/** Becomes true the first time at least `threshold` of the element is on screen, and stays true. */
export function useSeen(ref: RefObject<Element | null>, threshold = 0.35): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return seen;
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

/** False while the tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}

/** True when the element is narrower than `breakpoint` px. Null until measured. */
export function useNarrow(ref: RefObject<Element | null>, breakpoint: number): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < breakpoint);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, breakpoint]);
  return narrow;
}
