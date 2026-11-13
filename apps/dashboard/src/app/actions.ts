'use server';

import { redirect } from 'next/navigation';
import { clearSession, setSessionToken } from '@/lib/server/session';
import { UpstreamError, umami } from '@/lib/server/umami';

export interface SignInState {
  error: string | null;
}

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!username || !password) return { error: 'Enter your username and password.' };

  try {
    const { token } = await umami.login(username, password);
    await setSessionToken(token);
  } catch (error) {
    if (error instanceof UpstreamError && error.status < 500) return { error: 'That username and password did not match.' };
    return { error: 'Sign-in is unavailable right now. Try again in a minute.' };
  }

  redirect('/');
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect('/login');
}
