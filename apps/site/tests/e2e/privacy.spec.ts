import { expect, test } from '@playwright/test';
import { scrollThrough } from './helpers';

// The page's central promise: nothing from third parties, and nothing stored.

test('contacts no origin but its own and the Lumenstat tracker', async ({ page, baseURL }) => {
  const own = new URL(baseURL!).host;
  const allowed = new Set([own, 't.lumenstat.com']);
  const hosts = new Set<string>();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    hosts.add(url.host);
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await scrollThrough(page);
  await page.waitForLoadState('networkidle');

  expect([...hosts].filter(host => !allowed.has(host))).toEqual([]);
  expect(hosts.has(own)).toBe(true);
});

test('sets no cookies and stores nothing in the browser', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await context.cookies()).toEqual([]);

  await scrollThrough(page);
  await page.getByRole('button', { name: /Copy: Verify command/ }).click();
  await page.locator('#faq summary').first().click();

  expect(await context.cookies()).toEqual([]);
  const stored = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  expect(stored).toEqual({ local: 0, session: 0 });
});

test('the HTML references no other origin for scripts, styles, fonts or images', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const loaded = [...html.matchAll(/<(?:script|link|img|iframe|source|video|audio)\b[^>]*?(?:src|href)="([^"]+)"/g)]
    .map(match => match[1]!)
    .filter(url => /^(?:https?:)?\/\//.test(url))
    // The canonical link points at the site itself.
    .filter(url => !url.startsWith('https://lumenstat.com'))
    .filter(url => !url.startsWith('https://t.lumenstat.com/'));
  expect(loaded).toEqual([]);
});

test('sends the security headers', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self' 'unsafe-inline' https://t.lumenstat.com");
  expect(csp).toContain("connect-src 'self' https://t.lumenstat.com");
  expect(csp).toContain("font-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  // Only sent from Vercel builds: see next.config.ts.
  if (process.env.VERCEL) expect(csp).toContain('upgrade-insecure-requests');
  expect(csp).not.toContain('unsafe-eval');
  expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});
