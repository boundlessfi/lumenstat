import { StrKey } from '@stellar/stellar-sdk';

/**
 * Default route normalization. These rules are fixed on purpose: the RFP asks for a
 * hard-coded rule set, and tenants who need finer control set `http.route` themselves.
 * Route templates such as `/users/:id` or `/users/{id}` pass through unchanged.
 */

export const MAX_ROUTE_LENGTH = 256;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const HEX_64 = /^[0-9a-f]{64}$/i;
const HEX_0X = /^0x[0-9a-f]{8,}$/i;
const TOKEN_CHARS = /^[A-Za-z0-9_\-=.~+]+$/;

function looksLikeOpaqueToken(segment: string): boolean {
  if (segment.length < 20 || !TOKEN_CHARS.test(segment)) return false;
  const digits = segment.replace(/\D/g, '').length;
  const hasLetter = /[A-Za-z]/.test(segment);
  const mixedCase = /[a-z]/.test(segment) && /[A-Z]/.test(segment);
  // Keeps readable slugs like "web3-builders-hackathon-2026" while catching JWTs,
  // base64 IDs and random tokens.
  return digits > 0 && hasLetter && (mixedCase || digits / segment.length >= 0.2);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function normalizeSegment(raw: string): string {
  if (raw === '') return raw;
  const segment = safeDecode(raw);

  if (segment.length === 56 && segment.startsWith('G') && StrKey.isValidEd25519PublicKey(segment)) {
    return '{account}';
  }
  if (segment.length === 56 && segment.startsWith('C') && StrKey.isValidContract(segment)) {
    return '{contract}';
  }
  if (segment.length === 69 && segment.startsWith('M') && StrKey.isValidMed25519PublicKey(segment)) {
    return '{muxed}';
  }
  if (UUID.test(segment)) return '{uuid}';
  if (NUMERIC.test(segment)) return '{id}';
  if (HEX_64.test(segment)) return '{hash}';
  if (HEX_0X.test(segment)) return '{token}';
  if (looksLikeOpaqueToken(segment)) return '{token}';
  return segment;
}

export function normalizePath(raw: string): string {
  let path = raw.trim();

  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Not a parseable URL; fall through and treat it as a path.
    }
  }

  const cut = path.search(/[?#]/);
  if (cut >= 0) path = path.slice(0, cut);

  path = path.replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const normalized = path.split('/').map(normalizeSegment).join('/');
  return normalized.length > MAX_ROUTE_LENGTH ? normalized.slice(0, MAX_ROUTE_LENGTH) : normalized;
}

/** Picks the best route attribute available and normalizes it. */
export function resolveRoute(attrs: Record<string, unknown>): string {
  for (const key of ['http.route', 'url.path', 'http.target']) {
    const value = attrs[key];
    if (typeof value === 'string' && value.trim() !== '') return normalizePath(value);
  }
  return '{unknown}';
}
