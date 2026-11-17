# Privacy and data protection

> **Status: draft for counsel review.** This describes what the code in this repository does today. A privacy lawyer reviews it in Milestone 1, and the reviewed text replaces this draft. Items marked *planned* are not built yet.

Lumenstat gives Stellar ecosystem projects website analytics and API usage numbers without tracking people. It sets no cookies on the sites it measures, stores no IP addresses, and keeps no traces, logs or request bodies from APIs.

## Who is who

- **Projects** (tenants) decide to measure their own websites and APIs. For their visitors' data they are the controller.
- **The Lumenstat operator** runs the service on their behalf and processes that data only to produce their numbers. During the grant period the operator is the Boundless team; after handover it is the community operator SCF names.
- **SCF operators** see aggregate numbers for every project, and flagged-traffic summaries, to assess usage.

## Website visitors

| Data | What happens | Kept |
| --- | --- | --- |
| IP address | Used in memory only: cut to /24 (IPv4) or /48 (IPv6) for the country lookup; combined with the user agent and a random daily salt into the visitor hash; checked against published cloud-provider ranges. Then discarded. | Never stored |
| Country | Derived from the cut IP. Region and city are never derived. | With the event |
| Browser, OS, device type | Reduced from the user agent on our server. The raw user agent is not stored. | With the event |
| Visitor hash | Website + IP + user agent + a random salt that changes every UTC day. The salt lives only in memory (Redis without persistence) and is deleted after 48 hours; after that no one, including us, can link a hash to a person or across days. | With the event |
| Page and referrer | Page path and referrer. Query strings are removed except `utm_*` campaign tags; ad click ids are dropped. | With the event |
| Network counters | For the "many visitors from one network" check: HMACs of the network and visitor under the daily salt, in memory. | 2 hours, never on disk |
| Flagged events | Events that fail the bot and inflation checks: path, referrer domain, country, browser, OS and device, plus the reasons. No IP, no query string. | With the event |
| Cookies, local storage | None. | — |

Event retention: 25 months, then daily totals (*planned*: the retention job ships with Milestone 3; until then nothing is deleted automatically). Projects can ask for a site's data to be deleted for any date range; self-service deletion is *planned* for Milestone 3.

## API traffic

Projects send OpenTelemetry data to our collector with an ingest key. The collector turns spans into counters and latency histograms per route, method and status code, then drops every span, trace and log. Route paths are normalized: account and contract addresses, ids, hashes and tokens become placeholders. API callers' IP addresses, headers and bodies are never stored. Per-minute counters are kept 30 days and rollups 36 months (*planned*: rollups and the retention job ship with Milestone 1).

## Dashboard users

People who sign in to the dashboard (project members and SCF operators) have an account with an email or username and a hashed password. Signing in sets one strictly necessary, http-only session cookie on the dashboard's own domain. Sign-up records the project name, domains, one public Stellar link and the owner's email, so operators can review who enrolled.

## Legal basis (draft position)

- **GDPR:** stored website records hold no personal data once the daily salt is deleted. The brief in-memory use of the IP address rests on legitimate interest, Article 6(1)(f): measuring audience size and protecting projects against faked traffic, with no profiling and no cross-site tracking.
- **ePrivacy:** Lumenstat reads and stores nothing on the visitor's device. Some EEA regulators read Article 5(3) of the ePrivacy Directive as covering cookieless scripts (EDPB Guidelines 2/2023). Member states without an audience-measurement exemption may still require consent; counsel will name them, and this section will list them.

## Where data lives

All storage and processing run on servers in the European Union (Germany). Backups stay in the EU (*planned*: off-site backups ship with Milestone 2).

**Pilot note:** in the current pilot, the tracker (`t.`) and OTLP (`otlp.`) hostnames are served through Cloudflare, so Cloudflare processes visitor IP addresses in transit as a sub-processor. The production design serves those two hostnames directly from our EU servers, so no third-party CDN sees visitors' IPs; only the dashboard stays behind Cloudflare.

## Sub-processors

| Sub-processor | Purpose | Data |
| --- | --- | --- |
| Cloudflare | DNS, TLS, tunnel to our servers; in the pilot also the tracker and OTLP hostnames | IP addresses and requests in transit |
| Our EU server provider | Hosting | Everything listed above, at rest on our servers |

## Requests about your data

Website visitors: because stored data cannot identify you, there is usually nothing to match a request to (GDPR Article 11). Write to the project whose site you visited, or open an issue in this repository.

Dashboard users: you can ask for your account to be exported or deleted by opening an issue or contacting the operator listed on lumenstat.com.
