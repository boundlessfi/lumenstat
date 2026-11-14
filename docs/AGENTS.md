# Writing the Lumenstat docs

This folder is the Mintlify site for **docs.lumenstat.com**. Pages are MDX with YAML frontmatter; `docs.json` holds navigation and settings. Preview with `npx mint dev` from this folder, and check links with `npx mint broken-links`.

Readers are engineers on Stellar ecosystem teams, SCF reviewers and operators, and security-minded people checking whether the numbers can be trusted. They are technical and short on time. The docs should leave them thinking the people who built this know exactly what they are doing, and the way to do that is precision and honesty, not adjectives.

## Voice

- **Plain and exact.** Short sentences. Say what happens, with the real names, numbers and paths. "Events that fail a check are stored in `scf_flagged_event` and never reach your totals" beats "robust protection against bots".
- **No em dashes.** Use a colon or a full stop. Never join two independent clauses with a comma.
- **No "we", "our" or "us" in page bodies.** Write "Lumenstat stores…", "the collector drops…". Second person for the reader.
- **No hype.** Banned: seamless, robust, powerful, cutting-edge, blazing, effortless, world-class, leverage, unlock, simply, just, easily.
- **Honest about limits.** Every defense has a "what this does not stop" note. Every feature that is not built is marked planned, with its milestone, in a `<Note>`. Never describe planned work as live.
- **Sentence case** for titles and headings. Straight quotes. Arrows are `→`.

## How a page opens

Mintlify renders the frontmatter `title` and `description` above the first line, so never open with a summary, a TL;DR or "In this guide". Open with a lede of two or three sentences: what the thing is in the reader's terms, the consequence they came for, and optionally the one limit that matters.

Frontmatter on every page:

```yaml
---
title: "Short, matches the sidebar"
description: "One sentence, under 160 characters, says what the reader gets."
icon: "lucide-icon-name"   # optional, Lucide names
---
```

## Page shapes

- **Guide (how-to):** lede, then `<Steps>`. Imperative. Each step is one action with its code. End with how to confirm it worked, and a short troubleshooting `<AccordionGroup>` if real failure modes exist.
- **Concept:** lede, `## How it works` (with a Mermaid diagram when there is a flow), then the details, then `## Limits` (what it does not do).
- **Reference:** lede, then tables, `<ParamField>` and `<ResponseField>`. Flat and complete. No encouragement.

## Components

Use Mintlify's built-ins, no imports needed: `<Steps>`, `<Tabs>`, `<CodeGroup>`, `<Card>`, `<Columns cols={2}>`, `<AccordionGroup>`, `<Note>`, `<Tip>`, `<Warning>`, `<Info>`, `<ParamField>`, `<ResponseField>`, `<Update>`, `<Badge>`, and Mermaid code blocks (```` ```mermaid ````). Use components where they help scanning, not as decoration. No `---` rules between sections, no body `# H1`.

Never link into `vendor/`: it is git-ignored, so those links 404. Link the matching patch in `patches/umami/` instead. Link to source with full GitHub URLs on `main`, for example `https://github.com/boundlessfi/lumenstat/blob/main/packages/tracker/releases.json`. Internal links are root-relative without extension: `/trust/bot-defense`.

## Product facts

Use only these, or what you read in the repository source. Do not invent numbers, customers, benchmarks or testimonials. If a fact is missing, leave the page shorter and add an MDX comment `{/* TODO: … */}` rather than guessing.

