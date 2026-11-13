import type { Metadata } from 'next';
import Link from 'next/link';
import { RangePicker } from '@/components/RangePicker';
import { SimpleTable } from '@/components/SimpleTable';
import { count, duration, ms, percent } from '@/lib/format';
import { parseRange, rangeWindow } from '@/lib/range';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { avgVisitSeconds, bounceRate, loadApiTenant, loadWebSummary } from '@/lib/server/projects';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Compare projects' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { searchParams: Promise<{ range?: string; ids?: string }> };

export default async function ComparePage({ searchParams }: Props) {
  const viewer = await requireOperator();
  const sp = await searchParams;
  const key = parseRange(sp.range);
  const w = rangeWindow(key);
  const ids = [...new Set((sp.ids ?? '').split(',').filter(id => UUID.test(id)))].slice(0, 4);

  const teams = await umami.allTeams(viewer.token);
  const chosen = ids.map(id => teams.find(t => t.id === id)).filter(t => t !== undefined);

  const data = await Promise.all(
    chosen.map(async team => {
      const [web, api] = await Promise.all([loadWebSummary(viewer.token, team.id, w), loadApiTenant(team.id, w)]);
      return { team, web, api: api && api !== 'unavailable' ? api : null };
    }),
  );

  const metric = (label: string, value: (d: (typeof data)[number]) => string) => [label, ...data.map(value)];
  const rows = [
    metric('Unique visitors', d => count(d.web.stats.visitors)),
    metric('Page views', d => count(d.web.stats.pageviews)),
    metric('Bounce rate', d => percent(bounceRate(d.web.stats), 0)),
    metric('Visit duration', d => duration(avgVisitSeconds(d.web.stats))),
    metric('API requests', d => (d.api ? count(d.api.requests) : 'not linked')),
    metric('API 5xx rate', d => percent(d.api?.errorRate ?? null, 2)),
    metric('API p50', d => ms(d.api?.p50Ms ?? null)),
    metric('API p95', d => ms(d.api?.p95Ms ?? null)),
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            Compare projects
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Every project measured by the same pipeline and the same bot rules
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      {data.length < 2 ? (
        <Banner variant="secondary">
          Pick two to four projects on <Link href={`/ops/projects?range=${key}`}>All projects</Link> to compare them here.
        </Banner>
      ) : (
        <Card noPadding>
          <SimpleTable id="compare" columns={['Metric', ...data.map(d => d.team.name)]} rows={rows} numericFrom={1} />
        </Card>
      )}
    </div>
  );
}
