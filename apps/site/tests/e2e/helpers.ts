import type { Page } from '@playwright/test';

/** Scrolls from top to bottom in steps, so every lazy figure loads and every reveal fires. */
export async function scrollThrough(page: Page, pause = 80) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(200, Math.floor((page.viewportSize()?.height ?? 800) * 0.6));
  for (let y = 0; y <= height; y += step) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(pause);
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(pause);
}

export const figure = (page: Page, label: string) =>
  page.locator('figure').filter({ hasText: label });
