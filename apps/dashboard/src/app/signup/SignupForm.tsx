'use client';

import { Banner, Button, Card, Heading, Input, Text, Textarea } from '@stellar/design-system';
import Link from 'next/link';
import { useActionState } from 'react';
import { type SignUpState, signUp } from './actions';

const initial: SignUpState = { errors: {}, values: { projectName: '', domains: '', stellarLink: '', email: '' } };

export function SignupForm({ mode }: { mode: 'open' | 'approval' }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, initial);
  const { errors, values } = state;

  return (
    <Card>
      <form action={action} className="stack" style={{ gap: 16 }} noValidate>
        <div className="stack" style={{ gap: 4 }}>
          <Heading as="h1" size="sm" weight="semi-bold">
            Enroll your project
          </Heading>
          <Text as="p" size="sm" addlClassName="muted">
            Free for Stellar ecosystem projects. Cookieless website analytics and API usage numbers, in one dashboard.
            {mode === 'approval' ? ' An SCF operator reviews each sign-up before tracking starts.' : ''}
          </Text>
        </div>

        {errors.form ? <Banner variant="error">{errors.form}</Banner> : null}

        <Input
          id="projectName"
          name="projectName"
          fieldSize="md"
          label="Project name"
          defaultValue={values.projectName}
          error={errors.projectName}
          maxLength={50}
          required
        />
        <Textarea
          id="domains"
          name="domains"
          fieldSize="md"
          label="Website domains"
          note="One per line or comma-separated, up to 5. Subdomains are included."
          error={errors.domains}
          customTextarea={
            <textarea
              id="domains"
              name="domains"
              rows={3}
              placeholder={'example.org\ndocs.example.org'}
              defaultValue={values.domains}
              required
            />
          }
        />
        <Input
          id="stellarLink"
          name="stellarLink"
          fieldSize="md"
          label="Stellar link"
          note="Your SCF project page, your project on stellar.expert, or a Stellar account (G…) or contract (C…) address."
          defaultValue={values.stellarLink}
          error={errors.stellarLink}
          required
        />
        <Input
          id="email"
          name="email"
          type="email"
          fieldSize="md"
          label="Your email"
          note="You sign in with this."
          autoComplete="email"
          defaultValue={values.email}
          error={errors.email}
          required
        />
        <Input
          id="password"
          name="password"
          fieldSize="md"
          label="Password"
          note="At least 12 characters."
          isPassword
          autoComplete="new-password"
          error={errors.password}
          required
        />
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Button variant="primary" size="md" type="submit" isLoading={pending} isFullWidth>
          Create project
        </Button>
        <Text as="p" size="sm" addlClassName="muted">
          Already enrolled? <Link href="/login">Sign in</Link>
        </Text>
      </form>
    </Card>
  );
}
