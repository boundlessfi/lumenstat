# Lumenstat

**Proof of usage for the Stellar ecosystem.** Privacy-first web and API analytics for projects building on Stellar, run as a shared service for the Stellar Community Fund. This repo is the MVP for the SCF RFP *Web and API Analytics for Stellar Ecosystem Projects*.

- **Web:** a patched [Umami](https://github.com/umami-software/umami) v3.5.0 (MIT, PostgreSQL). No cookies, country-only geography, a random daily salt that expires after 48 hours. Four bot and inflation checks; traffic that fails them is stored as flagged and never counted.
- **Tracker:** versioned, immutable releases with SRI hashes (`packages/tracker`, also an npm package), on ad-block-safe paths.
- **Enrollment:** projects sign up themselves at `/signup` with their domains and a Stellar link, and get a snippet and an API ingest key in minutes.
- **API:** tenants dual-export OpenTelemetry to our collector. Traces and logs are dropped; only request counts, status codes and latency histograms are kept, per normalized route, in PostgreSQL.

## Try it

Live at **[app.lumenstat.com](https://app.lumenstat.com)**.

1. **Enroll a test project** at [app.lumenstat.com/signup](https://app.lumenstat.com/signup): a project name, a domain, and a Stellar link (your SCF project page, a page on stellar.expert, or a G… or C… address). You land on the Setup page with your snippet.
2. **Send fake traffic** the way an inflator would, with the website id from your snippet:
   ```bash
   node scripts/fake-event.mjs --site <website id> --domain <your domain> --level forged
   ```
   Open **Website** in the dashboard: the page views do not move, and the events appear under **Flagged, not counted** with the reason.
3. **Check the tracker you embed** against its release notes:
   ```bash
   curl -s https://t.lumenstat.com/v/1.0.0/l.js | openssl dgst -sha384 -binary | openssl base64 -A
   ```
   The output must match the hash in [`packages/tracker/releases.json`](packages/tracker/releases.json) and in your snippet.

## What runs

| Service | What it does | Port (local) |
| --- | --- | --- |
| `postgres` | One database: Umami's tables in `public`, API metrics in `scf_api` | 5440 |
| `redis` | Daily salts and per-network visitor counters. Persistence is off: nothing is written to disk | 6380 |
| `umami` | Tracker, collect endpoint, tenant web dashboards (`vendor/umami` + `patches/umami`) | 3000 |
| `collector` | OpenTelemetry Collector: tenant stamping, spanmetrics, drops traces and logs | 4317, 4318 |
| `writer` | Stores API metrics, serves the metrics API and the API dashboard (`apps/writer`) | 8090 |
| `test-site`, `test-api` | Examples (`--profile examples`): a tracked site and an instrumented API | 8088, 3100, 3101 |
| `dashboard` | The UI project teams and SCF operators use, built with the Stellar Design System (`apps/dashboard`, runs on the host for now) | 3200 |

## Run it locally

```bash
scripts/setup-env.sh                       # writes .env with random secrets
scripts/sync-umami.sh                      # vendor/umami = Umami v3.5.0 + our patches
docker compose up -d --build               # core services
node scripts/seed-dev.mjs                  # registers the test site, pins the tracker's SRI hash
scripts/create-api-tenant.sh               # API tenant + ingest key (saved to .env) + tenant read key
docker compose --profile examples up -d    # test site on :8088, test API on :3100/:3101
scripts/traffic.sh                         # API traffic, including Stellar addresses in paths
```

Then:

- Web dashboard: http://localhost:3000 (first-run login `admin` / `umami`; change it).
- Visit http://localhost:8088 to generate page views.
- API dashboard: http://localhost:8090/dashboard with the read key from `create-api-tenant.sh`, or the operator key in `.env`.
- `scripts/smoke-web.sh <website id>` shows which requests the collect endpoint counts and which it rejects.

### Without building the app images

If Docker Hub is slow or unreachable, run only the data services in Docker and the apps on the host (Node 24 and pnpm 12):

```bash
docker compose up -d postgres redis
SCF_WRITER_ENDPOINT=http://host.docker.internal:8090 docker compose up -d --no-deps collector
set -a; . ./.env; set +a
export DATABASE_URL="postgresql://scf:${POSTGRES_PASSWORD}@127.0.0.1:5440/scf"

(cd apps/writer && npm ci && PORT=8090 node src/server.ts) &
(cd vendor/umami && pnpm install --frozen-lockfile && APP_SECRET="$UMAMI_APP_SECRET" SKIP_BUILD_GEO=1 pnpm build \
  && REDIS_URL=redis://127.0.0.1:6380 APP_SECRET="$UMAMI_APP_SECRET" SKIP_LOCATION_HEADERS=1 \
     SCF_COUNTRY_ONLY=1 SCF_FRONTEND_ONLY=1 SCF_STRIP_QUERY=1 SCF_RANDOM_DAILY_SALT=1 SCF_ENFORCE_ORIGIN=1 pnpm start) &
python3 -m http.server 8088 --bind 127.0.0.1 --directory examples/test-site &
(cd examples/test-api && npm ci && SCF_INGEST_KEY="$TEST_API_INGEST_KEY" npm start) &
```

`SKIP_BUILD_GEO=1` skips the GeoLite download; local IPs have no country anyway.

## Verified so far (13 Nov 2026, host mode above)

- Writer: 22 unit tests pass; typecheck clean. Umami: 121 tests pass, including the SCF patches, and the patched app builds.
- API path: test API → collector → writer → PostgreSQL. Express routes keep their templates; raw paths become `/legacy/accounts/{account}/balance`, `/legacy/contracts/{contract}/events`, `/legacy/pay/{muxed}`, `/legacy/orders/{id}`. Internal spans are dropped; 5xx and p50/p95/p99 show per route.
- Isolation: data lands under the tenant of the ingest key, even with a forged `scf.ingest_key` in the payload. Keyless data is dropped. The writer refuses posts without the collector secret. A tenant read key sees only its tenant and gets 404 for others.
- Web path: a real browser visit stored page views and a custom event; a `session_token` query parameter was stripped to `utm_source` only; no region or city stored. Server-side posts, missing Fetch Metadata, foreign origins and bot user agents were rejected and counted per reason in Redis. The day's salt sits in Redis with a 48-hour TTL.
- Not yet run: the `umami`, `writer`, `test-site` and `test-api` images via `docker compose up --build` (Docker Hub was unreachable for the `node` and `nginx` base images during this session).

## Privacy and anti-inflation switches (Umami patches)

All are off unless set, so the fork behaves like upstream without them. Each patch is one commit in `patches/umami`.

| Env var | Effect |
| --- | --- |
| `SCF_COUNTRY_ONLY` | IPs are cut to /24 (IPv4) or /48 (IPv6) before the geo lookup; region and city are never stored |
| `SCF_FRONTEND_ONLY` | Ignores caller-supplied `ip`, `userAgent`, `browser`, `os`, `device` on the collect endpoint |
| `SCF_STRIP_QUERY` | Stores `utm_*` only; drops other query parameters, ad click ids and referrer queries |
| `SCF_RANDOM_DAILY_SALT` | Random session salt per UTC day in Redis, 48-hour TTL, never in the database |

### Bot and inflation checks (the quality flag)

Events that fail any check are stored in `scf_flagged_event`, apart from Umami's own tables, so they never reach a project's numbers. Operators see them under **Traffic quality**, with the reasons. Flagged rows keep the path, referrer domain, country and coarse device, never the IP or query string.

| Layer | Env var | Flags an event when |
| --- | --- | --- |
| 1. Real browser | `SCF_ENFORCE_ORIGIN` | the `Origin` is not one of the site's domains, or browser Fetch Metadata headers are missing |
| 2. Proof of JavaScript | `SCF_POW_BITS` (10) | the tracker's proof-of-work header is missing or wrong: `sha256(site:slot:url:nonce)` must start with N zero bits, slot being the 10-minute window |
| 3. Data center | `SCF_DATACENTER_RANGES` | the IP is in a published cloud or hosting range (`deploy/datacenter-ranges.txt`, rebuilt by `scripts/update-datacenter-ranges.mjs`) |
| 4. Many visitors per network | `SCF_MAX_VISITORS_PER_IP_HOUR` | a site sees more new visitors than the limit from one /24 or /48 in an hour (counted in a Redis HyperLogLog under HMACs keyed by the daily salt) |

Try it: `node scripts/fake-event.mjs --site <website id> --level naive|forged|proof` sends scripted page views the way an inflator would; they show up as flagged, not counted.

Fetch Metadata headers are sent only in secure contexts (HTTPS or localhost), so sites must serve over HTTPS.

## Tracker releases

`node scripts/build-tracker.mjs` builds the tracker from `vendor/umami` and records it in `packages/tracker/releases/<version>.js` with its SRI hash in `releases.json`. A released version must rebuild byte for byte (`--check`, also run by `deploy/deploy.sh`); to change the tracker, bump the version. Releases are served at `https://t.<domain>/v/<version>/l.js` with a one-year immutable cache, and published to npm as `@lumenstat/tracker`.

## API metrics

Accepted series: `http.server.request.duration` (stable semconv), `http.server.duration` (old semconv) and spanmetrics' `traces.span.metrics.duration` from server spans. Routes come from `http.route` when the tenant sets it; otherwise the raw path is normalized:

| Pattern | Becomes |
| --- | --- |
| Stellar G-, C-, M-addresses (checksum-validated with `@stellar/stellar-sdk`) | `{account}`, `{contract}`, `{muxed}` |
| UUIDs, numeric ids, 64-char hex hashes | `{uuid}`, `{id}`, `{hash}` |
| `0x` hex and long random-looking tokens | `{token}` |
| Query strings, fragments, trailing and doubled slashes | removed |

More than 500 routes per service fold into `{other}`. Latency is stored as counts on fixed millisecond buckets, so p50, p95 and p99 can be merged across instances and time ranges.

Metrics API (Bearer read key): `GET /v1/api-metrics/tenants` and `GET /v1/api-metrics/tenants/:id/routes`, with `range=1h|24h|7d|30d` or `from`/`to`. Operator keys see every tenant; tenant keys see only their own. Keys: `npm run key:create -- --label <who> [--tenant <id>] [--days <n>]`, `npm run key:revoke -- <id>` in `apps/writer`.

## Dashboard

`apps/dashboard` is a Next.js app built with the [Stellar Design System](https://github.com/stellar/stellar-design-system) (`@stellar/design-system` 4.0.2). Umami's own UI stays available for admin work, but project teams and SCF operators use this one.

- **Who is who:** sign-in uses Umami accounts. A project is an Umami team. Members see their team's project; Umami admins are SCF operators and also get the operator screens. Identity is checked with Umami on every request; the session cookie holds only the Umami token.
- **Website data** is read with the viewer's own Umami token, so Umami enforces which sites they can see.
- **API data** is read with the dashboard's operator key and filtered on the server to the API tenant linked to the project (`npm run tenant:link -- <tenant id> <team id>` in `apps/writer`).
- **Screens:** Overview, Website, API, Setup (pinned snippet with SRI hash, live "is data arriving" check, self-service ingest keys), Settings; and for operators All projects, Compare, Traffic quality, Enrollment (with the approval queue), Keys and health.
- **Enrollment:** `/signup` creates the owner's Umami account and team, then (by `ENROLLMENT_MODE`) approves at once (`open`), waits for an operator (`approval`), or is off (`closed`). Approval creates one Umami website per domain and the API tenant. The Stellar link must be a valid G… account (checked on Horizon mainnet), a C… contract, or a page on communityfund.stellar.org, stellar.expert, stellarchain.io or lumenscan.io. The dashboard needs `UMAMI_ADMIN_PASSWORD` for this, and the writer's operator key.

```bash
cd apps/dashboard
cp .env.example .env.local     # WRITER_API_KEY: npm run key:create -- --label dashboard (in apps/writer)
npm ci && npm run build && npm start   # http://localhost:3200
```

Verified locally on 13 Nov 2026: an admin sees every project and the operator screens; a team member lands on their own project, and gets a 404 for operator pages and for another team's project.

## Tests

```bash
cd apps/writer && npm test                                   # normalization, histograms, OTLP parsing, tenant mapping
cd vendor/umami && pnpm vitest run src/lib/scf               # the Umami patches
cd apps/dashboard && npm run build                           # type checks every page
```

## Not built yet

Tracked against the RFP milestones:

- Milestone 1, outside the code: counsel review of [PRIVACY.md](PRIVACY.md), the first npm publish of `@lumenstat/tracker`, Boundless instrumented in production.
- Multiple domains per Umami website (each domain is its own website today).
- Approval queue: suspend and remove, anomaly view, CSV export and deletion, API trend charts, operator read-key management in the UI.
- Aggregated queries for the operator screens (today they call Umami once per project and site).
- API metric rollups (hourly, daily) and retention jobs.
- Edge authentication of ingest keys at the collector (the writer drops unknown keys today), NATS buffer, monitoring, backups and runbooks.

## License

MIT. Umami is MIT; our patches to it are MIT too.
