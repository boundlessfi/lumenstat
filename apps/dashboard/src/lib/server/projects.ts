import 'server-only';
import type { Window } from '@/lib/range';
import { asAdmin } from './admin';
import { type MetricType, type Point, type UmamiWebsite, type WebStats, umami } from './umami';
import { type ApiRoute, type ApiTenant, writer } from './writer';

export interface WebSummary {
  websites: UmamiWebsite[];
  stats: WebStats;
  series: { pageviews: Point[]; visitors: Point[] };
}

const EMPTY_STATS: WebStats = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 };

function addSeries(into: Map<string, number>, points: Point[]) {
  for (const p of points) into.set(p.x, (into.get(p.x) ?? 0) + p.y);
}

function toSeries(map: Map<string, number>): Point[] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, y]) => ({ x, y }));
}

/**
 * Website numbers for a project: every website in its Umami team, summed. Umami
 * checks the viewer's token on each call, so a viewer can never read another
 * team's websites. Visitors are summed per site, so someone who visits two of a
 * project's domains counts twice.
 */
export async function loadWebSummary(token: string, teamId: string, w: Window): Promise<WebSummary> {
  const websites = await umami.teamWebsites(token, teamId);
  const stats = { ...EMPTY_STATS };
  const pageviews = new Map<string, number>();
  const visitors = new Map<string, number>();

  await Promise.all(
    websites.map(async site => {
      const [s, series] = await Promise.all([umami.stats(token, site.id, w), umami.pageviews(token, site.id, w)]);
      stats.pageviews += s.pageviews;
      stats.visitors += s.visitors;
      stats.visits += s.visits;
      stats.bounces += s.bounces;
      stats.totaltime += s.totaltime;
      addSeries(pageviews, series.pageviews);
      addSeries(visitors, series.sessions);
    }),
  );

  return { websites, stats, series: { pageviews: toSeries(pageviews), visitors: toSeries(visitors) } };
}

/** Top values for one dimension (pages, referrers, countries...) across a project's websites. */
export async function loadTopMetric(
  token: string,
  websites: UmamiWebsite[],
  type: MetricType,
  w: Window,
  limit = 8,
): Promise<Point[]> {
  const totals = new Map<string, number>();
  const lists = await Promise.all(websites.map(site => umami.metrics(token, site.id, type, w, limit)));
  for (const list of lists) addSeries(totals, list);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([x, y]) => ({ x, y }));
}

/**
 * The API tenant linked to this project's Umami team, or null. The writer call
 * uses the dashboard's operator key, so this filter is what keeps each viewer to
 * their own project's API data.
 */
export async function loadApiTenant(teamId: string, w: Window): Promise<ApiTenant | null | 'unavailable'> {
  try {
    return (await writer.tenants(w)).find(t => t.umamiTeamId === teamId) ?? null;
  } catch {
    return 'unavailable';
  }
}

export async function loadApiRoutes(tenantId: string, w: Window): Promise<ApiRoute[]> {
  return writer.routes(tenantId, w);
}

export function bounceRate(stats: WebStats): number | null {
  return stats.visits > 0 ? stats.bounces / stats.visits : null;
}

export function avgVisitSeconds(stats: WebStats): number | null {
  return stats.visits > 0 ? stats.totaltime / stats.visits : null;
}

/**
 * Flagged traffic for a project's own websites: events that failed the bot and
 * inflation checks and were not counted. Read with the admin token and filtered
 * here to the project's websites, so a project sees only its own.
 */
export async function loadFlagged(
  websites: UmamiWebsite[],
  w: Window,
): Promise<{ events: number; reasons: Record<string, number> } | null> {
  try {
    const ids = new Set(websites.map(site => site.id));
    const { websites: rows } = await asAdmin(token => umami.flagged(token, w));
    const reasons: Record<string, number> = {};
    let events = 0;
    for (const row of rows.filter(r => ids.has(r.websiteId))) {
      events += row.events;
      for (const [reason, n] of Object.entries(row.reasons)) reasons[reason] = (reasons[reason] ?? 0) + n;
    }
    return { events, reasons };
  } catch {
    return null;
  }
}
