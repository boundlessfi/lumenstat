import Link from 'next/link';
import { Card, Heading, Text } from '@/lib/sds';

export default function NotFound() {
  return (
    <div className="center-page">
      <Card>
        <div className="stack">
          <Heading as="h1" size="sm" weight="semi-bold">
            Not found
          </Heading>
          <Text as="p" size="sm">
            This page does not exist, or your account cannot see it.
          </Text>
          <Link href="/">Back to your dashboard</Link>
        </div>
      </Card>
    </div>
  );
}
