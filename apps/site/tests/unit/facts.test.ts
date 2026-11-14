import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { facts, TRACKER_VERSION } from '../../content/facts';
import releases from '../../content/releases.json';

const packageReleases = fileURLToPath(new URL('../../../../packages/tracker/releases.json', import.meta.url));

describe('tracker facts', () => {
  it('come from the release data', () => {
    const release = releases[TRACKER_VERSION];
    expect(facts.tracker.url).toBe(release.url);
    expect(facts.tracker.integrity).toBe(release.integrity);
    expect(facts.tracker.bytes).toBe(release.bytes);
    expect(facts.tracker.released).toBe(release.released);
  });

  it('pin a versioned URL with a sha384 integrity value', () => {
    expect(facts.tracker.url).toBe(`https://t.lumenstat.com/v/${TRACKER_VERSION}/l.js`);
    expect(facts.tracker.integrity).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    // 48 bytes is a sha384 digest.
    expect(Buffer.from(facts.tracker.digest, 'base64')).toHaveLength(createHash('sha384').digest().length);
  });

  it('use the same values in the snippet and the verify command', () => {
    expect(facts.snippet).toContain(`src="${facts.tracker.url}"`);
    expect(facts.snippet).toContain(`integrity="${facts.tracker.integrity}"`);
    expect(facts.verifyCommand).toBe(
      `curl -s ${facts.tracker.url} | openssl dgst -sha384 -binary | openssl base64 -A`,
    );
  });

  // The site keeps a copy of the tracker package's release file. When the
  // package is in the repo, the two must be identical.
  it.skipIf(!existsSync(packageReleases))('match packages/tracker/releases.json', () => {
    expect(releases).toEqual(JSON.parse(readFileSync(packageReleases, 'utf8')));
  });
});
