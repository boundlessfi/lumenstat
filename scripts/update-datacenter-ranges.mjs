#!/usr/bin/env node
// Builds deploy/datacenter-ranges.txt: IP ranges of cloud and hosting providers,
// used by Umami's data-center check (SCF_DATACENTER_RANGES). Events from these
// ranges are stored as flagged, not counted.
//
// Sources are the providers' own published lists, plus the prefixes announced by
// hosting-only networks (from RIPEstat) for providers that publish no list.
// Run monthly; review the diff before committing.
//
// Usage: node scripts/update-datacenter-ranges.mjs [--out deploy/datacenter-ranges.txt]

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'deploy/datacenter-ranges.txt' } } });

const json = async url => {
  const res = await fetch(url, { headers: { 'user-agent': 'lumenstat-datacenter-ranges' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};
const text = async url => {
  const res = await fetch(url, { headers: { 'user-agent': 'lumenstat-datacenter-ranges' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
};
const csvFirstColumn = body =>
  body
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(',')[0].trim());

// Hosting-only networks without a published list: announced prefixes per ASN.
const HOSTING_ASNS = {
  AS24940: 'Hetzner',
  AS213230: 'Hetzner Cloud',
  AS16276: 'OVHcloud',
  AS51167: 'Contabo',
  AS20473: 'Vultr',
  AS12876: 'Scaleway',
  AS63949: 'Akamai Connected Cloud (Linode)',
  AS14061: 'DigitalOcean',
  AS45102: 'Alibaba Cloud',
  AS132203: 'Tencent Cloud',
};

const SOURCES = [
  {
    name: 'Amazon Web Services',
    url: 'https://ip-ranges.amazonaws.com/ip-ranges.json',
    load: async url => {
      const data = await json(url);
      return [...data.prefixes.map(p => p.ip_prefix), ...data.ipv6_prefixes.map(p => p.ipv6_prefix)];
    },
  },
  {
    name: 'Google Cloud',
    url: 'https://www.gstatic.com/ipranges/cloud.json',
    load: async url => (await json(url)).prefixes.map(p => p.ipv4Prefix || p.ipv6Prefix),
  },
  {
    name: 'Oracle Cloud',
    url: 'https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json',
    load: async url => (await json(url)).regions.flatMap(r => r.cidrs.map(c => c.cidr)),
  },
  {
    name: 'DigitalOcean',
    url: 'https://digitalocean.com/geo/google.csv',
    load: async url => csvFirstColumn(await text(url)),
  },
  {
    name: 'Akamai Connected Cloud (Linode)',
    url: 'https://geoip.linode.com/',
    load: async url => csvFirstColumn(await text(url)),
  },
  ...Object.entries(HOSTING_ASNS).map(([asn, name]) => ({
    name: `${name} (${asn})`,
    url: `https://stat.ripe.net/data/announced-prefixes/data.json?resource=${asn}`,
    load: async url => (await json(url)).data.prefixes.map(p => p.prefix),
  })),
];

// ---- CIDR maths: parse, merge, and re-express merged ranges as minimal CIDRs.

function parseCidr(cidr) {
  const [addr, len] = cidr.split('/');
  const prefix = Number(len);
  if (addr.includes(':')) {
    const [head, tail = ''] = addr.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    if (!addr.includes('::') && h.length !== 8) return null;
    const parts = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t].map(x => parseInt(x || '0', 16));
    if (parts.length !== 8 || parts.some(Number.isNaN) || !(prefix >= 0 && prefix <= 128)) return null;
    const value = parts.reduce((acc, p) => (acc << 16n) | BigInt(p), 0n);
    const host = BigInt(128 - prefix);
    const start = (value >> host) << host;
    return { v: 6, start, end: start + (1n << host) - 1n };
  }
  const octets = addr.split('.').map(Number);
  if (octets.length !== 4 || octets.some(o => !(o >= 0 && o <= 255)) || !(prefix >= 0 && prefix <= 32)) return null;
  const value = octets.reduce((acc, o) => (acc << 8n) | BigInt(o), 0n);
  const host = BigInt(32 - prefix);
  const start = (value >> host) << host;
  return { v: 4, start, end: start + (1n << host) - 1n };
}

function merge(ranges) {
  ranges.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1n) {
      if (r.end > last.end) last.end = r.end;
    } else out.push({ ...r });
  }
  return out;
}

function format(v, value) {
  if (v === 4) return [24n, 16n, 8n, 0n].map(s => (value >> s) & 255n).join('.');
  const parts = [];
  for (let i = 7; i >= 0; i--) parts.push(((value >> BigInt(i * 16)) & 0xffffn).toString(16));
  return parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/:{3,}/, '::');
}

function toCidrs({ v, start, end }) {
  const bits = v === 4 ? 32n : 128n;
  const out = [];
  let cur = start;
  while (cur <= end) {
    let size = 0n;
    while (size < bits && (cur & ((1n << (size + 1n)) - 1n)) === 0n && cur + (1n << (size + 1n)) - 1n <= end) size++;
    out.push(`${format(v, cur)}/${bits - size}`);
    cur += 1n << size;
  }
  return out;
}

// ---- Main

const all = [];
const summary = [];
for (const source of SOURCES) {
  try {
    const cidrs = (await source.load(source.url)).filter(Boolean);
    const parsed = cidrs.map(parseCidr).filter(Boolean);
    all.push(...parsed);
    summary.push(`# ${source.name}: ${parsed.length} prefixes from ${source.url}`);
    console.log(`${source.name}: ${parsed.length}`);
  } catch (err) {
    // A failed source keeps the run going, but is visible in the file and the log.
    summary.push(`# ${source.name}: FAILED (${err.message})`);
    console.error(`${source.name}: FAILED ${err.message}`);
  }
}

const merged = [...merge(all.filter(r => r.v === 4)), ...merge(all.filter(r => r.v === 6))];
const lines = merged.flatMap(toCidrs);

writeFileSync(
  values.out,
  [
    '# Cloud and hosting provider IP ranges for the data-center check (SCF_DATACENTER_RANGES).',
    '# Generated by scripts/update-datacenter-ranges.mjs. Do not edit by hand.',
    `# Generated: ${new Date().toISOString().slice(0, 10)}`,
    ...summary,
    ...lines,
    '',
  ].join('\n'),
);
console.log(`Wrote ${lines.length} ranges to ${values.out}`);
