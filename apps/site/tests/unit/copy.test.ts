import { describe, expect, it } from 'vitest';
import { getCopy, type Config } from '../../content/copy';
import { buildJsonLd, serializeJsonLd } from '../../lib/jsonld';
import { site } from '../../site.config';

const config = (overrides: Partial<Config> = {}): Config => ({ ...site, ...overrides });
const everyString = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(everyString)
      : [];

describe('config switches', () => {
  it('hold the decided values, and the safe choice where nothing is decided', () => {
    expect(site.repoPublic).toBe(true); // decided: the repository is public
    expect(site.scfAwarded).toBe(false);
    expect(site.docsUrl).toBe('https://docs.lumenstat.com'); // decided: the docs are live
    expect(site.publicStatsUrl).toBeNull();
    expect(site.screenshots).toBe(false);
    expect(site.signupMode).toBe('open');
  });

  it('signupMode changes the call to action and the enrollment note', () => {
    const open = getCopy(config({ signupMode: 'open' }));
    const approval = getCopy(config({ signupMode: 'approval' }));
    expect(open.enroll).toBe('Enroll your project');
    expect(open.enrollment.note).toBe('Programs can run sign-up open or with approval.');
    expect(approval.enroll).toBe('Request access');
    expect(approval.enrollment.note).toBe('New projects are reviewed before they go live.');
  });

  it('repoPublic: false hides every open-source claim', () => {
    const copy = getCopy(config({ repoPublic: false }));
    expect(copy.hero.micro).toBe('Hosted in the EU.');
    expect(copy.infra.title).toBe('Small and easy to reason about.');
    expect(copy.infra.rows.map(r => r.detail)).not.toContain('LICENSE · SECURITY.md');
    expect(copy.faq.items.map(i => i.question)).not.toContain('Is Lumenstat open source?');
    expect(copy.final.secondary).toBe('See how it works');
    expect(copy.meta.description).not.toMatch(/open source/i);
    // The strings that vary with the switch. Fixed labels such as "GitHub" are
    // left out of the page by the components; tests/e2e checks the rendered HTML.
    const varying = everyString([copy.hero, copy.infra.title, copy.infra.rows, copy.faq, copy.final]).join(' ');
    expect(varying).not.toMatch(/open source|MIT|GitHub/);
  });

  it('repoPublic: true shows them', () => {
    const copy = getCopy(config({ repoPublic: true }));
    expect(copy.hero.micro).toBe('Open source under MIT. Hosted in the EU.');
    expect(copy.infra.title).toBe('Small, open and easy to audit.');
    expect(copy.infra.rows[0]).toEqual({ text: 'MIT licensed, with a security policy.', detail: 'LICENSE · SECURITY.md' });
    expect(copy.faq.items).toHaveLength(11);
    expect(copy.faq.items[8]!.question).toBe('Is Lumenstat open source?');
    expect(copy.final.secondary).toBe('Read the code');
    expect(copy.meta.description).toHaveLength(153);
  });

  it('scfAwarded decides the operator wording', () => {
    const before = everyString(getCopy(config({ scfAwarded: false }))).join(' ');
    expect(before).not.toMatch(/SCF operators|used by SCF|SCF's analytics/);
    expect(before).toContain('program operators see them too');
    const after = getCopy(config({ scfAwarded: true }));
    expect(after.checks.flagged.text).toContain('SCF operators see them too');
  });

  it('keeps the metadata lengths the spec gives', () => {
    const copy = getCopy(config({ repoPublic: false }));
    expect(copy.meta.title).toHaveLength(55);
    expect(copy.meta.description).toHaveLength(137);
    // The public-repository description adds "Open source and" and stays under 160.
    expect(getCopy(config({ repoPublic: true })).meta.description).toHaveLength(153);
  });

  it('never uses an em dash or an en dash', () => {
    for (const repoPublic of [true, false]) {
      for (const text of everyString(getCopy(config({ repoPublic })))) expect(text).not.toMatch(/[–—]/);
    }
  });
});

describe('structured data', () => {
  const graphOf = (overrides: Partial<Config> = {}) => {
    const c = config(overrides);
    const copy = getCopy(c);
    const graph = buildJsonLd(copy, c);
    return { copy, nodes: graph['@graph'] as unknown as Record<string, unknown>[] };
  };
  const byType = (nodes: Record<string, unknown>[], type: string) => nodes.find(n => n['@type'] === type)!;

  it('has the four entities, linked by id', () => {
    const { nodes } = graphOf();
    expect(nodes.map(n => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']);
    expect(byType(nodes, 'WebSite').publisher).toEqual({ '@id': 'https://lumenstat.com/#organization' });
    expect(byType(nodes, 'SoftwareApplication').publisher).toEqual({ '@id': 'https://lumenstat.com/#organization' });
    for (const node of nodes) expect(String(node['@id'])).toMatch(/^https:\/\/lumenstat\.com\/#/);
  });

  it('has the same FAQ, word for word, as the page', () => {
    for (const repoPublic of [true, false]) {
      const { copy, nodes } = graphOf({ repoPublic });
      const questions = byType(nodes, 'FAQPage').mainEntity as {
        '@type': string;
        name: string;
        acceptedAnswer: { '@type': string; text: string };
      }[];
      expect(questions).toHaveLength(copy.faq.items.length);
      questions.forEach((question, i) => {
        expect(question['@type']).toBe('Question');
        expect(question.name).toBe(copy.faq.items[i]!.question);
        expect(question.acceptedAnswer).toEqual({ '@type': 'Answer', text: copy.faq.items[i]!.answer });
      });
    }
  });

  it('claims no ratings, reviews or offers', () => {
    const json = serializeJsonLd(buildJsonLd(getCopy(config({ repoPublic: true })), config({ repoPublic: true })));
    expect(json).not.toMatch(/aggregateRating|"review"|"offers"/);
  });

  it('mentions the license and the repository only when the repository is public', () => {
    const hidden = graphOf({ repoPublic: false }).nodes;
    expect(byType(hidden, 'SoftwareApplication')).not.toHaveProperty('license');
    expect(byType(hidden, 'Organization')).not.toHaveProperty('sameAs');
    const shown = graphOf({ repoPublic: true }).nodes;
    expect(byType(shown, 'SoftwareApplication').license).toBe('https://opensource.org/licenses/MIT');
    expect(byType(shown, 'Organization').sameAs).toEqual([site.repoUrl]);
  });

  it('cannot break out of its script tag', () => {
    const copy = getCopy(config());
    const hostile = { ...copy, meta: { ...copy.meta, softwareDescription: '</script><script>alert(1)</script>' } };
    const json = serializeJsonLd(buildJsonLd(hostile, config()));
    expect(json).not.toContain('<');
    expect(JSON.parse(json)['@graph'][2].description).toBe('</script><script>alert(1)</script>');
  });
});
