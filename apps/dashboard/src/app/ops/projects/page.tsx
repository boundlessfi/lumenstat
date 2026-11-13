import type { Metadata } from 'next';
import { type ProjectRow, ProjectsTable } from '@/components/ProjectsTable';
import { RangePicker } from '@/components/RangePicker';
import { SimpleTable } from '@/components/SimpleTable';
import { count } from '@/lib/format';
import { parseRange, rangeWindow } from '@/lib/range';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { loadWebSummary } from '@/lib/server/projects';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';
import { writer } from '@/lib/server/writer';

export const metadata: Metadata = { title: 'All projects' };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const viewer = await requireOperator();
  const key = parseRange((await searchParams).range);
  const w = rangeWindow(key);

  const [teams, tenants] = await Promise.all([umami.allTeams(viewer.token), writer.tenants(w).catch(() => null)]);

  const rows: ProjectRow[] = await Promise.all(
    teams.map(async team => {
      const web = await loadWebSummary(viewer.token, team.id, w);
      const tenant = tenants?.find(t => t.umamiTeamId === team.id) ?? null;
      return {
        id: team.id,
        name: team.name,
        websites: web.websites.length,
        visitors: web.stats.visitors,
        pageviews: web.stats.pageviews,
        apiRequests: tenant ? tenant.requests : null,
        errorRate: tenant?.errorRate ?? null,
        p95Ms: tenant?.p95Ms ?? null,
      };
    }),
  );
  rows.sort((a, b) => b.visitors + (b.apiRequests ?? 0) - (a.visitors + (a.apiRequests ?? 0)));

  const teamIds = new Set(teams.map(t => t.id));
  const unlinked = (tenants ?? []).filter(t => !t.umamiTeamId || !teamIds.has(t.umamiTeamId));

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            All projects
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Same pipeline and same bot rules for every project
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      {tenants === null ? <Banner variant="warning">API metrics are unavailable right now; API columns are empty.</Banner> : null}

      <Card>
        <ProjectsTable rows={rows} range={key} />
      </Card>

      {unlinked.length > 0 ? (
        <Card>
          <div className="stack">
            <Heading as="h2" size="xs" weight="semi-bold">
              API tenants not linked to a project
            </Heading>
            <Text as="p" size="sm" addlClassName="muted">
              Their API data is stored but shows on no project page until linked. Link one with{' '}
              <code>npm run tenant:link -- &lt;tenant id&gt; &lt;project id&gt;</code> in <code>apps/writer</code>.
            </Text>
            <SimpleTable
              id="unlinked"
              columns={['API tenant', 'Tenant id', 'Requests']}
              rows={unlinked.map(t => [t.name, t.tenantId, count(t.requests)])}
              numericFrom={2}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
