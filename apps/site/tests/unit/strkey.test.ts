import { describe, expect, it } from 'vitest';
import { isValidStrKey, VERSION_ACCOUNT, VERSION_CONTRACT } from '../../lib/strkey';
import { demoAccount, demoContract, demoLines, demoTxHash } from '../../lib/strkey-demo';

describe('demo StrKeys', () => {
  it('are valid G and C addresses: length, version byte and CRC16 checksum', () => {
    for (const n of [1, 2, 3]) {
      const account = demoAccount(n);
      expect(account).toMatch(/^G[A-Z2-7]{55}$/);
      expect(isValidStrKey(account, VERSION_ACCOUNT)).toBe(true);
    }
    const contract = demoContract(4);
    expect(contract).toMatch(/^C[A-Z2-7]{55}$/);
    expect(isValidStrKey(contract, VERSION_CONTRACT)).toBe(true);
  });

  it('are rejected when a character changes or the type is wrong', () => {
    const account = demoAccount(1);
    const swapped = account.slice(0, 20) + (account[20] === 'A' ? 'B' : 'A') + account.slice(21);
    expect(isValidStrKey(swapped, VERSION_ACCOUNT)).toBe(false);
    expect(isValidStrKey(account, VERSION_CONTRACT)).toBe(false);
  });

  it('are stable across runs and builds', () => {
    expect(demoAccount(1)).toBe(demoAccount(1));
    expect(demoLines()).toEqual(demoLines());
    // Fixed values: these only change if the derivation changes.
    expect(demoAccount(1)).toBe('GDOVBYTGQMKILYPT4JBDDF6Y6AKBJEEKP6BCLPYPAUMGSPXRQAU42XIU');
    expect(demoContract(4)).toBe('CDX2PCGHD5DNXKJAZBP3YECL4TG4QI7QLL5MBJEV2NNNL2MBCCSQ6PSR');
  });

  it('give a 64-character hex transaction hash', () => {
    expect(demoTxHash(5)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('build the six figure lines, three of them on one route', () => {
    const lines = demoLines();
    expect(lines).toHaveLength(6);
    expect(lines.map(l => l.placeholder)).toEqual([
      '{account}', '{account}', '{account}', '{contract}', '{hash}', '{id}',
    ]);
    expect(new Set(lines.slice(0, 3).map(l => l.raw)).size).toBe(3);
    expect(lines[0]!.short).toMatch(/^G.{3}….{4}$/);
  });
});
