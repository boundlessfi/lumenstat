# lumenstat.com

The one-page marketing site for Lumenstat. A static Next.js app: every section is rendered at build time, and the only client code is three figure animations, the copy buttons and the mobile menu.

It loads nothing from third parties. The only other origin it may contact is `t.lumenstat.com`, Lumenstat's own tracker, and only in production.

## Run it

Node 22 or newer.

```bash
npm ci
npm run dev        # http://localhost:3300, with hot reload
```

```bash
npm run build && npm start   # the production build, on the same port
```

## Checks

| Command | What it checks |
| --- | --- |
| `npm run lint` | ESLint, `next/core-web-vitals` |
| `npm run typecheck` | `tsc --noEmit`. Run it after a build or `npm run dev`, which generate `next-env.d.ts` |
| `npm test` | Unit tests: the hero animation model, the demo Stellar addresses, the tracker facts, the config switches and the JSON-LD |
| `npm run lint:copy` | No em or en dashes, no banned words, no "free", and no SCF wording while `scfAwarded` is false. Checks `content/copy.ts` and the built HTML |
| `npm run check:bundle` | First-load JavaScript against the budget. Needs a build |
| `npm run test:e2e` | Playwright, in Chromium and WebKit. Needs a build, and `npx playwright install chromium webkit` once |
| `npm run analyze` | Writes Next's bundle analyzer report to `.next/diagnostics/analyze`. Run `npx next analyze` to explore it in the browser |
| `npm run lhci` | Lighthouse, mobile, three runs, with the performance budget as assertions. Needs a build and Chrome |

The browser tests cover the promises the page makes: no request to any other origin, no cookies and nothing in browser storage, all copy in the server HTML, still frames under reduced motion and without JavaScript, no sideways scroll at 320px and 375px, a full keyboard path with visible focus, and a clean axe run.

`.github/workflows/site.yml` runs all of the above on pull requests that touch this app.

## Where things are

| Path | What |
| --- | --- |
| `site.config.ts` | The switches for every open decision. See below |
| `content/copy.ts` | Every string on the page. The FAQ here feeds both the HTML and the JSON-LD |
| `content/facts.ts`, `content/releases.json` | The tracker release: URL, hash, size, date |
| `components/Sections.tsx` | The sections, in page order |
| `components/figures/` | The three figures. Each has a still frame rendered on the server and an animated version loaded on demand |
| `styles/tokens.css` | Colors (Stellar Design System 4.0.2 dark theme values), radii and motion tokens |
| `lib/strkey-demo.ts` | The demo Stellar addresses in Fig 02, generated at build time. They belong to no one |
| `app/` | Layout, metadata, `robots.txt`, `sitemap.xml`, manifest, `llms.txt`, icons and the Open Graph image |

## Config switches

All in `site.config.ts`. The defaults are the safe choice. Change a value, rebuild, and the copy follows.

| Switch | Default | What it changes |
| --- | --- | --- |
| `repoPublic` | `true` | The repository is public, so the header, the hero line, the infrastructure section, the FAQ, the final call to action and the footer link to GitHub. While false, the page has no GitHub link and makes no open-source claim: the hero line reads "Hosted in the EU.", the infrastructure heading and its MIT row change, the open-source FAQ is left out, the "Read the code" buttons become "See how it works", the JSON-LD drops `license` and `sameAs`, and `/.well-known/security.txt` returns 404 |
| `repoUrl` | the GitHub repo | Target of the GitHub links, once `repoPublic` is true |
| `docsUrl` | `null` | A URL adds a "Docs" link to the header, menu and footer |
| `signupMode` | `'open'` | `'open'`: "Enroll your project" and "Programs can run sign-up open or with approval." `'approval'`: "Request access" and "New projects are reviewed before they go live." |
| `scfAwarded` | `false` | While false the page says "program operators". True changes it to "SCF operators". Set it only once an award is public |
| `builtBy`, `legalEntity` | Boundless, Thirtn Limited | The footer credit and the copyright line |
| `publicStatsUrl` | `null` | A URL adds a "Public stats" link to the footer |
| `screenshots` | `false` | False renders the numberless schematic of the operator view. True shows `public/screens/operator.avif` and `public/screens/project.avif`, which you must add (AVIF, 2x, under 120 KB each; update the `width` and `height` in `components/Sections.tsx` to match). Only use real data with consent, or a sample project labelled as a sample |
| `signupUrl`, `signinUrl`, `appUrl`, `url` | the production addresses | Link targets and the canonical URL |

The theme is dark only.

