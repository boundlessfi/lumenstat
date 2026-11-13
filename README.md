# SCF Analytics

Privacy-first web and API analytics for projects building on Stellar, run as a shared service for the Stellar Community Fund. This repo is the MVP for the SCF RFP *Web and API Analytics for Stellar Ecosystem Projects*.

- **Web:** a patched [Umami](https://github.com/umami-software/umami) v3.5.0 (MIT, PostgreSQL). No cookies, country-only geography, a random daily salt that expires after 48 hours, and only browser events from a site's own domains are counted.
- **API:** tenants dual-export OpenTelemetry to our collector. Traces and logs are dropped; only request counts, status codes and latency histograms are kept, per normalized route, in PostgreSQL.

## What runs

| Service | What it does | Port (local) |
| --- | --- | --- |
| `postgres` | One database: Umami's tables in `public`, API metrics in `scf_api` | 5440 |
| `redis` | Daily salts and rejection counters. Persistence is off: nothing is written to disk | 6380 |
| `umami` | Tracker, collect endpoint, tenant web dashboards (`vendor/umami` + `patches/umami`) | 3000 |
| `collector` | OpenTelemetry Collector: tenant stamping, spanmetrics, drops traces and logs | 4317, 4318 |
| `writer` | Stores API metrics, serves the metrics API and the API dashboard (`apps/writer`) | 8090 |
| `test-site`, `test-api` | Examples (`--profile examples`): a tracked site and an instrumented API | 8088, 3100, 3101 |

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
| `SCF_FRONTEND_ONLY` | Ignores caller-supplied `ip`, `userAgent`, `browser`, `os`, `device` on `/api/send` |
| `SCF_STRIP_QUERY` | Stores `utm_*` only; drops other query parameters, ad click ids and referrer queries |
| `SCF_RANDOM_DAILY_SALT` | Random session salt per UTC day in Redis, 48-hour TTL, never in the database |
| `SCF_ENFORCE_ORIGIN` | Counts an event only with an `Origin` on the site's domain and browser Fetch Metadata headers; rejections are counted in Redis per site, reason and day |

Fetch Metadata headers are sent only in secure contexts (HTTPS or localhost), so sites must serve over HTTPS.

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

## Tests

```bash
cd apps/writer && npm test                                   # normalization, histograms, OTLP parsing, tenant mapping
cd vendor/umami && pnpm vitest run src/lib/scf               # the Umami patches
```

## Not in this MVP yet

Tracked against the RFP milestones:

- Versioned, immutable tracker URLs and an npm package with provenance (the seed pins today's tracker with SRI).
- Ad-blocker-safe script and endpoint names (`TRACKER_SCRIPT_NAME`, `COLLECT_API_ENDPOINT` need build-time wiring in the image).
- Flagged-but-stored events, proof-of-work, per-IP fingerprint counting and data-center ranges (only the origin and fetch-metadata layer is in).
- Multiple domains per site (Umami's domain field accepts one).
- SCF operator role and global web dashboard inside Umami; tenant enrollment flow and approval mode.
- API metric rollups (hourly, daily) and retention jobs; the API dashboard inside Umami.
- Edge authentication of ingest keys at the collector (the writer drops unknown keys today), NATS buffer, OpenTofu and Ansible, monitoring, backups and runbooks.

## License

MIT. Umami is MIT; our patches to it are MIT too.
