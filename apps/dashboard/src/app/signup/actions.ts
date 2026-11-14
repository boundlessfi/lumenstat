'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { allowAttempt, enroll, type FieldErrors } from '@/lib/server/enrollment';
import { setSessionToken } from '@/lib/server/session';

export interface SignUpState {
  errors: FieldErrors;
  values: { projectName: string; domains: string; stellarLink: string; email: string };
}

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const values = {
    projectName: String(form.get('projectName') ?? ''),
    domains: String(form.get('domains') ?? ''),
    stellarLink: String(form.get('stellarLink') ?? ''),
    email: String(form.get('email') ?? ''),
  };
  const password = String(form.get('password') ?? '');

  // A field people never see; bots that fill every input give themselves away.
  if (String(form.get('company') ?? '') !== '') return { errors: { form: 'Something went wrong. Please try again.' }, values };

  const h = await headers();
  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!allowAttempt(ip)) return { errors: { form: 'Too many attempts. Please wait an hour and try again.' }, values };

  let target: string;
  try {
    const result = await enroll({ ...values, password });
    if (!result.ok) return { errors: result.errors, values };
    await setSessionToken(result.token);
    target = `/p/${result.teamId}/get-started`;
  } catch (error) {
    console.error(JSON.stringify({ msg: 'sign-up failed', error: String(error) }));
    return { errors: { form: 'Sign-up is unavailable right now. Please try again in a few minutes.' }, values };
  }

  redirect(target);
}
