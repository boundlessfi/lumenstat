'use client';

import { useEffect } from 'react';

/**
 * The page's progressive enhancements, in one effect:
 *  - scroll reveals, once per element, when it is about 15% in view;
 *  - the header hairline after 8px of scroll.
 * Both use IntersectionObserver. There is no scroll listener.
 */
export function Enhance() {
  useEffect(() => {
    const root = document.documentElement;
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    // Anything already on screen stays as it is: no flash, no replayed entrance.
    const viewport = window.innerHeight;
    const pending: HTMLElement[] = [];
    for (const item of items) {
      if (item.getBoundingClientRect().top < viewport) item.classList.add('is-in', 'is-seen');
      else pending.push(item);
    }
    root.classList.add('js');

    const reveal = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          reveal.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    pending.forEach(item => reveal.observe(item));

    const sentinel = document.getElementById('scroll-sentinel');
    const header = document.getElementById('site-header');
    const scrolled =
      sentinel && header
        ? new IntersectionObserver(([entry]) => {
            header.toggleAttribute('data-scrolled', !entry?.isIntersecting);
          })
        : null;
    if (sentinel) scrolled?.observe(sentinel);

    return () => {
      reveal.disconnect();
      scrolled?.disconnect();
    };
  }, []);

  return null;
}
