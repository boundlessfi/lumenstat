import type { Metadata } from 'next';
import { SimpleTable } from '@/components/SimpleTable';
import { Badge, Banner, Button, Card, Heading, Input, Text } from '@/lib/sds';
import { control, type Enrollment } from '@/lib/server/control';
import { enrollmentMode } from '@/lib/server/enrollment';
import { umami } from '@/lib/server/umami';
import { requireOperator } from '@/lib/server/viewer';
import { approveEnrollment, rejectEnrollment } from './actions';

export const metadata: Metadata = { title: 'Enrollment' };

const MODE_TEXT = {
  open: 'Enrollment is open: projects that sign up at /signup are approved at once. Set ENROLLMENT_MODE=approval to review each one first.',
  approval: 'Enrollment needs approval: projects that sign up at /signup wait here until an operator approves them.',
  closed: 'Enrollment is closed: /signup is off. Set ENROLLMENT_MODE=open or approval to reopen it.',
} as const;

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

function linkLabel(link: string): string {
  return link.length > 40 ? `${link.slice(0, 18)}…${link.slice(-10)}` : link;
}

function PendingRow({ e }: { e: Enrollment }) {
  return (
    <div className="stack" style={{ gap: 8, paddingBlock: 12, borderBottom: '1px solid var(--sds-clr-gray-06)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Text as="span" size="md" weight="semi-bold">
          {e.projectName}
        </Text>
        <Text as="span" size="sm" addlClassName="muted">
          {e.contact} · {day(e.createdAt)}
        </Text>
      </div>
      <Text as="p" size="sm">
        Domains: {e.domains.join(', ')}
        <br />
        Stellar link:{' '}
        {e.stellarLink.startsWith('https://') ? (
          <a href={e.stellarLink} target="_blank" rel="noreferrer noopener">
            {linkLabel(e.stellarLink)}
          </a>
        ) : (
          <a href={`https://stellar.expert/explorer/public/${e.stellarLink.startsWith('C') ? 'contract' : 'account'}/${e.stellarLink}`} target="_blank" rel="noreferrer noopener">
            {linkLabel(e.stellarLink)}
          </a>
        )}
      </Text>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <form action={approveEnrollment.bind(null, e.enrollmentId)}>
          <Button variant="primary" size="sm" type="submit">
            Approve
          </Button>
        </form>
        <form action={rejectEnrollment.bind(null, e.enrollmentId)} className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <Input id={`note-${e.enrollmentId}`} name="note" fieldSize="sm" placeholder="Reason (shown to the project)" />
          <Button variant="destructive" size="sm" type="submit">
            Reject
          </Button>
        </form>
      </div>
    </div>
  );
}

export default async function EnrollmentPage() {
  const viewer = await requireOperator();
  const mode = enrollmentMode();
  const [teams, enrollments] = await Promise.all([umami.allTeams(viewer.token), control.enrollments().catch(() => null)]);
  const pending = (enrollments ?? []).filter(e => e.status === 'pending');
  const decided = (enrollments ?? []).filter(e => e.status !== 'pending').slice(0, 50);
  const selfEnrolled = new Set((enrollments ?? []).map(e => e.umamiTeamId));

  const rows = await Promise.all(
    teams.map(async team => {
      const sites = await umami.teamWebsites(viewer.token, team.id).catch(() => []);
      return [
        team.name,
        sites.map(s => s.domain).filter(Boolean).join(', ') || '—',
        selfEnrolled.has(team.id) ? 'Sign-up' : 'Operator',
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

      <Banner variant={mode === 'closed' ? 'warning' : 'primary'}>{MODE_TEXT[mode]}</Banner>
      {enrollments === null ? <Banner variant="error">The enrollment queue is unavailable (writer unreachable).</Banner> : null}

      <Card>
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <Heading as="h2" size="xs" weight="semi-bold">
              Waiting for approval
            </Heading>
            <Badge variant={pending.length ? 'warning' : 'secondary'}>{String(pending.length)}</Badge>
          </div>
          {pending.length === 0 ? (
            <Text as="p" size="sm" addlClassName="muted">
              Nothing to review.
            </Text>
          ) : (
            pending.map(e => <PendingRow key={e.enrollmentId} e={e} />)
          )}
        </div>
      </Card>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Enrolled projects
          </Heading>
          <SimpleTable
            id="enrolled"
            columns={['Project', 'Domains', 'Added by', 'Enrolled']}
            rows={rows}
            emptyMessage="No projects enrolled yet"
          />
        </div>
      </Card>

      <Card>
        <div className="stack">
          <Heading as="h2" size="xs" weight="semi-bold">
            Recent decisions
          </Heading>
          <SimpleTable
            id="decisions"
            columns={['Project', 'Contact', 'Decision', 'By', 'Date']}
            rows={decided.map(e => [e.projectName, e.contact, e.status, e.decidedBy ?? '—', day(e.decidedAt)])}
            emptyMessage="No decisions yet"
          />
        </div>
      </Card>
    </div>
  );
}
