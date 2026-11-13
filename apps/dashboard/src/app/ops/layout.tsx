import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { requireOperator } from '@/lib/server/viewer';
import { signOut } from '../actions';

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  await requireOperator();

  return (
    <AppShell
      title="SCF operator"
      navLabel="Operator"
      nav={[
        { href: '/ops/projects', label: 'All projects' },
        { href: '/ops/compare', label: 'Compare' },
        { href: '/ops/enrollment', label: 'Enrollment' },
        { href: '/ops/keys', label: 'Keys and health' },
      ]}
      onSignOut={signOut}
    >
      {children}
    </AppShell>
  );
}
