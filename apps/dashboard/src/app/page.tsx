import { redirect } from 'next/navigation';
import { Card, Heading, Text } from '@/lib/sds';
import { requireViewer } from '@/lib/server/viewer';

/** Sends operators to the operator view and project members to their first project. */
export default async function Home() {
  const viewer = await requireViewer();

  if (viewer.user.isAdmin) redirect('/ops/projects');
  const first = viewer.user.teams[0];
  if (first) redirect(`/p/${first.id}/overview`);

  return (
    <div className="center-page">
      <Card>
        <div className="stack">
          <Heading as="h1" size="sm" weight="semi-bold">
            No project yet
          </Heading>
          <Text as="p" size="sm">
            Your account is not part of any project. Ask your project owner to invite you, or ask SCF to enroll your project.
          </Text>
        </div>
      </Card>
    </div>
  );
}
