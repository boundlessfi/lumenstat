# @lumenstat/tracker

The web tracker for [Lumenstat](https://lumenstat.com), privacy-first analytics for Stellar ecosystem projects. It is [Umami](https://umami.is)'s tracker with Lumenstat's patches: no cookies, no local storage, and a small proof-of-work that shows the event came from a real page running the script.

## Use the hosted file (recommended)

Every version lives at its own URL and never changes. Pin it with the integrity hash from [`releases.json`](./releases.json) or the GitHub release notes, so a modified file will not run:

```html
<script
  defer
  src="https://t.lumenstat.com/v/1.0.0/l.js"
  integrity="sha384-cBzCCJcHCWSGbuy/f+zavGm/HjUWv77eni4DyLfq+FfKigpin1mul1ekLXILze/3"
  crossorigin="anonymous"
  data-website-id="YOUR-WEBSITE-ID"
></script>
```

Your website id is on your project's Setup page in the dashboard. Upgrading is a deliberate change of URL and hash.

## Host it yourself

```bash
npm install @lumenstat/tracker
```

Serve `node_modules/@lumenstat/tracker/dist/l.js` from your own domain. The file still sends events to `https://t.lumenstat.com`; set `data-host-url` to point it elsewhere. The package is published from CI with npm provenance, so you can check which commit built it.

## Options

The tracker reads Umami's `data-*` attributes: `data-website-id` (required), `data-domains`, `data-auto-track`, `data-tag`, `data-exclude-search`, `data-exclude-hash`, `data-do-not-track`, `data-host-url`. Custom events work as in Umami: `umami.track('signup')` or a `data-umami-event="signup"` attribute.

## Releases

| Version | Size | Integrity |
| --- | --- | --- |
| 1.0.0 | 10,447 bytes | `sha384-cBzCCJcHCWSGbuy/f+zavGm/HjUWv77eni4DyLfq+FfKigpin1mul1ekLXILze/3` |

Built reproducibly from the repo with `node scripts/build-tracker.mjs`; `--check` confirms a release rebuilds byte for byte from the current source.

MIT licensed. Umami is MIT.
