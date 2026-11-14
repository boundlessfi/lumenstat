#!/usr/bin/env node
// Sends scripted, fake page views to a Lumenstat site, the way someone inflating
// a project's numbers would, to show they are flagged instead of counted.
//
//   node scripts/fake-event.mjs --site <website id> [--host https://t.lumenstat.com]
//                               [--domain example.org] [--level naive|forged|proof] [--count 1]
//
// Levels:
//   naive   a plain POST from a script: no Origin, no proof of JavaScript
//   forged  Origin and Fetch Metadata headers forged to look like a browser, still no proof
//   proof   forged headers plus a valid proof of JavaScript (an attacker who reverse-engineered
//           the tracker); with --ip you can test the data-center and per-network checks on a
//           local stack that trusts x-forwarded-for
//
// Then open the dashboard: Operator view -> Traffic quality. The events appear
// as flagged, with the reasons, and the project's page views do not change.

import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    site: { type: 'string' },
    host: { type: 'string', default: 'https://t.lumenstat.com' },
    domain: { type: 'string', default: 'example.org' },
    level: { type: 'string', default: 'naive' },
    count: { type: 'string', default: '1' },
    ip: { type: 'string' },
    path: { type: 'string', default: '/' },
  },
});

if (!values.site) {
  console.error('Usage: node scripts/fake-event.mjs --site <website id> [--host URL] [--domain example.org] [--level naive|forged|proof]');
  process.exit(1);
}

const SLOT_MS = 10 * 60 * 1000;
const BITS = 10;

function prove(website, url) {
  const slot = Math.floor(Date.now() / SLOT_MS);
  for (let nonce = 0; ; nonce++) {
    const digest = createHash('sha256').update(`${website}:${slot}:${url}:${nonce}`).digest();
    if (Math.clz32(digest.readUInt32BE(0)) >= BITS) return `${slot}.${nonce}`;
  }
}

const endpoint = `${values.host.replace(/\/$/, '')}/e`;
const results = [];

for (let i = 0; i < Number(values.count); i++) {
  const url = `https://${values.domain}${values.path}`;
  const headers = {
    'content-type': 'application/json',
    // A different, ordinary browser user agent each time, so isbot does not catch it.
    'user-agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/14${i % 10}.0.0.0 Safari/537.36`,
  };
  if (values.level !== 'naive') {
    headers.origin = `https://${values.domain}`;
    headers['sec-fetch-mode'] = 'cors';
    headers['sec-fetch-site'] = 'cross-site';
  }
  if (values.level === 'proof') headers['x-lumenstat-pow'] = prove(values.site, url);
  if (values.ip) headers['x-forwarded-for'] = values.ip;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'event',
      payload: { website: values.site, hostname: values.domain, url, referrer: '', language: 'en-US', screen: '1920x1080', title: 'Fake' },
    }),
  });
  const body = await res.text();
  results.push(body.includes('boop') ? 'not counted' : res.ok ? 'counted' : `HTTP ${res.status}`);
}

const tally = results.reduce((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});
console.log(`Sent ${results.length} fake page view(s) at level "${values.level}" to ${endpoint}:`, tally);
console.log('Open the dashboard: Operator view -> Traffic quality, to see them flagged with the reasons.');
