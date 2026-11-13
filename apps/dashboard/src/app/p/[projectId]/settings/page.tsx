import type { Metadata } from 'next';
import { SimpleTable } from '@/components/SimpleTable';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { umami } from '@/lib/server/umami';
import { requireProject } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { viewer, project } = await requireProject(projectId);

  const [websites, members] = await Promise.all([
    umami.teamWebsites(viewer.token, project.id),
    umami.teamUsers(viewer.token, project.id).catch(() => []),
  ]);

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Heading as="h1" size="md" weight="semi-bold">
        Settings
      </Heading>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Website domains
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Visits count only when the browser sends them from one of these domains or their subdomains.
          </Text>
          <SimpleTable
            id="domains"
            columns={['Site', 'Domain']}
            rows={websites.map(site => [site.name, site.domain ?? '—'])}
            emptyMessage="No websites yet"
          />
        </div>
      </Card>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Team
          </Heading>
          <SimpleTable
            id="members"
            columns={['Member', 'Role']}
            rows={members.map(m => [m.user?.username ?? 'unknown', m.role.replace('team-', '')])}
            emptyMessage="No members listed"
          />
        </div>
      </Card>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Keys, tracker upgrades and your data
          </Heading>
          <Banner variant="secondary">
            During the MVP an SCF operator issues ingest keys, adds domains and runs exports or deletions on request. Self-service key
            rotation, tracker upgrade notices, CSV export and date-range deletion are planned for the next milestones.
          </Banner>
        </div>
      </Card>
    </div>
  );
}
