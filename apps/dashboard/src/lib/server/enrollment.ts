import 'server-only';
import { strKeyKind } from '@/lib/strkey';
import { asAdmin } from './admin';
import { control, type Enrollment } from './control';
import { UpstreamError, umami } from './umami';

/**
 * Self-service enrollment.
 *
 * A project signs up with a name, its domains, one Stellar link and the owner's
 * email and password. The owner's Umami account and team are created at once.
 * Then, by ENROLLMENT_MODE:
 *   open      approved immediately: websites and the API tenant are created
 *   approval  waits in the operator queue; approving creates websites and tenant
 *   closed    sign-up is off
 *
 * Umami admin calls go through ./admin.ts (the admin account, private network only).
 */

export type EnrollmentMode = 'open' | 'approval' | 'closed';

export function enrollmentMode(): EnrollmentMode {
  const mode = process.env.ENROLLMENT_MODE;
  return mode === 'approval' || mode === 'closed' ? mode : 'open';
}

const DAILY_LIMIT = Number(process.env.ENROLLMENT_DAILY_LIMIT ?? 25);
const ALLOW_LOCAL = process.env.ENROLLMENT_ALLOW_LOCAL === '1';
const MAX_DOMAINS = 5;

/** Hosts accepted for a Stellar link given as a URL. */
const STELLAR_LINK_HOSTS = ['communityfund.stellar.org', 'stellar.expert', 'stellarchain.io', 'lumenscan.io'];

// ---- Validation

export type Field = 'projectName' | 'domains' | 'stellarLink' | 'email' | 'password' | 'form';
export type FieldErrors = Partial<Record<Field, string>>;

export interface SignupInput {
  projectName: string;
  domains: string;
  stellarLink: string;
  email: string;
  password: string;
}

const LOCAL_SUFFIXES = ['localhost', '.local', '.test', '.example', '.invalid', '.internal'];

/** Cleans a domain the way people paste it ("https://www.x.org/path") and checks it is a public hostname. */
export function normalizeDomain(raw: string): string | null {
  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');

  if (ALLOW_LOCAL && (domain === 'localhost' || domain === '127.0.0.1')) return domain;
  if (domain.length > 253) return null;
  // Labels of letters, digits and hyphens, and a top-level domain that starts with a letter (so no IPs).
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(domain)) return null;
  if (LOCAL_SUFFIXES.some(suffix => domain === suffix.replace(/^\./, '') || domain.endsWith(suffix))) return null;
  return domain;
}

export function parseDomains(raw: string): { domains: string[]; error?: string } {
  const parts = raw
    .split(/[\s,]+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { domains: [], error: 'Add at least one domain, such as example.org.' };

  const domains: string[] = [];
  for (const part of parts) {
    const domain = normalizeDomain(part);
    if (!domain) return { domains: [], error: `"${part.slice(0, 60)}" is not a public domain name.` };
    if (!domains.includes(domain)) domains.push(domain);
  }
  if (domains.length > MAX_DOMAINS) return { domains: [], error: `Add up to ${MAX_DOMAINS} domains; an operator can add more later.` };
  return { domains };
}

export async function checkStellarLink(raw: string): Promise<{ value: string } | { error: string }> {
  const value = raw.trim();
  const kind = strKeyKind(value);

  if (kind === 'account') {
    try {
      const res = await fetch(`https://horizon.stellar.org/accounts/${value}`, { signal: AbortSignal.timeout(4000) });
      if (res.status === 404) return { error: 'That account does not exist on Stellar mainnet.' };
    } catch {
      // Horizon unreachable: a well-formed address is enough.
    }
    return { value };
  }
  if (kind === 'contract') return { value };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      error: 'Use your SCF project page, your project on stellar.expert, or a Stellar account (G…) or contract (C…) address.',
    };
  }
  const host = url.hostname.replace(/^www\./, '');
  if (url.protocol !== 'https:' || !STELLAR_LINK_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) {
    return { error: `Links must point to ${STELLAR_LINK_HOSTS.join(', ')}, or use a G… or C… address.` };
  }
  return { value: url.toString() };
}

