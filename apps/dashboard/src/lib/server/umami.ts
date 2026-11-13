import 'server-only';
import type { Window } from '@/lib/range';

const BASE = process.env.UMAMI_URL ?? 'http://localhost:3000';

export class UpstreamError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface UmamiTeam {
  id: string;
  name: string;
  createdAt?: string;
}

export interface UmamiUser {
  id: string;
  username: string;
  isAdmin: boolean;
  teams: UmamiTeam[];
}

export interface UmamiWebsite {
  id: string;
  name: string;
  domain: string | null;
  teamId: string | null;
}

export interface WebStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export interface Point {
  x: string;
  y: number;
}

export type MetricType = 'path' | 'referrer' | 'country' | 'browser' | 'device' | 'event';

type Params = Record<string, string | number | undefined>;

async function call<T>(path: string, token: string | null, init: RequestInit = {}, params: Params = {}): Promise<T> {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new UpstreamError(res.status, `Umami ${init.method ?? 'GET'} ${url.pathname} returned ${res.status}`);
  return (await res.json()) as T;
}

const span = (w: Window) => ({ startAt: w.startAt, endAt: w.endAt });

export const umami = {
  login: (username: string, password: string) =>
    call<{ token: string; user: UmamiUser }>('/api/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  /** The signed-in user, their admin flag and their teams, straight from Umami. */
  verify: (token: string) => call<UmamiUser>('/api/auth/verify', token, { method: 'POST', body: '{}' }),

  allTeams: async (token: string) =>
    (await call<{ data: UmamiTeam[] }>('/api/admin/teams', token, {}, { pageSize: 500 })).data,

  teamWebsites: async (token: string, teamId: string) =>
    (await call<{ data: UmamiWebsite[] }>(`/api/teams/${teamId}/websites`, token, {}, { pageSize: 100 })).data,

  teamUsers: async (token: string, teamId: string) =>
    (
      await call<{ data: { role: string; user?: { username: string } }[] }>(`/api/teams/${teamId}/users`, token, {}, { pageSize: 100 })
    ).data,

  stats: (token: string, websiteId: string, w: Window) =>
    call<WebStats>(`/api/websites/${websiteId}/stats`, token, {}, span(w)),

  pageviews: (token: string, websiteId: string, w: Window) =>
    call<{ pageviews: Point[]; sessions: Point[] }>(`/api/websites/${websiteId}/pageviews`, token, {}, {
      ...span(w),
      unit: w.unit,
      timezone: 'UTC',
    }),

  metrics: (token: string, websiteId: string, type: MetricType, w: Window, limit = 8) =>
    call<Point[]>(`/api/websites/${websiteId}/metrics`, token, {}, { ...span(w), type, limit }),

  /** The tracker exactly as Umami serves it, for computing the SRI hash in snippets. */
  trackerScript: async (): Promise<Uint8Array> => {
    const res = await fetch(new URL('/script.js', BASE), { cache: 'no-store' });
    if (!res.ok) throw new UpstreamError(res.status, 'Umami tracker script unavailable');
    return new Uint8Array(await res.arrayBuffer());
  },

  heartbeat: async (): Promise<boolean> => {
    try {
      return (await fetch(new URL('/api/heartbeat', BASE), { cache: 'no-store' })).ok;
    } catch {
      return false;
    }
  },
};
