import { site } from '../../../site.config';

export const dynamic = 'force-static';

// Published only once the repository is public: the contact is GitHub's
// private vulnerability reporting, which needs a public repository.
export function GET() {
  if (!site.repoPublic) return new Response('Not found\n', { status: 404 });

  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);

  const body = [
    `Contact: ${site.repoUrl}/security/advisories/new`,
    `Policy: ${site.repoUrl}/security/policy`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${site.url}/.well-known/security.txt`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
