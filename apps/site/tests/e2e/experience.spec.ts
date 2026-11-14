import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { copy, microcopy } from '../../content/copy';
import { facts } from '../../content/facts';
import { figure, scrollThrough } from './helpers';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('everything is readable and the figures show their still frames', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const id of ['checks', 'privacy', 'api', 'tracker', 'enroll', 'operators', 'open-source', 'faq']) {
      await expect(page.locator(`#${id} h2`)).toBeVisible();
    }
    // Nothing is left hidden waiting for a script.
    const hidden = await page.locator('[data-reveal]').evaluateAll(
      items => items.filter(item => Number(getComputedStyle(item).opacity) < 1).length,
    );
    expect(hidden).toBe(0);

    await expect(page.getByRole('img', { name: copy.hero.figure.aria })).toBeVisible();
    await expect(figure(page, copy.hero.figure.label).locator('svg[data-orientation]:visible')).toHaveCount(1);
    await expect(page.getByRole('img', { name: copy.api.figure.aria })).toContainText('{account}');
    await expect(page.getByRole('img', { name: copy.tracker.figure.aria })).toContainText(facts.tracker.digest);

    await page.locator('#faq summary').first().click();
    await expect(page.locator('#faq details').first()).toContainText(copy.faq.items[0]!.answer);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('figures show still frames, and the hero steps one event at a time', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const hero = figure(page, copy.hero.figure.label);
    const step = hero.getByRole('button', { name: microcopy.step });
    await expect(step).toBeVisible();
    await expect(hero.getByRole('button', { name: microcopy.pause })).toHaveCount(0);

    const still = hero.locator('svg[data-orientation]:visible');
    await expect(still).toContainText('No proof of JavaScript');
    await expect(still).toContainText('Data-center IP');
    const tally = () => still.locator('text').filter({ hasText: /^\d+$/ }).first().textContent();
    expect(await tally()).toBe('3');
    await testInfo.attach('fig-01-still', { body: await hero.screenshot(), contentType: 'image/png' });

    await step.click(); // event 6 passes
    expect(await tally()).toBe('4');
    await step.click();
    await step.click();
    await step.click(); // event 9 is flagged at gate 01
    await expect(still).toContainText('Sent from another domain');
    expect(await tally()).toBe('6');
    await testInfo.attach('fig-01-stepped', { body: await hero.screenshot(), contentType: 'image/png' });

    await scrollThrough(page, 150);
    const normalize = figure(page, copy.api.figure.label);
    await normalize.scrollIntoViewIfNeeded();
    await expect(normalize.getByRole('button', { name: microcopy.replay })).toHaveCount(0);
    await expect(normalize).toContainText(copy.api.figure.latencyHeading);
    await testInfo.attach('fig-02-still', { body: await normalize.screenshot(), contentType: 'image/png' });

    const verify = figure(page, copy.tracker.figure.label);
    await verify.scrollIntoViewIfNeeded();
    await expect(verify.getByRole('button', { name: microcopy.replay })).toHaveCount(0);
    await expect(verify).toContainText(copy.tracker.figure.match);
    await testInfo.attach('fig-03-still', { body: await verify.screenshot(), contentType: 'image/png' });

    // No element is moving or blurred.
    const moving = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    expect(moving).toBe(0);
  });
});

test.describe('figures', () => {
  test('the hero loop runs, pauses and resumes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const hero = figure(page, copy.hero.figure.label);
    const pause = hero.getByRole('button', { name: microcopy.pause });
    await expect(pause).toBeVisible();

    const dots = () =>
      hero.locator('svg[data-orientation]:visible g[transform]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')).join('|'));
    await page.waitForTimeout(1200);
    const a = await dots();
    await page.waitForTimeout(400);
    expect(await dots()).not.toBe(a);

    await pause.click();
    const play = hero.getByRole('button', { name: microcopy.play });
    await expect(play).toBeVisible();
    const b = await dots();
    await page.waitForTimeout(400);
    expect(await dots()).toBe(b);

    await play.click();
    await page.waitForTimeout(400);
    expect(await dots()).not.toBe(b);
  });

  test('the other two play once in view and can be replayed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const normalize = figure(page, copy.api.figure.label);
    await normalize.scrollIntoViewIfNeeded();
    const replay = normalize.getByRole('button', { name: microcopy.replay });
    await expect(replay).toBeVisible();
    await expect(normalize.getByText(copy.api.figure.merged)).toBeVisible({ timeout: 8000 });
    await replay.click();
    await expect(normalize.getByText(copy.api.figure.merged)).toBeVisible({ timeout: 8000 });

    const verify = figure(page, copy.tracker.figure.label);
    await verify.scrollIntoViewIfNeeded();
    await expect(verify.getByRole('button', { name: microcopy.replay })).toBeVisible();
    await expect(verify.getByText(copy.tracker.figure.match)).toBeVisible({ timeout: 6000 });
  });

  test('figures reserve their space: nothing shifts as they load and play', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    test.skip(
      !(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift'))),
      'layout-shift entries are Chromium only',
    );
    await scrollThrough(page, 400);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.02);
  });
});

