import type { Metadata } from 'next';
import Link from 'next/link';
import { RangePicker } from '@/components/RangePicker';
import { RoutesTable } from '@/components/RoutesTable';
import { StatTile } from '@/components/StatTile';
import { count, ms, percent } from '@/lib/format';
import { parseRange, rangeWindow } from '@/lib/range';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { loadApiRoutes, loadApiTenant } from '@/lib/server/projects';
import { requireProject } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'API' };

type Props = { params: Promise<{ projectId: string }>; searchParams: Promise<{ range?: string }> };

export default async function ApiPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const key = parseRange((await searchParams).range);
  const w = rangeWindow(key);

  const api = await loadApiTenant(project.id, w);
  const tenant = api && api !== 'unavailable' ? api : null;
  const routes = tenant ? await loadApiRoutes(tenant.tenantId, w) : [];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            API
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Endpoint traffic from your OpenTelemetry export
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      {api === 'unavailable' ? <Banner variant="warning">API metrics are unavailable right now.</Banner> : null}
      {api === null ? (
        <Banner variant="secondary">
          No API connected to this project. <Link href={`/p/${project.id}/get-started`}>See how to add one.</Link>
        </Banner>
      ) : null}

      {tenant ? (
        <>
          <div className="grid-tiles">
            <StatTile label="Requests" value={count(tenant.requests)} note={`${tenant.routes} routes, ${tenant.services} services`} />
            <StatTile label="5xx rate" value={percent(tenant.errorRate, 2)} note="server errors" />
            <StatTile label="p50 latency" value={ms(tenant.p50Ms)} />
            <StatTile label="p95 latency" value={ms(tenant.p95Ms)} />
          </div>
          <Card noPadding>
            <RoutesTable routes={routes} />
          </Card>
        </>
      ) : null}

      <Text as="p" size="xs" addlClassName="muted">
        Stellar addresses, ids and hashes in paths become {'{account}'}, {'{contract}'}, {'{muxed}'}, {'{id}'} and {'{hash}'}. Set{' '}
        <code>http.route</code> in your middleware to name routes yourself. Traces and logs are never stored.
      </Text>
    </div>
  );
}
