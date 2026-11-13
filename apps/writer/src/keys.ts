import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export type KeyKind = 'scf_ingest' | 'scf_read';

/** A new random key. Shown once; only its hash is stored. */
export function generateKey(kind: KeyKind): string {
  return `${kind}_${randomBytes(24).toString('base64url')}`;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
