import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import { rangeWindow } from '@/lib/range';
import { Banner, Card, CopyText, Heading, Text } from '@/lib/sds';
import { loadApiTenant, loadWebSummary } from '@/lib/server/projects';
import { umami } from '@/lib/server/umami';
import { requireProject } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Setup' };

const PUBLIC_UMAMI_URL = process.env.PUBLIC_UMAMI_URL ?? 'http://localhost:3000';
const PUBLIC_COLLECTOR_URL = process.env.PUBLIC_COLLECTOR_URL ?? 'http://localhost:4318';

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span
        className="dot"
        aria-hidden="true"
        style={{ background: ok ? 'var(--sds-clr-green-09)' : 'var(--sds-clr-amber-09)' }}
      />
      <Text as="span" size="sm">
        <strong>{label}:</strong> {detail}
      </Text>
    </div>
  );
}

export default async function GetStartedPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);
  const day = rangeWindow('24h');

  const [web, api, script] = await Promise.all([
    loadWebSummary(viewer.token, project.id, day),
    loadApiTenant(project.id, day),
    umami.trackerScript().catch(() => null),
  ]);
  const sri = script ? `sha384-${createHash('sha384').update(script).digest('base64')}` : null;
  const tenant = api && api !== 'unavailable' ? api : null;

  const snippet = (websiteId: string) =>
    [
      '<script defer',
      `  src="${PUBLIC_UMAMI_URL}/script.js"`,
      sri ? `  integrity="${sri}"` : null,
      '  crossorigin="anonymous"',
      `  data-website-id="${websiteId}"></script>`,
    ]
      .filter(Boolean)
      .join('\n');

  const otel = [
    `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${PUBLIC_COLLECTOR_URL}/v1/traces`,
    'OTEL_EXPORTER_OTLP_TRACES_HEADERS=x-scf-ingest-key=<your ingest key>',
  ].join('\n');

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2 }}>
        <Heading as="h1" size="md" weight="semi-bold">
          Setup
        </Heading>
        <Text as="p" size="sm" addlClassName="muted">
          About 15 minutes. No cookies, no consent banner for your visitors.
        </Text>
      </div>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Is data arriving?
          </Heading>
          <Status
            ok={web.stats.pageviews > 0}
            label="Website"
            detail={web.stats.pageviews > 0 ? `${web.stats.pageviews} page views in the last 24 hours` : 'waiting for the first page view'}
          />
          <Status
            ok={!!tenant && tenant.requests > 0}
            label="API"
            detail={
              api === 'unavailable'
                ? 'status unavailable'
                : tenant
                  ? tenant.requests > 0
                    ? `${tenant.requests} requests in the last 24 hours`
                    : 'connected, waiting for traffic'
                  : 'not connected'
            }
          />
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <div className="stack">
            <Heading as="h2" size="xs" weight="semi-bold">
              Website snippet
            </Heading>
            <Text as="p" size="sm">
              Paste into the <code>&lt;head&gt;</code> of every page. The integrity hash pins this exact tracker: if its bytes change, the
              browser refuses to run it, and you upgrade on purpose.
            </Text>
            {web.websites.length === 0 ? (
              <Banner variant="secondary">No website registered for this project yet. Ask an SCF operator to add your domain.</Banner>
            ) : (
              web.websites.map(site => (
                <div className="stack" key={site.id} style={{ gap: 6 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Text as="span" size="sm" weight="semi-bold">
                      {site.domain ?? site.name}
                    </Text>
                    <CopyText textToCopy={snippet(site.id)} doneLabel="Copied">
                      <button type="button" style={{ font: 'inherit', cursor: 'pointer' }}>
                        Copy snippet
                      </button>
                    </CopyText>
                  </div>
                  <pre className="snippet">{snippet(site.id)}</pre>
                </div>
              ))
            )}
            {!sri ? <Banner variant="warning">Could not compute the integrity hash; the tracker was unreachable.</Banner> : null}
          </div>
        </Card>

        <Card>
          <div className="stack">
            <Heading as="h2" size="xs" weight="semi-bold">
              API (optional)
            </Heading>
            <Text as="p" size="sm">
              Add a second OpenTelemetry trace exporter next to the one you already have. Your own APM keeps full traces; Lumenstat keeps
              only request counts, status codes and timings per route.
            </Text>
            <pre className="snippet">{otel}</pre>
            <Text as="p" size="sm" addlClassName="muted">
              Ingest keys are issued by an SCF operator during the MVP. Self-service keys arrive with enrollment.
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
}
