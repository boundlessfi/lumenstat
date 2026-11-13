'use client';

import { Layout } from '@stellar/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  title,
  navLabel,
  nav,
  secondaryNav = [],
  onSignOut,
  children,
}: {
  title: string;
  navLabel: string;
  nav: NavItem[];
  secondaryNav?: NavItem[];
  onSignOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const link = (item: NavItem) => (
    <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}>
      {item.label}
    </Link>
  );

  return (
    <>
      <Layout.Header
        projectId="scf-analytics"
        projectTitle="SCF Analytics"
        projectLink="/"
        hasThemeSwitch
        onSignOut={() => {
          void onSignOut();
        }}
      />
      <div className="shell">
        <nav className="shell-nav" aria-label={navLabel}>
          <div className="shell-nav-label">{title}</div>
          {nav.map(link)}
          {secondaryNav.length > 0 ? <hr /> : null}
          {secondaryNav.map(link)}
        </nav>
        <main className="shell-main">{children}</main>
      </div>
    </>
  );
}