// ---- Sign-up and decisions

export type EnrollResult =
  | { ok: true; teamId: string; status: Enrollment['status']; token: string }
  | { ok: false; errors: FieldErrors };

export async function enroll(input: SignupInput): Promise<EnrollResult> {
  const mode = enrollmentMode();
  if (mode === 'closed') return { ok: false, errors: { form: 'Sign-up is closed right now. Ask SCF to enroll your project.' } };

  const errors: FieldErrors = {};
  const projectName = input.projectName.trim().replace(/\s+/g, ' ');
  if (projectName.length < 2 || projectName.length > 50) errors.projectName = 'Use 2 to 50 characters.';

  const { domains, error: domainError } = parseDomains(input.domains);
  if (domainError) errors.domains = domainError;

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (input.password.length < 12 || input.password.length > 128) errors.password = 'Use at least 12 characters.';

  const link = await checkStellarLink(input.stellarLink);
  if ('error' in link) errors.stellarLink = link.error;

  if (Object.keys(errors).length > 0 || 'error' in link) return { ok: false, errors };

  const today = new Date().toISOString().slice(0, 10);
  const recent = await control.enrollments();
  if (recent.filter(e => e.createdAt.slice(0, 10) === today).length >= DAILY_LIMIT) {
    return { ok: false, errors: { form: 'We have reached today’s sign-up limit. Please try again tomorrow.' } };
  }

  let userId: string;
  try {
    userId = (await asAdmin(t => umami.createUser(t, email, input.password))).id;
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 400) {
      return { ok: false, errors: { email: 'An account with this email already exists. Sign in instead.' } };
    }
    throw error;
  }

  let teamId: string | null = null;
  let enrollment: Enrollment;
  try {
    teamId = (await asAdmin(t => umami.createTeam(t, projectName, userId))).id;
    enrollment = await control.createEnrollment({
      projectName,
      domains,
      stellarLink: link.value,
      contact: email,
      umamiUserId: userId,
      umamiTeamId: teamId,
    });
  } catch (error) {
    // Undo the half-made account so the person can simply try again.
    await asAdmin(async t => {
      if (teamId) await umami.deleteTeam(t, teamId).catch(() => undefined);
      await umami.deleteUser(t, userId).catch(() => undefined);
    }).catch(() => undefined);
    throw error;
  }

  if (mode === 'open') enrollment = await approve(enrollment, 'open enrollment');

  const { token } = await umami.login(email, input.password);
  return { ok: true, teamId, status: enrollment.status, token };
}

/** Creates the project's websites and API tenant, then records the approval. Safe to retry. */
export async function approve(enrollment: Enrollment, decidedBy: string): Promise<Enrollment> {
  await asAdmin(async token => {
    const existing = new Set((await umami.teamWebsites(token, enrollment.umamiTeamId)).map(site => site.domain));
    for (const domain of enrollment.domains) {
      if (!existing.has(domain)) await umami.createWebsite(token, enrollment.umamiTeamId, domain);
    }
  });
  const { tenantId } = await control.createTenant(enrollment.projectName, enrollment.umamiTeamId);
  return control.decide(enrollment.enrollmentId, { status: 'approved', decidedBy, tenantId });
}

export async function reject(enrollmentId: string, decidedBy: string, note?: string): Promise<Enrollment> {
  return control.decide(enrollmentId, { status: 'rejected', decidedBy, note });
}

/** The enrollment behind a project, if it signed up itself. Null for operator-made projects. */
export async function enrollmentForTeam(teamId: string): Promise<Enrollment | null> {
  try {
    return (await control.enrollments({ teamId }))[0] ?? null;
  } catch {
    return null;
  }
}

// ---- A small per-IP limit on sign-up attempts (Cloudflare also rate-limits POST /signup).

const attempts = new Map<string, number[]>();

export function allowAttempt(ip: string, limit = 5, windowMs = 3600e3): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= limit) {
    attempts.set(ip, recent);
    return false;
  }
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 10_000) attempts.clear();
  return true;
}
