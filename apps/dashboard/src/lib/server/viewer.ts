import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getSessionToken } from './session';
import { type UmamiTeam, type UmamiUser, UpstreamError, umami } from './umami';

export interface Viewer {
  token: string;
  user: UmamiUser;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who is looking, asked of Umami once per request. Null when signed out or expired. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return { token, user: await umami.verify(token) };
  } catch (error) {
    if (error instanceof UpstreamError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

/** Operator screens: Umami admins only. Everyone else gets a 404, not a hint. */
export async function requireOperator(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.user.isAdmin) notFound();
  return viewer;
}

/** A project is an Umami team. Members see their own; admins see any. */
export async function requireProject(projectId: string): Promise<{ viewer: Viewer; project: UmamiTeam }> {
  const viewer = await requireViewer();
  if (!UUID.test(projectId)) notFound();

  let project = viewer.user.teams.find(team => team.id === projectId);
  if (!project && viewer.user.isAdmin) {
    project = (await umami.allTeams(viewer.token)).find(team => team.id === projectId);
  }
  if (!project) notFound();

  return { viewer, project };
}
