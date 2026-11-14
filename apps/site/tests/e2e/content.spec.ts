import { expect, test } from '@playwright/test';
import { copy } from '../../content/copy';
import { facts } from '../../content/facts';
import { site } from '../../site.config';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const plain = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

test.describe('server HTML', () => {
  let text = '';
  let html = '';
  test.beforeAll(async ({ request }) => {
    html = await (await request.get('/')).text();
    text = plain(html);
  });

  test('has the headline, every section heading and every FAQ answer', () => {
    expect(text).toContain(`${copy.hero.title.lead} ${copy.hero.title.rest}`);
    const titles = [copy.checks, copy.privacy, copy.api, copy.tracker, copy.enrollment, copy.operators, copy.infra, copy.faq]
      .map(section => (typeof section.title === 'string' ? section.title : `${section.title.lead} ${section.title.rest}`));
    for (const title of [...titles, copy.final.title]) expect(text).toContain(title);
    for (const item of copy.faq.items) {
      expect(text).toContain(item.question);
      expect(text).toContain(item.answer);
    }
  });

  test('has exactly one h1, and headings that never skip a level', () => {
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map(match => Number(match[1]));
    expect(levels.filter(level => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]!).toBeLessThanOrEqual(1);
    });
  });

  test('carries the exact trademark notice and disclaimer, and no Stellar logo', () => {
    expect(text).toContain(
      '"Stellar" is a trademark of the Stellar Development Foundation. All rights reserved. Lumenstat is an independent project, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.',
    );
    expect(text).toContain(`© ${new Date().getFullYear()} ${site.legalEntity}.`);
    expect(html).not.toMatch(/stellar[-_]?logo|stellar\.svg/i);
  });

  test('uses the real tracker release in the snippet and the command', () => {
    expect(html).toContain(escape(facts.tracker.integrity));
    expect(text).toContain(facts.verifyCommand);
    expect(text).toContain(`Tracker ${facts.tracker.version} · ${facts.tracker.bytesLabel} bytes · released ${facts.tracker.released}`);
  });

  test('labels simulated data as simulated', () => {
    expect(text).toContain('Simulated traffic, not real data.');
    expect(text).toContain('Simulated requests.');
    expect(text).toContain('Latency (simulated)');
  });

  test('follows the config switches', () => {
    const cta = site.signupMode === 'approval' ? 'Request access' : 'Enroll your project';
    expect(text).toContain(cta);
    if (!site.repoPublic) {
      expect(text).not.toMatch(/GitHub|open source|Read the code/i);
      expect(text).not.toMatch(/\bMIT\b/);
      expect(html).not.toContain('github.com');
    }
    if (!site.scfAwarded) expect(text).not.toMatch(/SCF operators|used by SCF|SCF's analytics/);
    if (!site.docsUrl) expect(text).not.toMatch(/\bDocs\b/);
    expect(text).not.toMatch(/\bpricing\b|\bfree\b/i);
  });

  test('the tracker tag stays off outside Vercel production', () => {
    expect(html).not.toContain('data-website-id="' + (process.env.NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID ?? 'unset') + '"');
    expect(html).not.toMatch(/<script[^>]+src="https:\/\/t\.lumenstat\.com/);
  });
});

test.describe('metadata and crawl files', () => {
  test('head: title, description, canonical, Open Graph, JSON-LD', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(copy.meta.title);
    const attr = (selector: string, name = 'content') => page.locator(selector).first().getAttribute(name);
    expect(await attr('meta[name="description"]')).toBe(copy.meta.description);
    expect(await attr('link[rel="canonical"]', 'href')).toBe('https://lumenstat.com');
    expect(await attr('meta[property="og:title"]')).toBe(copy.meta.ogTitle);
    expect(await attr('meta[property="og:image"]')).toMatch(/^https:\/\/lumenstat\.com\/opengraph-image/);
    expect(await attr('meta[property="og:image:alt"]')).toBe('Lumenstat. Proof of usage for the Stellar ecosystem.');
    expect(await attr('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await attr('meta[name="theme-color"]')).toBe('#161616');
    expect(await attr('html', 'lang')).toBe('en');

    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(graph['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
      'Organization', 'WebSite', 'SoftwareApplication', 'FAQPage',
    ]);
    // The structured FAQ is the visible FAQ, word for word.
    const visible = await page.locator('#faq details').evaluateAll(items =>
      items.map(item => ({
        q: item.querySelector('summary h3')!.textContent,
        a: item.querySelector('p')!.textContent,
      })),
    );
    const structured = graph['@graph'][3].mainEntity.map(
      (entry: { name: string; acceptedAnswer: { text: string } }) => ({ q: entry.name, a: entry.acceptedAnswer.text }),
    );
    expect(structured).toEqual(visible);
  });

  test('robots.txt, sitemap.xml, manifest, llms.txt, icons and the OG image', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://lumenstat.com/sitemap.xml');
    expect(robots).not.toMatch(/Disallow: \//);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<loc>/g)).toHaveLength(1);
    expect(sitemap).toContain('<loc>https://lumenstat.com/</loc>');

    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'Lumenstat', short_name: 'Lumenstat', theme_color: '#161616', background_color: '#161616' });

    const llms = await request.get('/llms.txt');
    expect(llms.headers()['content-type']).toContain('text/plain');
    const llmsText = await llms.text();
    expect(llmsText).toMatch(/^# Lumenstat\n/);
    expect(llmsText).toContain(facts.tracker.integrity);
    if (!site.repoPublic) expect(llmsText).not.toMatch(/github|open source/i);

    for (const [path, type] of [['/icon.svg', 'image/svg+xml'], ['/apple-icon', 'image/png'], ['/opengraph-image', 'image/png']] as const) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toContain(type);
    }

    const security = await request.get('/.well-known/security.txt');
    expect(security.status()).toBe(site.repoPublic ? 200 : 404);
  });

  test('unknown pages return 404 and are not indexed', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.notFound.title);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: copy.notFound.link })).toHaveAttribute('href', '/');
  });

  test('every internal anchor resolves', async ({ page }) => {
    await page.goto('/');
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
        .map(a => a.getAttribute('href')!)
        .filter(href => href.length > 1 && !document.getElementById(href.slice(1))),
    );
    expect(broken).toEqual([]);
    for (const id of ['top', 'main', 'checks', 'privacy', 'api', 'tracker', 'enroll', 'operators', 'open-source', 'faq']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test('only GitHub and docs links open a new tab', async ({ page }) => {
    await page.goto('/');
    const blank = await page.locator('a[target="_blank"]').evaluateAll(links => links.map(a => (a as HTMLAnchorElement).href));
    for (const href of blank) expect(href).toMatch(/github\.com|docs\./);
  });
});

// External links: not part of the blocking run. Enable with CHECK_EXTERNAL=1.
test('external links answer', async ({ page, request }) => {
  test.skip(!process.env.CHECK_EXTERNAL, 'set CHECK_EXTERNAL=1 to check external links');
  await page.goto('/');
  const links = await page.locator('a[href^="http"]').evaluateAll(as => [...new Set(as.map(a => (a as HTMLAnchorElement).href))]);
  for (const href of links) {
    const response = await request.get(href, { maxRedirects: 5 });
    expect(response.status(), href).toBeLessThan(400);
  }
});