- **Lumenstat** is privacy-first web and API analytics for Stellar ecosystem projects, run as a shared service for the Stellar Community Fund (SCF). It is built by Boundless and MIT licensed. Tagline: "Proof of usage for the Stellar ecosystem."
- **Hosts:** dashboard `https://app.lumenstat.com`, tracker and collect endpoint `https://t.lumenstat.com`, OpenTelemetry ingest `https://otlp.lumenstat.com`, docs `https://docs.lumenstat.com`.
- **Web analytics** is a patched Umami v3.5.0 (MIT, PostgreSQL). Four privacy patches: country-only geo (IPs cut to /24 or /48 before lookup, region and city never stored); caller-supplied `ip`, `userAgent`, `browser`, `os`, `device` ignored; query strings stripped except `utm_*`; a random session salt per UTC day kept only in Redis with a 48-hour TTL. No cookies, nothing written to local storage (the tracker only reads the `umami.disabled` opt-out key), no consent banner needed for the tracker itself (see the ePrivacy note on the privacy page). Production sets `SKIP_LOCATION_HEADERS=1` and the image ships the GeoLite database (patch 0005), so the country always comes from the lookup on the cut IP, never from Cloudflare's `cf-ipcountry`.
- **Bot and inflation defense, four layers.** Failing events are stored in `scf_flagged_event`, never counted, with reasons. 1) Real browser: `Origin` must be one of the site's domains and Fetch Metadata headers must be present. 2) Proof of JavaScript: the tracker sends `x-lumenstat-pow`; `sha256(website:slot:url:nonce)` must start with 10 zero bits; slot is the 10-minute window, the current or adjacent one is accepted. 3) Data center: about 8,900 published cloud and hosting ranges (AWS, Google Cloud, Oracle, DigitalOcean, Akamai/Linode, Hetzner, OVH, Contabo, Vultr, Scaleway, Alibaba, Tencent). 4) Many visitors per network: more than 150 new visitors per hour from one /24 or /48 per site (Redis HyperLogLog of HMACs keyed by the daily salt). Umami's own `isbot` and IP block checks still run first. Fetch Metadata is only sent in secure contexts, so sites must use HTTPS.
- **Flag reasons** (exact, from `vendor/umami/src/lib/scf/quality.ts`): `missing_origin`, `not_browser_fetch`, `no_site_domain`, `origin_mismatch` (layer 1), `no_proof`, `bad_proof` (layer 2), `datacenter_ip` (layer 3), `many_visitors_per_network` (layer 4). An event can carry several reasons. Layer 4 counts a visitor only after it passed layers 1 to 3, so blocked scripts cannot push real visitors over the limit. Each layer has its own switch; with none set the fork behaves like upstream Umami.
- **Tracker:** version 1.0.0 at `https://t.lumenstat.com/v/1.0.0/l.js`, 10,447 bytes, integrity `sha384-cBzCCJcHCWSGbuy/f+zavGm/HjUWv77eni4DyLfq+FfKigpin1mul1ekLXILze/3`, served with a one-year immutable cache. Collect endpoint path `/e`. Rebuilt byte for byte by `node scripts/build-tracker.mjs --check` in CI and on every deploy. npm package `@lumenstat/tracker`, published with provenance (the first publish is pending). A released version never changes; a fix ships as a new version.
- **API analytics:** tenants add a second OpenTelemetry exporter with the header `x-scf-ingest-key`. The collector copies the key onto the resource before aggregation (deleting any client-sent value), turns server spans into request counts and latency histograms with spanmetrics, then drops every span, trace and log. Accepted series: `http.server.request.duration`, `http.server.duration`, `traces.span.metrics.duration`. Routes come from `http.route`, else the raw path is normalized: Stellar G, C and M addresses (checksum-validated) → `{account}`, `{contract}`, `{muxed}`; UUIDs, numeric ids, 64-char hex → `{uuid}`, `{id}`, `{hash}`; `0x` hex and long random tokens → `{token}`; query strings, fragments and extra slashes removed. More than 500 routes per service fold into `{other}`. Latency is stored as counts on fixed millisecond buckets (5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000 ms) so p50, p95 and p99 merge across instances and time ranges.
- **Keys:** ingest keys and read keys are random, shown once, stored only as SHA-256 hashes. Projects issue their own ingest key on the Setup page.
- **Metrics API (writer):** `GET /v1/api-metrics/tenants`, `GET /v1/api-metrics/tenants/:id/routes`, Bearer read key, `range=1h|24h|7d|30d` or `from`/`to`. Operator keys see every tenant, tenant keys only their own and get 404 for others. Check `apps/writer/src/server.ts` for exact shapes before writing the reference.
- **Enrollment:** self-service at `https://app.lumenstat.com/signup` with project name, domains, owner email and one Stellar link: a G… account (checked on Horizon mainnet), a C… contract, or a page on communityfund.stellar.org, stellar.expert, stellarchain.io or lumenscan.io. Modes `open`, `approval`, `closed`, with a daily cap.
- **Dashboard:** built with the Stellar Design System. Project screens: Overview, Website, API, Setup, Settings. Operator screens: All projects, Compare, Traffic quality, Enrollment, Keys and health. A project is an Umami team; Umami admins are SCF operators.
- **Infrastructure:** one Docker host in the EU (Germany), no published ports, Cloudflare Tunnel only, DNSSEC, strict TLS. OpenTofu (Cloudflare) and Ansible (host) for staging and production. In the current pilot `t.` and `otlp.` pass through Cloudflare, which therefore sees visitor IPs in transit; the production design serves them DNS-only from EU servers.
- **Privacy statement** is a draft for counsel review (Milestone 1). Say so wherever you summarize it.

## Boundaries

- Don't document internal hosting details: server names, providers' account details, SSH hosts, secrets or IPs.
- Don't document admin-only endpoints (`/v1/admin/*`) beyond saying the operator control API exists.
- Don't promise SLAs, dates or prices.
