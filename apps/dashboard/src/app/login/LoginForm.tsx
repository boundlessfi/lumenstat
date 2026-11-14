'use client';

import { Banner, Button, Card, Heading, Input, Text } from '@stellar/design-system';
import Link from 'next/link';
import { useActionState } from 'react';
import { type SignInState, signIn } from '../actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });

  return (
    <Card>
      <form action={action} className="stack" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <Heading as="h1" size="sm" weight="semi-bold">
            Sign in to Lumenstat
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Project teams see their own project. SCF operators see every project.
          </Text>
        </div>
        {state.error ? <Banner variant="error">{state.error}</Banner> : null}
        <Input id="username" name="username" fieldSize="md" label="Email or username" autoComplete="username" required />
        <Input id="password" name="password" fieldSize="md" label="Password" isPassword autoComplete="current-password" required />
        <Button variant="primary" size="md" type="submit" isLoading={pending} isFullWidth>
          Sign in
        </Button>
        <Text as="p" size="sm" addlClassName="muted">
          New Stellar project? <Link href="/signup">Enroll it</Link>
        </Text>
      </form>
    </Card>
  );
}
