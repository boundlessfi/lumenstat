import { copy, reasons } from '../../content/copy';
import { facts } from '../../content/facts';
import { site } from '../../site.config';

export const dynamic = 'force-static';

// A short Markdown summary for AI crawlers. Every line restates the page:
// nothing here goes beyond what the page itself says.
export function GET() {
  const links = [
    ...copy.nav.map(item => `- [${item.label}](${site.url}/${item.href})`),
    `- [${copy.enroll}](${site.signupUrl})`,
    ...(site.repoPublic ? [`- [Source code](${site.repoUrl})`] : []),
    ...(site.docsUrl ? [`- [Docs](${site.docsUrl})`] : []),
  ];

  const body = `# Lumenstat

> ${copy.meta.softwareDescription}

Lumenstat is built by ${site.builtBy.name}. It is an independent project, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.

## Web analytics

- Runs Umami ${facts.tracker.umami} with four small, documented patches.
- Location stops at the country. IP addresses are cut to /24 or /48.
- Visitor hashes use a random daily salt that is deleted after 48 hours.
- Query strings are stripped, except utm_* tags.
- No cookies and no consent banner.

## Bot and inflation defense

- Every event passes four checks: real-browser origin and Fetch Metadata, proof of JavaScript, about 8,900 data-center IP ranges, and a per-network visitor limit.
- Events that fail are stored as "flagged, not counted", with a reason such as "${reasons.noProof}" or "${reasons.dataCenter}".
- Projects and program operators can both see flagged events.

## Tracker supply chain

- Versioned, immutable URL: ${facts.tracker.url}
- Subresource Integrity: ${facts.tracker.integrity}
- ${facts.tracker.bytesLabel} bytes, released ${facts.tracker.released}.
- The build is reproducible byte for byte and is checked in CI and on every deploy.
- Published to npm as @lumenstat/tracker with provenance.
- Verify it: \`${facts.verifyCommand}\`

## API analytics

- Projects add a second OpenTelemetry exporter with their own ingest key. Keys are hashed at rest.
- The collector turns spans into per-route counts with p50, p95 and p99 latency, then drops traces and logs.
- Stellar G, C and M addresses, ids and hashes in paths become placeholders such as {account}, {contract} and {hash}.

## Enrollment

- Projects sign up with a domain and one Stellar link: an SCF project page, a stellar.expert page, or a Stellar account checked on Horizon mainnet.
- Programs can run sign-up open or with approval.

## Infrastructure

- One Docker host in the EU, with no published ports, reached through Cloudflare Tunnel.
- DNSSEC on the domain. The whole setup is described as code with OpenTofu and Ansible.

## Links

${links.join('\n')}
`;

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
