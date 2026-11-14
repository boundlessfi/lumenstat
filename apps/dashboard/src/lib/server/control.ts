import 'server-only';

const BASE = process.env.WRITER_URL ?? 'http://localhost:8090';
const KEY = process.env.WRITER_API_KEY ?? '';

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface Enrollment {
  enrollmentId: string;
  projectName: string;
  domains: string[];
  stellarLink: string;
  contact: string;
  umamiUserId: string;
  umamiTeamId: string;
  status: EnrollmentStatus;
  tenantId: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
}

async function call<T>(path: string, init: RequestInit = {}, params: Record<string, string | undefined> = {}): Promise<T> {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const res = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Writer ${init.method ?? 'GET'} ${url.pathname} returned ${res.status}`);
  return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

/** The writer's operator-only control API: API tenants, ingest keys and enrollment requests. */
export const control = {
  createTenant: (name: string, umamiTeamId: string) =>
    post<{ tenantId: string; ingestKey: string }>('/v1/admin/tenants', { name, umamiTeamId }),

  issueIngestKey: async (tenantId: string, label: string) =>
    (await post<{ ingestKey: string }>(`/v1/admin/tenants/${tenantId}/ingest-keys`, { label })).ingestKey,

  createEnrollment: async (input: Pick<Enrollment, 'projectName' | 'domains' | 'stellarLink' | 'contact' | 'umamiUserId' | 'umamiTeamId'>) =>
    (await post<{ enrollment: Enrollment }>('/v1/admin/enrollments', input)).enrollment,

  enrollments: async (filter: { status?: EnrollmentStatus; teamId?: string } = {}) =>
    (await call<{ enrollments: Enrollment[] }>('/v1/admin/enrollments', {}, filter)).enrollments,

  decide: async (enrollmentId: string, decision: { status: 'approved' | 'rejected'; decidedBy: string; tenantId?: string; note?: string }) =>
    (await post<{ enrollment: Enrollment }>(`/v1/admin/enrollments/${enrollmentId}/decision`, decision)).enrollment,
};
