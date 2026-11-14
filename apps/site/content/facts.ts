// Tracker release data. The page never hard-codes the URL, hash or size: they
// all come from here, so the site cannot drift from the release.
//
// releases.json is a copy of packages/tracker/releases.json. When that package
// is present in the repo, tests/unit/facts.test.ts fails if the two differ.
import releases from './releases.json';

export const TRACKER_VERSION = '1.0.0' as const;

const release = releases[TRACKER_VERSION];

export const facts = {
  tracker: {
    version: TRACKER_VERSION,
    url: release.url,
    integrity: release.integrity,
    /** The base64 digest alone: what the verify command prints. */
    digest: release.integrity.replace(/^sha384-/, ''),
    bytes: release.bytes,
    bytesLabel: release.bytes.toLocaleString('en-US'),
    umami: release.umami,
    released: release.released,
    /** Path part of the URL, for the mono detail. */
    path: new URL(release.url).pathname,
  },
  verifyCommand: `curl -s ${release.url} | openssl dgst -sha384 -binary | openssl base64 -A`,
  snippet: [
    `<script defer src="${release.url}"`,
    `  integrity="${release.integrity}"`,
    `  crossorigin="anonymous" data-website-id="YOUR-WEBSITE-ID"></script>`,
  ].join('\n'),
} as const;