test.describe('phones', () => {
  for (const width of [320, 375]) {
    test(`no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await scrollThrough(page, 250);
      await page.waitForTimeout(4000); // let the figures finish
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }

  test('the menu opens, lists the links and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const toggle = page.getByRole('button', { name: microcopy.menuOpen });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    const close = page.getByRole('button', { name: microcopy.menuClose });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('navigation', { name: 'Menu' });
    for (const item of copy.nav) await expect(menu.getByRole('link', { name: item.label })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: new RegExp(copy.enroll) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await menu.getByRole('link', { name: 'FAQ' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('keyboard and accessibility', () => {
  test('everything is reachable by Tab, with a visible focus ring', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari only tabs to links with Option held; covered in Chromium');
    await page.goto('/', { waitUntil: 'networkidle' });
    await scrollThrough(page, 120);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(5000); // figures finish, so their Replay buttons exist

    const seen: { name: string; tag: string; ring: boolean; inFaq: boolean; inFigure: boolean }[] = [];
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      const item = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
          tag: el.tagName.toLowerCase(),
          ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
          inFaq: Boolean(el.closest('#faq')),
          inFigure: Boolean(el.closest('figure')),
        };
      });
      if (!item) break;
      seen.push(item);
    }

    expect(seen[0]?.name).toBe(microcopy.skip);
    expect(seen[1]?.name).toBe(microcopy.homeLabel);
    const names = seen.map(item => item.name);
    for (const item of copy.nav) expect(names).toContain(item.label);
    expect(names.filter(name => name.startsWith(copy.enroll)).length).toBeGreaterThanOrEqual(4);
    expect(names).toContain(microcopy.pause);
    expect(names.filter(name => name === microcopy.replay)).toHaveLength(2);
    expect(names).toContain('Copy: Tracker snippet');
    expect(names).toContain('Copy: Verify command');
    expect(seen.filter(item => item.tag === 'summary' && item.inFaq)).toHaveLength(copy.faq.items.length);
    expect(seen.filter(item => !item.ring).map(item => item.name)).toEqual([]);
  });

  test('the skip link jumps to the content', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari only tabs to links with Option held; covered in Chromium');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: microcopy.skip });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('copy buttons copy the real text and say so', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'clipboard permissions are Chromium only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/', { waitUntil: 'networkidle' });
    const button = page.getByRole('button', { name: 'Copy: Verify command' }).last();
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(button).toContainText(microcopy.copied);
    await expect(page.locator('#live')).toHaveText(microcopy.copiedLive);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(facts.verifyCommand);
    await expect(button).toContainText(microcopy.copy, { timeout: 3000 });

    await page.getByRole('button', { name: 'Copy: Tracker snippet' }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(facts.snippet);
  });

  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 720 }]] as const) {
    test(`axe finds no violations (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'networkidle' });
      await scrollThrough(page, 150);
      await page.waitForTimeout(5000);
      await page.locator('#faq summary').first().click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }

  test('analytics events are data attributes on the right elements', async ({ page }) => {
    await page.goto('/');
    const events = await page.locator('[data-umami-event]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-umami-event')));
    for (const event of ['cta-enroll-nav', 'cta-enroll-hero', 'cta-enroll-steps', 'cta-enroll-final', 'copy-snippet', 'copy-verify-command', 'faq-open']) {
      expect(events).toContain(event);
    }
    await expect(page.locator('#faq summary').nth(2)).toHaveAttribute('data-umami-event-question', '3');
  });
});
