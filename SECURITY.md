# Security policy

Lumenstat measures traffic for many Stellar projects at once, so a flaw here can leak one project's numbers to another or let someone inflate them. We take reports seriously and answer quickly.

## Reporting a vulnerability

Report privately through GitHub: **Security → Report a vulnerability** on this repository. Please do not open a public issue, pull request or discussion for a security problem.

Include what you found, how to reproduce it, and what an attacker could do with it. A proof of concept against your own test project is ideal.

What happens next:

| Step | Target |
| --- | --- |
| We acknowledge your report | within 72 hours |
| We confirm or rule it out, with a severity | within 7 days |
| A confirmed critical or high issue is fixed in production | within 24 hours of confirmation |
| Medium and low issues are fixed | in the next release |
| We publish an advisory and credit you (if you want) | after the fix ships |

## In scope

- Tenant isolation: one project reading or changing another project's web or API data, keys or settings.
- The tracker (`packages/tracker`) and the collect endpoint: script injection, a release whose bytes do not match its published integrity hash, or a way to count fake traffic that the quality checks should catch.
- The OpenTelemetry collector and writer: ingest without a valid key, cross-tenant writes, or traces, spans or request bodies being stored.
- The dashboard: authentication, sign-up, sessions, operator-only pages and actions.
- Our patches to Umami (`patches/umami`) and the deploy configuration in `deploy/` and `infra/`.

## Out of scope

- Volumetric denial of service, and rate limits on public endpoints.
- Social engineering, and physical attacks.
- Vulnerabilities in upstream Umami that our patches do not touch. Please report those to Umami; tell us too if they affect Lumenstat.
- Missing security headers or best practices without a demonstrated impact.

## Safe harbor

We will not take legal action against research done in good faith that stays within this policy: test only against projects you own, do not access or keep other people's data, do not degrade the service, and give us reasonable time to fix the issue before you disclose it.

## Supported versions

The `main` branch is what runs in production. Tracker releases are immutable; a security fix to the tracker ships as a new version, listed in [`packages/tracker/releases.json`](packages/tracker/releases.json), and we tell enrolled projects to upgrade.

## How the service protects data

- Ingest keys and API read keys are random, shown once, and stored only as SHA-256 hashes.
- Visitor IP addresses are never stored. See [PRIVACY.md](PRIVACY.md).
- The servers publish no ports. The only way in is a Cloudflare Tunnel, and only the tracker, the collect endpoint, the OTLP endpoints and the dashboard are routed; Umami's own admin UI and API are not reachable from the internet.
- Secrets live in an environment file on the server (mode 600), never in this repository.
