import 'server-only';
import { cookies } from 'next/headers';

// The cookie holds only the viewer's Umami token. Who the viewer is (admin or
// not, which teams) is asked of Umami on every request, never read from here.
const COOKIE = 'lumenstat_session';
const TWELVE_HOURS = 12 * 3600;

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function setSessionToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TWELVE_HOURS,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
