import type { Metadata } from 'next';
import Link from 'next/link';
import { MetricList } from '@/components/MetricList';
import { RangePicker } from '@/components/RangePicker';
import { StatTile } from '@/components/StatTile';
import { TrendChart } from '@/components/TrendChart';
import { count, duration, ms, percent } from '@/lib/format';
import { parseRange, RANGES, rangeWindow } from '@/lib/range';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { fillSeries } from '@/lib/series';
import { avgVisitSeconds, bounceRate, loadApiRoutes, loadApiTenant, loadTopMetric, loadWebSummary } from '@/lib/server/projects';
import { requireProject } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Overview' };

type Props = { params: Promise<{ projectId: string }>; searchParams: Promise<{ range?: string }> };

export default async function OverviewPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);
  const key = parseRange((await searchParams).range);
  const w = rangeWindow(key);

  const [web, api] = await Promise.all([loadWebSummary(viewer.token, project.id, w), loadApiTenant(project.id, w)]);
  const tenant = api && api !== 'unavailable' ? api : null;
  const [pages, routes] = await Promise.all([
    loadTopMetric(viewer.token, web.websites, 'path', w, 5),
    tenant ? loadApiRoutes(tenant.tenantId, w) : Promise.resolve([]),
  ]);
  const nothingConnected = web.websites.length === 0 && !tenant;

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            {project.name}
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Website and API usage · {RANGES[key].label.toLowerCase()}
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      {nothingConnected ? (
        <Banner variant="primary">
          Nothing is connected yet. <Link href={`/p/${project.id}/get-started`}>Set up your website and API</Link> to start collecting.
        </Banner>
      ) : null}

      <section className="stack" aria-labelledby="web-summary">
        <h2 id="web-summary" className="section-title">
          Website
        </h2>
        <div className="grid-tiles">
          <StatTile label="Unique visitors" value={count(web.stats.visitors)} note="counted per day" />
          <StatTile label="Page views" value={count(web.stats.pageviews)} />
          <StatTile label="Bounce rate" value={percent(bounceRate(web.stats), 0)} note="one-page visits" />
          <StatTile label="Visit duration" value={duration(avgVisitSeconds(web.stats))} note="average" />
        </div>
      </section>

      <section className="stack" aria-labelledby="api-summary">
        <h2 id="api-summary" className="section-title">
          API
        </h2>
        {api === 'unavailable' ? (
          <Banner variant="warning">API metrics are unavailable right now.</Banner>
        ) : tenant ? (
          <div className="grid-tiles">
            <StatTile label="Requests" value={count(tenant.requests)} />
            <StatTile label="5xx rate" value={percent(tenant.errorRate, 2)} note="server errors" />
            <StatTile label="p50 latency" value={ms(tenant.p50Ms)} note="half of requests are faster" />
            <StatTile label="p95 latency" value={ms(tenant.p95Ms)} note="95% of requests are faster" />
          </div>
        ) : (
          <Banner variant="secondary">
            No API connected. <Link href={`/p/${project.id}/get-started`}>Add an OpenTelemetry export</Link> to see endpoint traffic here.
          </Banner>
        )}
      </section>

      <Card>
        <TrendChart
          title={`Page views and visitors, ${RANGES[key].label.toLowerCase()}`}
          bars={fillSeries(web.series.pageviews, w)}
          line={fillSeries(web.series.visitors, w)}
          barLabel="Page views"
          lineLabel="Visitors"
          unit={w.unit}
        />
      </Card>

      <div className="grid-2">
        <MetricList title="Top pages" items={pages} />
        <MetricList
          title="Busiest API routes"
          items={routes.slice(0, 5).map(r => ({ x: `${r.method} ${r.route}`, y: r.requests }))}
          empty={tenant ? 'No API traffic in this range' : 'No API connected'}
        />
      </div>

      <Text as="p" size="xs" addlClassName="muted">
        No cookies. Country-level location only. Visitors are summed across this project&apos;s sites.
      </Text>
    </div>
  );
}
