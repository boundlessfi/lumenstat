#!/usr/bin/env node
// Copy lint. Checks the copy source and, when a build exists, the built HTML.
//
//   - no em dash (U+2014) or en dash (U+2013);
//   - none of the banned marketing words;
//   - no "free" (pricing is not decided);
//   - while scfAwarded is false: no "SCF operators", "used by SCF" or "official".
//
// Usage: node scripts/lint-copy.mjs
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const BANNED = [
  'seamless', 'revolutionary', 'cutting-edge', 'blazing', 'unleash', 'empower', 'leverage',
  'world-class', 'best-in-class', 'game-changing', 'next-gen', 'trusted by', 'AI-powered', 'effortless',
];
const SCF_BANNED = ['SCF operators', 'used by SCF', 'official'];

const scfAwarded = /scfAwarded:\s*true/.test(read('site.config.ts'));

/** The text a visitor or a crawler reads: tags, styles and code-only scripts removed. */
function visibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
}

// A line may opt out with a `copy-lint-allow` comment: used once, for wording
// that a config switch keeps off the page. The built HTML is still checked.
const source = read('content/copy.ts')
  .split('\n')
  .filter(line => !line.includes('copy-lint-allow'))
  .join('\n');
const sources = [{ name: 'content/copy.ts', text: source }];
for (const [name, path] of [
  ['built page', '.next/server/app/index.html'],
  ['built 404 page', '.next/server/app/_not-found.html'],
  ['built llms.txt', '.next/server/app/llms.txt.body'],
]) {
  if (existsSync(new URL(path, root))) {
    const text = read(path);
    sources.push({ name, text: path.endsWith('.html') ? visibleText(text) : text });
  }
}

const word = term => new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
const problems = [];
const report = (name, what, text, index) => {
  const around = text.slice(Math.max(0, index - 40), index + 40).replace(/\s+/g, ' ').trim();
  problems.push(`${name}: ${what}  …${around}…`);
};

for (const { name, text } of sources) {
  for (const [char, label] of [['—', 'em dash'], ['–', 'en dash']]) {
    const index = text.indexOf(char);
    if (index >= 0) report(name, label, text, index);
  }
  for (const term of [...BANNED, 'free', ...(scfAwarded ? [] : SCF_BANNED)]) {
    const match = word(term).exec(text);
    if (match) report(name, `"${term}"`, text, match.index);
  }
}

if (problems.length) {
  console.error(`Copy lint failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Copy lint passed (${sources.map(s => s.name).join(', ')}).`);
