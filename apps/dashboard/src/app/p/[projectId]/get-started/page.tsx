import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import { rangeWindow } from '@/lib/range';
import { Banner, Card, CopyText, Heading, Text } from '@/lib/sds';
import { loadApiTenant, loadWebSummary } from '@/lib/server/projects';
import { enrollmentForTeam } from '@/lib/server/enrollment';
import { umami } from '@/lib/server/umami';
import { requireProject } from '@/lib/server/viewer';
import { IngestKeyPanel } from './IngestKeyPanel';

export const metadata: Metadata = { title: 'Setup' };

const PUBLIC_UMAMI_URL = process.env.PUBLIC_UMAMI_URL ?? 'http://localhost:3000';
const PUBLIC_COLLECTOR_URL = process.env.PUBLIC_COLLECTOR_URL ?? 'http://localhost:4318';
/** The pinned tracker release shown in snippets (packages/tracker/releases). */
const TRACKER_VERSION = process.env.TRACKER_VERSION ?? '1.0.0';
/** The collect host baked into tracker releases; other deployments add data-host-url. */
const RELEASE_COLLECT_HOST = 'https://t.lumenstat.com';

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
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

  const [web, api, script, enrollment] = await Promise.all([
    loadWebSummary(viewer.token, project.id, day),
    loadApiTenant(project.id, day),
    umami.trackerScript(TRACKER_VERSION).catch(() => null),
    enrollmentForTeam(project.id),
  ]);
  const sri = script ? `sha384-${createHash('sha384').update(script).digest('base64')}` : null;
  const tenant = api && api !== 'unavailable' ? api : null;

  const snippet = (websiteId: string) =>
    [
      '<script defer',
      `  src="${PUBLIC_UMAMI_URL}/v/${TRACKER_VERSION}/l.js"`,
      sri ? `  integrity="${sri}"` : null,
      '  crossorigin="anonymous"',
      PUBLIC_UMAMI_URL !== RELEASE_COLLECT_HOST ? `  data-host-url="${PUBLIC_UMAMI_URL}"` : null,
      `  data-website-id="${websiteId}"></script>`,
    ]
      .filter(Boolean)
      .join('\n');

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
              Paste into the <code>&lt;head&gt;</code> of every page. Tracker {TRACKER_VERSION} lives at its own URL and never changes; the
              integrity hash makes the browser refuse any other bytes, so you upgrade on purpose.
            </Text>
            {web.websites.length === 0 ? (
              <Banner variant="secondary">
                {enrollment?.status === 'pending'
                  ? 'Your snippet appears here once an SCF operator approves the sign-up.'
                  : 'No website registered for this project yet. Ask an SCF operator to add your domain.'}
              </Banner>
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
            <IngestKeyPanel projectId={project.id} collectorUrl={PUBLIC_COLLECTOR_URL} />
          </div>
        </Card>
      </div>
    </div>
  );
}
