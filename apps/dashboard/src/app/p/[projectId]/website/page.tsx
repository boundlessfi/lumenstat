import type { Metadata } from 'next';
import { MetricList } from '@/components/MetricList';
import { RangePicker } from '@/components/RangePicker';
import { StatTile } from '@/components/StatTile';
import { TrendChart } from '@/components/TrendChart';
import { count, duration, percent } from '@/lib/format';
import { reasonLabel } from '@/lib/quality';
import { parseRange, RANGES, rangeWindow } from '@/lib/range';
import { Card, Heading, Text } from '@/lib/sds';
import { fillSeries } from '@/lib/series';
import { avgVisitSeconds, bounceRate, loadFlagged, loadTopMetric, loadWebSummary } from '@/lib/server/projects';
import type { MetricType } from '@/lib/server/umami';
import { requireProject } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Website' };

const PANELS: { type: MetricType; title: string }[] = [
  { type: 'path', title: 'Pages' },
  { type: 'referrer', title: 'Referrers' },
  { type: 'country', title: 'Countries' },
  { type: 'browser', title: 'Browsers' },
  { type: 'device', title: 'Devices' },
  { type: 'event', title: 'Custom events' },
];

type Props = { params: Promise<{ projectId: string }>; searchParams: Promise<{ range?: string }> };

export default async function WebsitePage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);
  const key = parseRange((await searchParams).range);
  const w = rangeWindow(key);

  const web = await loadWebSummary(viewer.token, project.id, w);
  const [panels, flagged] = await Promise.all([
    Promise.all(PANELS.map(async panel => ({ ...panel, items: await loadTopMetric(viewer.token, web.websites, panel.type, w) }))),
    loadFlagged(web.websites, w),
  ]);
  const flaggedItems = flagged
    ? Object.entries(flagged.reasons)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, n]) => ({ x: reasonLabel(reason), y: n }))
    : [];
  const domains = web.websites.map(site => site.domain).filter(Boolean).join(' · ');

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            Website
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            {domains || 'No websites connected yet'}
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      <div className="grid-tiles">
        <StatTile label="Page views" value={count(web.stats.pageviews)} />
        <StatTile label="Unique visitors" value={count(web.stats.visitors)} note="counted per day" />
        <StatTile label="Visit duration" value={duration(avgVisitSeconds(web.stats))} note="average" />
        <StatTile label="Bounce rate" value={percent(bounceRate(web.stats), 0)} note="one-page visits" />
      </div>

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

      <div className="grid-3">
        {panels.map(panel => (
          <MetricList key={panel.type} title={panel.title} items={panel.items} />
        ))}
        {flagged ? (
          <MetricList
            title={`Flagged, not counted: ${count(flagged.events)}`}
            items={flaggedItems}
            empty="Nothing flagged in this range"
          />
        ) : null}
      </div>

      <Text as="p" size="xs" addlClassName="muted">
        Unique visitors are counted per day. The salt behind each visitor hash is deleted after 48 hours, so no one is followed across
        days. Location is country only. Events that fail the bot and inflation checks are kept apart as flagged and are not in any number
        above.
      </Text>
    </div>
  );
}
