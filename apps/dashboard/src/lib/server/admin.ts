import 'server-only';
import { UpstreamError, umami } from './umami';

/**
 * Umami admin calls (enrollment, flagged-traffic summaries) use the admin
 * account, over the private network only. The token is cached and refreshed on 401.
 */

let adminToken: string | null = null;

async function getAdminToken(refresh = false): Promise<string> {
  if (adminToken && !refresh) return adminToken;
  const password = process.env.UMAMI_ADMIN_PASSWORD;
  if (!password) throw new Error('UMAMI_ADMIN_PASSWORD is not set; this needs the Umami admin account.');
  adminToken = (await umami.login(process.env.UMAMI_ADMIN_USERNAME ?? 'admin', password)).token;
  return adminToken;
}

export async function asAdmin<T>(fn: (token: string) => Promise<T>): Promise<T> {
  try {
    return await fn(await getAdminToken());
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 401) return fn(await getAdminToken(true));
    throw error;
  }
}
