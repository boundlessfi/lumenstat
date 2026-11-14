#!/usr/bin/env node
// Bundle budget. Run after `next build`.
//
// "Framework baseline" is the JavaScript the 404 page loads: it has no page
// code of its own, so what it loads is Next.js, React and the shared layout.
// The landing page may add at most 35 KB (gzip) on top of that, and each lazy
// figure chunk may be at most 12 KB.
//
// Usage: node scripts/check-bundle.mjs [--write-baseline]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const PAGE_BUDGET = 35 * 1024;
const ISLAND_BUDGET = 12 * 1024;
const BASELINE_DRIFT = 10 * 1024;

const built = name => new URL(`.next/server/app/${name}`, root);
if (!existsSync(built('index.html'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

const gzip = path => gzipSync(readFileSync(new URL(`.next/${path}`, root))).length;
// The scripts a modern browser fetches for a page. `nomodule` polyfills are
// skipped: browsers that support modules never download them.
const scriptsOf = (html, nomodule = false) =>
  new Set(
    [...readFileSync(html, 'utf8').matchAll(/<script\b[^>]*>/gi)]
      .map(match => match[0])
      .filter(tag => /\bnomodule\b/i.test(tag) === nomodule)
      .map(tag => /src="\/_next\/(static\/[^"]+?\.js)[^"]*"/.exec(tag)?.[1])
      .filter(Boolean)
      .map(decodeURI),
  );

const page = scriptsOf(built('index.html'));
const framework = scriptsOf(built('_not-found.html'));
const polyfills = scriptsOf(built('index.html'), true);
const sum = files => [...files].reduce((total, file) => total + gzip(file), 0);

const baseline = sum(framework);
const pageOnly = sum([...page].filter(file => !framework.has(file)));

// Every other chunk is fetched on demand: the three figures and Motion.
const all = readdirSync(new URL('.next/static/chunks/', root), { recursive: true })
  .map(String)
  .filter(file => file.endsWith('.js'))
  .map(file => `static/chunks/${file}`);
const lazy = all
  .filter(file => !page.has(file) && !framework.has(file) && !polyfills.has(file))
  .map(file => {
    const source = readFileSync(new URL(`.next/${file}`, root), 'utf8');
    // Motion is shared by two figures, so it is one chunk of its own, not part of any island's budget.
    return { file, size: gzip(file), motion: /motion-dom|framer-motion|MotionConfig|LazyMotion/.test(source) && source.length > 40_000 };
  })
  .filter(chunk => chunk.size > 200);

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
const baselineFile = new URL('bundle-baseline.json', root);
if (process.argv.includes('--write-baseline')) {
  writeFileSync(baselineFile, `${JSON.stringify({ frameworkGzip: baseline }, null, 2)}\n`);
  console.log(`Recorded framework baseline: ${kb(baseline)}`);
}
const recorded = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')).frameworkGzip : null;

console.log(`First-load JS (gzip)`);
console.log(`  framework baseline   ${kb(baseline)}${recorded ? `  (recorded ${kb(recorded)})` : ''}`);
console.log(`  page code            ${kb(pageOnly)}  (budget ${kb(PAGE_BUDGET)})`);
console.log(`  total                ${kb(baseline + pageOnly)}`);
console.log(`Lazy chunks (gzip), not in the first load`);
for (const chunk of lazy) console.log(`  ${kb(chunk.size).padStart(8)}  ${chunk.motion ? 'motion (shared)' : 'figure'}  ${chunk.file}`);

const failures = [];
if (pageOnly > PAGE_BUDGET) failures.push(`page code is ${kb(pageOnly)}, over the ${kb(PAGE_BUDGET)} budget`);
if (recorded && baseline > recorded + BASELINE_DRIFT) {
  failures.push(`framework baseline grew from ${kb(recorded)} to ${kb(baseline)}; if that is expected, run with --write-baseline`);
}
for (const chunk of lazy) {
  if (!chunk.motion && chunk.size > ISLAND_BUDGET) failures.push(`${chunk.file} is ${kb(chunk.size)}, over the ${kb(ISLAND_BUDGET)} island budget`);
}
if (failures.length) {
  console.error(`\nBundle check failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nBundle check passed.');
