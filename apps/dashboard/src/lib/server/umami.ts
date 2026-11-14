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

  /** A versioned tracker release exactly as Umami serves it, for computing the SRI hash in snippets. */
  trackerScript: async (version: string): Promise<Uint8Array> => {
    const res = await fetch(new URL(`/v/${version}/l.js`, BASE), { next: { revalidate: 3600 } });
    if (!res.ok) throw new UpstreamError(res.status, 'Umami tracker script unavailable');
    return new Uint8Array(await res.arrayBuffer());
  },

  // ---- Admin calls used by enrollment. `token` must belong to an Umami admin.

  createUser: (token: string, username: string, password: string) =>
    call<{ id: string; username: string }>('/api/users', token, {
      method: 'POST',
      body: JSON.stringify({ username, password, role: 'user' }),
    }),

  /** Creates a team owned by `ownerId`; the admin making the call does not join it. */
  createTeam: async (token: string, name: string, ownerId: string): Promise<UmamiTeam> => {
    // Umami answers with [team, membership].
    const res = await call<UmamiTeam | [UmamiTeam, unknown]>('/api/teams', token, {
      method: 'POST',
      body: JSON.stringify({ name, ownerId }),
    });
    return Array.isArray(res) ? res[0] : res;
  },

  deleteTeam: (token: string, teamId: string) => call<unknown>(`/api/teams/${teamId}`, token, { method: 'DELETE' }),

  deleteUser: (token: string, userId: string) => call<unknown>(`/api/users/${userId}`, token, { method: 'DELETE' }),

  createWebsite: (token: string, teamId: string, domain: string) =>
    call<UmamiWebsite>('/api/websites', token, {
      method: 'POST',
      body: JSON.stringify({ name: domain, domain, teamId }),
    }),

  /** Flagged traffic per website (admins only), from the SCF patch's /api/scf/flagged. */
  flagged: (token: string, w: Window, websiteId?: string) =>
    call<{
      websites: { websiteId: string; events: number; reasons: Record<string, number> }[];
      recent?: {
        createdAt: string;
        reasons: string[];
        urlPath: string | null;
        referrerDomain: string | null;
        country: string | null;
        browser: string | null;
        os: string | null;
        device: string | null;
        eventName: string | null;
      }[];
    }>('/api/scf/flagged', token, {}, {
      startAt: Math.floor(w.startAt / 1000),
      endAt: Math.floor(w.endAt / 1000),
      websiteId,
    }),

  heartbeat: async (): Promise<boolean> => {
    try {
      return (await fetch(new URL('/api/heartbeat', BASE), { cache: 'no-store' })).ok;
    } catch {
      return false;
    }
  },
};