### Environment

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID` | Vercel, Production only | Lumenstat's own website id for lumenstat.com. The tracker tag renders only when this is set and `VERCEL_ENV` is `production`, so previews and local runs stay out of the stats |

## The tracker release

`content/releases.json` is a copy of `packages/tracker/releases.json`. The snippet, the verify command, the integrity hash, the file size and the release date on the page all come from it, so the page cannot drift from the release.

When the tracker package is in this repo, a unit test fails if the two files differ. To publish a new tracker version on the site: copy the release file over, and set `TRACKER_VERSION` in `content/facts.ts`.

## Security headers and the CSP trade-off

Set in `next.config.ts` for every path: a Content Security Policy, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`.

- **`'unsafe-inline'` in `script-src` is deliberate.** Next.js needs inline bootstrap scripts, and a nonce would force every request to be rendered on demand instead of served as a static page. The page takes no user input, so the job of the policy is to pin origins: scripts and connections may only go to this site and `t.lumenstat.com`.
- **`upgrade-insecure-requests` is sent only from Vercel builds.** On `http://localhost`, Safari would upgrade the page's own assets to HTTPS and a local production build could not load its CSS.
- **HSTS is sent with `preload`.** The header alone does nothing: submitting the domain to the preload list is a separate decision that is hard to undo, and it covers every subdomain. Decide before submitting.
- In development the policy also allows `'unsafe-eval'` and WebSocket connections, which hot reload needs.

## Vercel settings

The site is built to deploy on Vercel, but nothing in this repo deploys it. Set these in the Vercel project:

- **Root directory:** `apps/site`.
- **Domains:** `lumenstat.com` as the apex, with `www.lumenstat.com` redirecting to it (308).
- **Web Analytics, Speed Insights and the Vercel Toolbar: off.** Each loads a script from another origin. The toolbar injects one from `vercel.live` on preview deployments, which breaks the "nothing from third parties" promise on any preview you share.
- **Environment:** `NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID`, in Production only.

## Notes on the build

- **Fonts.** Inter and Inconsolata load through `next/font/google`, which downloads them at build time and serves them from this site, so browsers never contact Google. The build machine needs network access for that. If it has none, switch to `next/font/local`; `assets/fonts/` already holds OFL files used for the Open Graph image.
- **Logo.** The mark (a lilac rounded square with three rising bars) is interim. It is drawn in `components/icons.tsx`, `app/icon.svg`, `app/apple-icon.tsx` and `app/opengraph-image.tsx`. Replace all four together.
- **Figures.** Each figure's still frame is what you see without JavaScript, under reduced motion, and before the animation loads. The hero animation is a pure function of time (`components/figures/FourChecks/model.ts`), which is what the unit tests exercise.
- **Bundle budget.** `check:bundle` treats the JavaScript loaded by the 404 page as the framework baseline, recorded in `bundle-baseline.json`. The landing page may add at most 35 KB (gzip) on top, and each figure chunk may be at most 12 KB. Motion is one shared chunk, loaded on demand. After a Next.js upgrade, run `node scripts/check-bundle.mjs --write-baseline`.

## Before launch

1. In the Lumenstat dashboard, create the `lumenstat.com` website. Set `NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID` in Vercel, Production only.
2. Apply the Vercel settings above.
3. Launch gates:
   - Make the repository public and set `repoPublic: true`, or launch with the open-source claims hidden.
   - Confirm that the infrastructure lines in the "How it runs" section still match production.
   - Confirm how `t.lumenstat.com` is served. Until that is checked, the page must not claim that no third party sees visitor IPs. It does not claim it today.
   - Confirm `signupMode` and the footer credits.
   - Replace the interim logo if a final one exists.

## After launch

4. **Search Console.** Verify the domain property with a DNS TXT record and submit `https://lumenstat.com/sitemap.xml`. Do the same in Bing Webmaster Tools, which can import from Search Console.
5. **Check the live URL** with Lighthouse, Google's Rich Results Test, validator.schema.org, securityheaders.com and an Open Graph preview. Expect no rich results: FAQ results are limited to a narrow set of sites, and software results need offers or ratings, which this page rightly does not have. The markup is still valid and gives crawlers a clean description.
6. **Earn the first links plainly:** the GitHub repository's Website field, the docs header, a "Measured by Lumenstat" link in the footers of boundlessfi.xyz and thirtn.com, and the Lumenstat entry in the SCF project page. No paid links.
7. **After 4 to 8 weeks,** review the Search Console queries and adjust the title, description and FAQ questions toward the words people use, within the facts.
8. **Have the privacy wording reviewed** alongside the project's `PRIVACY.md` before promoting the page widely.
