import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { normalizePath, resolveRoute } from '../src/normalize.ts';

const account = Keypair.random().publicKey();
const contract = StrKey.encodeContract(randomBytes(32));
const muxed = StrKey.encodeMed25519PublicKey(randomBytes(40));

describe('normalizePath', () => {
  it('replaces Stellar addresses with checksum-validated placeholders', () => {
    assert.equal(normalizePath(`/accounts/${account}/payments`), '/accounts/{account}/payments');
    assert.equal(normalizePath(`/contracts/${contract}`), '/contracts/{contract}');
    assert.equal(normalizePath(`/pay/${muxed}`), '/pay/{muxed}');
  });

  it('does not label a G-shaped segment with a bad checksum as an account', () => {
    const broken = `${account.slice(0, -1)}${account.endsWith('A') ? 'B' : 'A'}`;
    // The checksum decides; shape alone is not enough. (Whether the token rule then
    // folds it depends on the random digits, so only the label is asserted.)
    for (let i = 0; i < 50; i++) {
      assert.notEqual(normalizePath(`/accounts/${broken}`), '/accounts/{account}');
    }
  });

  it('replaces UUIDs, numeric ids, hashes and tokens', () => {
    assert.equal(normalizePath('/users/3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90'), '/users/{uuid}');
    assert.equal(normalizePath('/orders/12345/items/7'), '/orders/{id}/items/{id}');
    assert.equal(normalizePath(`/tx/${'ab'.repeat(32)}`), '/tx/{hash}');
    assert.equal(normalizePath('/wallets/0x52908400098527886E0F7030069857D2E4169EE7'), '/wallets/{token}');
    assert.equal(normalizePath('/verify/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0'), '/verify/{token}');
  });

  it('keeps readable slugs and words', () => {
    assert.equal(normalizePath('/hackathons/web3-builders-hackathon-2026'), '/hackathons/web3-builders-hackathon-2026');
    assert.equal(normalizePath('/settings/notification-preferences'), '/settings/notification-preferences');
  });

  it('drops query strings, fragments, trailing and doubled slashes', () => {
    assert.equal(normalizePath('/bounties/?page=2#top'), '/bounties');
    assert.equal(normalizePath('//api//v1/health/'), '/api/v1/health');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath('https://example.com/a/42?x=1'), '/a/{id}');
  });

  it('caps very long routes', () => {
    assert.equal(normalizePath(`/${'a'.repeat(400)}`).length, 256);
  });
});

describe('resolveRoute', () => {
  it('prefers http.route and leaves templates alone', () => {
    assert.equal(resolveRoute({ 'http.route': '/users/:id', 'url.path': '/users/42' }), '/users/:id');
    assert.equal(resolveRoute({ 'http.route': '/users/{id}' }), '/users/{id}');
  });

  it('normalizes a raw path when no route is set', () => {
    assert.equal(resolveRoute({ 'url.path': `/accounts/${account}` }), '/accounts/{account}');
    assert.equal(resolveRoute({ 'http.target': '/orders/99?expand=1' }), '/orders/{id}');
  });

  it('falls back to a placeholder', () => {
    assert.equal(resolveRoute({}), '{unknown}');
  });
});
