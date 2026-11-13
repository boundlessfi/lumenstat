import type { Metadata } from 'next';
import { SimpleTable } from '@/components/SimpleTable';
import { Banner, Card, Heading, Text } from '@/lib/sds';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';

export const metadata: Metadata = { title: 'Enrollment' };

export default async function EnrollmentPage() {
  const viewer = await requireOperator();
  const teams = await umami.allTeams(viewer.token);
  const rows = await Promise.all(
    teams.map(async team => {
      const sites = await umami.teamWebsites(viewer.token, team.id).catch(() => []);
      return [
        team.name,
        sites.map(s => s.domain).filter(Boolean).join(', ') || '—',
        team.createdAt ? new Date(team.createdAt).toISOString().slice(0, 10) : '—',
      ];
    }),
  );

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2 }}>
        <Heading as="h1" size="md" weight="semi-bold">
          Enrollment
        </Heading>
        <Text as="p" size="sm" addlClassName="muted">
          Who can join, and who is enrolled
        </Text>
      </div>

      <Banner variant="primary">
        Enrollment is open: an operator creates the project in Umami and adds its domains. The self-service sign-up form, the Stellar-link
        check, the approval queue and suspend or remove are planned for Milestone 2.
      </Banner>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Enrolled projects
          </Heading>
          <SimpleTable id="enrolled" columns={['Project', 'Domains', 'Enrolled']} rows={rows} emptyMessage="No projects enrolled yet" />
        </div>
      </Card>
    </div>
  );
}
