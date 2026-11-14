import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { Banner } from '@/lib/sds';
import { enrollmentForTeam } from '@/lib/server/enrollment';
import { requireProject } from '@/lib/server/viewer';
import { signOut } from '../../actions';

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);
  const base = `/p/${project.id}`;
  const enrollment = await enrollmentForTeam(project.id);

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
      {enrollment?.status === 'pending' ? (
        <div className="page" style={{ paddingBottom: 0 }}>
          <Banner variant="warning">
            Your sign-up is waiting for an SCF operator. Tracking starts as soon as it is approved; your snippet will appear on the Setup
            page.
          </Banner>
        </div>
      ) : null}
      {enrollment?.status === 'rejected' ? (
        <div className="page" style={{ paddingBottom: 0 }}>
          <Banner variant="error">
            This sign-up was not approved{enrollment.note ? `: ${enrollment.note}` : '.'} Contact SCF if you think this is a mistake.
          </Banner>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
