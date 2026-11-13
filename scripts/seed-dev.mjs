#!/usr/bin/env node
// Local-dev seed: registers the example test site in Umami and renders its pages
// with the website id and the tracker's SRI hash.
//
// Uses Umami's default first-run account (admin / umami). That account exists only
// in a fresh local database; change its password before exposing anything.
//
// Usage: node scripts/seed-dev.mjs [--umami http://localhost:3000] [--site-domain localhost]
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    umami: { type: 'string', default: process.env.UMAMI_URL ?? 'http://localhost:3000' },
    'site-domain': { type: 'string', default: 'localhost' },
    'site-name': { type: 'string', default: 'SCF test site' },
  },
});

const umami = values.umami.replace(/\/$/, '');
const root = new URL('../', import.meta.url);
const templates = new URL('examples/test-site/templates/', root);
const out = new URL('examples/test-site/', root);

async function waitForUmami() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`${umami}/api/heartbeat`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Umami did not answer at ${umami}/api/heartbeat`);
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${umami}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

await waitForUmami();

const { token } = await api('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'umami' } });

const existing = await api(`/api/websites?search=${encodeURIComponent(values['site-name'])}`, { token });
let website = (existing.data ?? []).find(w => w.name === values['site-name']);
if (!website) {
  website = await api('/api/websites', { token, method: 'POST', body: { name: values['site-name'], domain: values['site-domain'] } });
  console.log(`Created website ${website.id} for ${values['site-domain']}`);
} else {
  console.log(`Reusing website ${website.id}`);
}

const script = Buffer.from(await (await fetch(`${umami}/script.js`)).arrayBuffer());
const sri = `sha384-${createHash('sha384').update(script).digest('base64')}`;

await mkdir(out, { recursive: true });
for (const file of await readdir(templates)) {
  const html = (await readFile(new URL(file, templates), 'utf8'))
    .replaceAll('{{UMAMI_URL}}', umami)
    .replaceAll('{{WEBSITE_ID}}', website.id)
    .replaceAll('{{SRI}}', sri);
  await writeFile(new URL(file, out), html);
}

console.log(JSON.stringify({ websiteId: website.id, trackerBytes: script.length, sri }, null, 2));
console.log('Rendered examples/test-site/*.html');
