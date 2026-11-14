// Stellar StrKey encoding: base32(version byte + 32-byte payload + CRC16-XModem,
// little endian). Pure, with no dependencies, so it runs in tests too.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const VERSION_ACCOUNT = 6 << 3; // G...
export const VERSION_CONTRACT = 2 << 3; // C...

export function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

export function encodeStrKey(version: number, payload: Uint8Array): string {
  if (payload.length !== 32) throw new Error('StrKey payload must be 32 bytes');
  const body = new Uint8Array(33);
  body[0] = version;
  body.set(payload, 1);
  const crc = crc16xmodem(body);
  const full = new Uint8Array(35);
  full.set(body, 0);
  full[33] = crc & 0xff;
  full[34] = crc >>> 8;
  return base32Encode(full);
}

/** Checks length, alphabet, version byte and checksum, as a validator would. */
export function isValidStrKey(text: string, version: number): boolean {
  if (text.length !== 56) return false;
  const bytes = base32Decode(text);
  if (!bytes || bytes.length !== 35) return false;
  if (bytes[0] !== version) return false;
  const crc = crc16xmodem(bytes.subarray(0, 33));
  return bytes[33] === (crc & 0xff) && bytes[34] === crc >>> 8;
}
