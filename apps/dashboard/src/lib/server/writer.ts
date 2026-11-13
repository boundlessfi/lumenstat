import 'server-only';
import type { Window } from '@/lib/range';

const BASE = process.env.WRITER_URL ?? 'http://localhost:8090';
const KEY = process.env.WRITER_API_KEY ?? '';

export interface ApiTenant {
  tenantId: string;
  name: string;
  status: string;
  umamiTeamId: string | null;
  services: number;
  routes: number;
  requests: number;
  errorRate: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
}

export interface ApiRoute {
  service: string;
  method: string;
  route: string;
  requests: number;
  status: { '2xx': number; '3xx': number; '4xx': number; '5xx': number; other: number };
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
}

async function call<T>(path: string, w: Window): Promise<T> {
  const url = new URL(path, BASE);
  url.searchParams.set('from', new Date(w.startAt).toISOString());
  url.searchParams.set('to', new Date(w.endAt).toISOString());
  const res = await fetch(url, { headers: { authorization: `Bearer ${KEY}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Writer ${url.pathname} returned ${res.status}`);
  return (await res.json()) as T;
}

/**
 * The dashboard holds an operator key. Callers must filter by project on the
 * server before anything reaches a viewer (see lib/server/projects.ts).
 */
export const writer = {
  tenants: async (w: Window) => (await call<{ tenants: ApiTenant[] }>('/v1/api-metrics/tenants', w)).tenants,
  routes: async (tenantId: string, w: Window) =>
    (await call<{ routes: ApiRoute[] }>(`/v1/api-metrics/tenants/${tenantId}/routes`, w)).routes,
  healthy: async (): Promise<boolean> => {
    try {
      return (await fetch(new URL('/healthz', BASE), { cache: 'no-store' })).ok;
    } catch {
      return false;
    }
  },
};
