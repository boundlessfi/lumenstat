import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { requireProject } from '@/lib/server/viewer';
import { signOut } from '../../actions';

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);
  const base = `/p/${project.id}`;

  return (
    <AppShell
      title={project.name}
      navLabel="Project"
      nav={[
        { href: `${base}/overview`, label: 'Overview' },
        { href: `${base}/website`, label: 'Website' },
        { href: `${base}/api`, label: 'API' },
        { href: `${base}/get-started`, label: 'Setup' },
        { href: `${base}/settings`, label: 'Settings' },
      ]}
      secondaryNav={viewer.user.isAdmin ? [{ href: '/ops/projects', label: 'Operator view' }] : []}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );
}
