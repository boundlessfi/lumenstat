#!/usr/bin/env node
// Builds the Lumenstat tracker from vendor/umami (Umami's tracker plus our
// patches) and records it as an immutable release.
//
//   packages/tracker/releases/<version>.js   the file served at /v/<version>/l.js; never edited
//   packages/tracker/releases.json           version -> SRI hash, URL, size, Umami tag
//   packages/tracker/dist/l.js               the current version, for the npm package
//
// A release that already exists must rebuild byte for byte; if the tracker
// changed, bump the version in packages/tracker/package.json first.
//
// Usage: node scripts/build-tracker.mjs [--check]   (--check: verify only, write nothing)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });

const root = resolve(import.meta.dirname, '..');
const umami = join(root, 'vendor/umami');
const pkgDir = join(root, 'packages/tracker');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const version = pkg.version;
const host = pkg.lumenstat.collectHost;
const endpoint = pkg.lumenstat.collectEndpoint;

if (!existsSync(join(umami, 'src/tracker/index.ts'))) {
  console.error('vendor/umami is missing; run scripts/sync-umami.sh first.');
  process.exit(1);
}

// Rollup's TypeScript plugin wants the output inside public/ (the tsconfig outDir).
const out = join(umami, 'public', '.lumenstat-tracker-build.js');
execFileSync('npx', ['-y', 'pnpm@12.3.4', 'exec', 'rollup', '-c', 'rollup.tracker.config.js', '-o', out], {
  cwd: umami,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, COLLECT_API_HOST: host, COLLECT_API_ENDPOINT: endpoint },
});

const code = readFileSync(out);
rmSync(out);
const sri = `sha384-${createHash('sha384').update(code).digest('base64')}`;
const releaseFile = join(pkgDir, 'releases', `${version}.js`);

if (existsSync(releaseFile)) {
  const existing = readFileSync(releaseFile);
  if (!existing.equals(code)) {
    console.error(`Tracker ${version} is already released and the build differs. Bump the version in packages/tracker/package.json.`);
    process.exit(1);
  }
  console.log(`Tracker ${version} rebuilds byte for byte (${sri}).`);
  if (values.check) process.exit(0);
} else if (values.check) {
  console.error(`Tracker ${version} has no release file yet. Run node scripts/build-tracker.mjs.`);
  process.exit(1);
}

if (!values.check) {
  const umamiTag = execFileSync('git', ['-C', umami, 'describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim();
  const releasesPath = join(pkgDir, 'releases.json');
  const releases = existsSync(releasesPath) ? JSON.parse(readFileSync(releasesPath, 'utf8')) : {};
  releases[version] ??= {
    url: `${host}/v/${version}/l.js`,
    integrity: sri,
    bytes: code.length,
    umami: umamiTag,
    released: new Date().toISOString().slice(0, 10),
  };

  writeFileSync(releaseFile, code);
  mkdirSync(join(pkgDir, 'dist'), { recursive: true });
  writeFileSync(join(pkgDir, 'dist/l.js'), code);
  writeFileSync(releasesPath, `${JSON.stringify(releases, null, 2)}\n`);

  console.log(`Tracker ${version}: ${code.length} bytes, ${sri}`);
  console.log(`<script defer src="${host}/v/${version}/l.js" integrity="${sri}" crossorigin="anonymous" data-website-id="..."></script>`);
}
