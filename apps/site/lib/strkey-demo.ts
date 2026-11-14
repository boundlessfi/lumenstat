// Demo values for the route-normalization figure, generated at build time.
// The payloads are sha256('lumenstat-demo-' + n), so they are stable across
// builds and are nobody's real account, contract or transaction.
import 'server-only';
import { createHash } from 'node:crypto';
import { encodeStrKey, VERSION_ACCOUNT, VERSION_CONTRACT } from './strkey';

const digest = (n: number) => createHash('sha256').update(`lumenstat-demo-${n}`).digest();

export const demoAccount = (n: number) => encodeStrKey(VERSION_ACCOUNT, new Uint8Array(digest(n)));
export const demoContract = (n: number) => encodeStrKey(VERSION_CONTRACT, new Uint8Array(digest(n)));
export const demoTxHash = (n: number) => digest(n).toString('hex');

export type DemoLine = {
  method: 'GET' | 'POST';
  /** Path text before the variable segment. */
  before: string;
  /** The raw variable segment: an address, a hash or an id. */
  raw: string;
  /** The raw segment shortened in the middle, for narrow screens. */
  short: string;
  /** Path text after the variable segment. */
  after: string;
  placeholder: '{account}' | '{contract}' | '{hash}' | '{id}';
  kind: 'account' | 'contract' | 'hash' | 'id';
};

const middle = (text: string) => (text.length > 12 ? `${text.slice(0, 4)}…${text.slice(-4)}` : text);

function line(
  method: DemoLine['method'],
  before: string,
  raw: string,
  after: string,
  kind: DemoLine['kind'],
): DemoLine {
  return { method, before, raw, short: middle(raw), after, kind, placeholder: `{${kind}}` as DemoLine['placeholder'] };
}

/** The six request lines of the figure. The first three share one route. */
export function demoLines(): DemoLine[] {
  return [
    line('GET', '/accounts/', demoAccount(1), '/payments', 'account'),
    line('GET', '/accounts/', demoAccount(2), '/payments', 'account'),
    line('GET', '/accounts/', demoAccount(3), '/payments', 'account'),
    line('GET', '/contracts/', demoContract(4), '/events', 'contract'),
    line('GET', '/tx/', demoTxHash(5), '', 'hash'),
    line('POST', '/bounties/', '48213', '/submissions', 'id'),
  ];
}
