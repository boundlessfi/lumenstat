'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { ChecksProps } from './FourChecks/Animated';
import type { NormalizeProps } from './Normalize/Animated';
import type { VerifyProps } from './Verify/Animated';
import styles from './figures.module.css';

type Loader<P> = () => Promise<{ default: ComponentType<P & { children: ReactNode }> }>;

/**
 * Wraps a figure's server-rendered still frame. When the figure comes near the
 * viewport, the animated version is fetched in its own chunk and takes over.
 * Until then, and if the chunk never loads, the still frame stays.
 */
function island<P extends object>(load: Loader<P>) {
  return function FigureIsland(props: P & { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [Animated, setAnimated] = useState<ComponentType<P & { children: ReactNode }> | null>(null);

    useEffect(() => {
      const node = ref.current;
      if (!node) return;
      let cancelled = false;
      const observer = new IntersectionObserver(
        entries => {
          if (!entries.some(entry => entry.isIntersecting)) return;
          observer.disconnect();
          load().then(
            module => {
              if (!cancelled) setAnimated(() => module.default);
            },
            () => {}, // Chunk failed to load: keep the still frame.
          );
        },
        { rootMargin: '400px 0px' },
      );
      observer.observe(node);
      return () => {
        cancelled = true;
        observer.disconnect();
      };
    }, []);

    return (
      <div ref={ref} className={styles.island}>
        {Animated ? <Animated {...props} /> : props.children}
      </div>
    );
  };
}

export const ChecksIsland = island<ChecksProps>(() => import('./FourChecks/Animated'));
export const NormalizeIsland = island<NormalizeProps>(() => import('./Normalize/Animated'));
export const VerifyIsland = island<VerifyProps>(() => import('./Verify/Animated'));
