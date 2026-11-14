'use server';

import { rangeWindow } from '@/lib/range';
import { control } from '@/lib/server/control';
import { loadApiTenant } from '@/lib/server/projects';
import { umami } from '@/lib/server/umami';
import { requireProject } from '@/lib/server/viewer';

export interface IngestKeyState {
  key: string | null;
  error: string | null;
}

/**
 * Issues a new ingest key for the project's API tenant (creating the tenant on
 * first use). Project owners and managers only; the key is shown once.
 */
export async function issueIngestKey(projectId: string, _: IngestKeyState): Promise<IngestKeyState> {
  const { viewer, project } = await requireProject(projectId);

  if (!viewer.user.isAdmin) {
    const members = await umami.teamUsers(viewer.token, project.id).catch(() => []);
    const me = members.find(m => m.user?.username === viewer.user.username);
    if (!me || !['team-owner', 'team-manager'].includes(me.role)) {
      return { key: null, error: 'Only the project owner or a manager can issue ingest keys.' };
    }
  }

  try {
    const tenant = await loadApiTenant(project.id, rangeWindow('24h'));
    if (tenant === 'unavailable') return { key: null, error: 'The API service is unavailable. Try again in a minute.' };
    const key = tenant
      ? await control.issueIngestKey(tenant.tenantId, `dashboard:${viewer.user.username}`.slice(0, 60))
      : (await control.createTenant(project.name, project.id)).ingestKey;
    return { key, error: null };
  } catch (error) {
    console.error(JSON.stringify({ msg: 'ingest key not issued', projectId: project.id, error: String(error) }));
    return { key: null, error: 'Could not issue a key right now. Try again in a minute.' };
  }
}
