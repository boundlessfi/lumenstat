/**
 * Validates Stellar StrKey addresses: accounts (G...) and contracts (C...).
 * A StrKey is base32 of [version byte][32-byte key][CRC16-XModem, little endian].
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const VERSION = { account: 6 << 3, contract: 2 << 3 } as const;

export type StrKeyKind = keyof typeof VERSION;

function base32Decode(input: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/** The kind of address, or null when the string is not a valid account or contract StrKey. */
export function strKeyKind(address: string): StrKeyKind | null {
  if (address.length !== 56) return null;
  const bytes = base32Decode(address);
  if (!bytes || bytes.length !== 35) return null;

  const payload = bytes.subarray(0, 33);
  const checksum = bytes[33] | (bytes[34] << 8);
  if (crc16xmodem(payload) !== checksum) return null;

  if (payload[0] === VERSION.account) return 'account';
  if (payload[0] === VERSION.contract) return 'contract';
  return null;
}
