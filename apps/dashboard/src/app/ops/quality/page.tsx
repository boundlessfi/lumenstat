import type { Metadata } from 'next';
import Link from 'next/link';
import { RangePicker } from '@/components/RangePicker';
import { SimpleTable } from '@/components/SimpleTable';
import { count, percent } from '@/lib/format';
import { reasonLabel } from '@/lib/quality';
import { parseRange, rangeWindow } from '@/lib/range';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Traffic quality' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reasonText = (reasons: Record<string, number>) =>
  Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${reasonLabel(r)} (${count(n)})`)
    .join(', ') || '—';

type Props = { searchParams: Promise<{ range?: string; site?: string }> };

export default async function QualityPage({ searchParams }: Props) {
  const viewer = await requireOperator();
  const sp = await searchParams;
  const key = parseRange(sp.range);
  const w = rangeWindow(key);
  const site = sp.site && UUID.test(sp.site) ? sp.site : undefined;

  const teams = await umami.allTeams(viewer.token);
  const sites = (
    await Promise.all(
      teams.map(async team => (await umami.teamWebsites(viewer.token, team.id).catch(() => [])).map(s => ({ ...s, team }))),
    )
  ).flat();

  const [flagged, counted] = await Promise.all([
    umami.flagged(viewer.token, w, site).catch(() => null),
    Promise.all(sites.map(async s => [s.id, (await umami.stats(viewer.token, s.id, w).catch(() => null))?.pageviews ?? 0] as const)),
  ]);
  const countedBySite = new Map(counted);
  const flaggedBySite = new Map((flagged?.websites ?? []).map(f => [f.websiteId, f]));

  const rows = sites
    .map(s => {
      const f = flaggedBySite.get(s.id);
      const good = countedBySite.get(s.id) ?? 0;
      const bad = f?.events ?? 0;
      return { s, good, bad, reasons: f?.reasons ?? {} };
    })
    .sort((a, b) => b.bad - a.bad || b.good - a.good);

  const focus = site ? sites.find(s => s.id === site) : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <div className="stack" style={{ gap: 2 }}>
          <Heading as="h1" size="md" weight="semi-bold">
            Traffic quality
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Events that failed the bot and inflation checks. They are stored, flagged and never counted in a project’s numbers.
          </Text>
        </div>
        <RangePicker value={key} />
      </div>

      {flagged === null ? <Banner variant="error">Flagged traffic is unavailable (Umami unreachable).</Banner> : null}

      <Card noPadding>
        <SimpleTable
          id="quality"
          columns={['Project', 'Website', 'Counted page views', 'Flagged events', 'Flagged share', 'Why']}
          numericColumns={[2, 3, 4]}
          rows={rows.map(({ s, good, bad, reasons }) => [
            s.team.name,
            s.domain ?? s.name,
            count(good),
            count(bad),
            percent(good + bad > 0 ? bad / (good + bad) : null, 1),
            reasonText(reasons),
          ])}
          emptyMessage="No websites yet"
        />
      </Card>

      <Text as="p" size="sm" addlClassName="muted">
        Inspect a site:{' '}
        {rows
          .filter(r => r.bad > 0)
          .slice(0, 12)
          .map(({ s }, i) => (
            <span key={s.id}>
              {i ? ' · ' : ''}
              <Link href={`/ops/quality?range=${key}&site=${s.id}`}>{s.domain ?? s.name}</Link>
            </span>
          ))}
        {rows.every(r => r.bad === 0) ? 'nothing flagged in this period.' : null}
      </Text>

      {focus && flagged?.recent ? (
        <Card noPadding>
          <div className="stack" style={{ padding: 16, gap: 2 }}>
            <Heading as="h2" size="xs" weight="semi-bold">
              Latest flagged events on {focus.domain ?? focus.name}
            </Heading>
            <Text as="p" size="sm" addlClassName="muted">
              Path, referrer domain, country and coarse device only. No IP addresses or query strings are stored.
            </Text>
          </div>
          <SimpleTable
            id="recent"
            columns={['Time (UTC)', 'Path', 'Why', 'Referrer', 'Country', 'Client']}
            rows={flagged.recent.map(e => [
              e.createdAt.slice(0, 19).replace('T', ' '),
              e.eventName ? `${e.urlPath ?? ''} (event: ${e.eventName})` : (e.urlPath ?? '—'),
              e.reasons.map(r => reasonLabel(r)).join(', '),
              e.referrerDomain ?? '—',
              e.country ?? '—',
              [e.browser, e.os, e.device].filter(Boolean).join(' · ') || '—',
            ])}
            emptyMessage="Nothing flagged on this site in this period"
          />
        </Card>
      ) : null}
    </div>
  );
}
