import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Heading, Text } from '@/lib/sds';
import { enrollmentMode } from '@/lib/server/enrollment';
import { getViewer } from '@/lib/server/viewer';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Enroll your project' };

export default async function SignupPage() {
  if (await getViewer()) redirect('/');
  const mode = enrollmentMode();

  return (
    <div className="center-page">
      {mode === 'closed' ? (
        <Card>
          <div className="stack">
            <Heading as="h1" size="sm" weight="semi-bold">
              Sign-up is closed
            </Heading>
            <Text as="p" size="sm">
              New projects are enrolled by SCF for now. <Link href="/login">Sign in</Link> if you already have an account.
            </Text>
          </div>
        </Card>
      ) : (
        <SignupForm mode={mode} />
      )}
    </div>
  );
}
