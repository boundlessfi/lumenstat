import type { FAQPage, Graph, Organization, SoftwareApplication, WebSite } from 'schema-dts';
import type { Copy, Config } from '../content/copy';
import { site } from '../site.config';

const base = `${site.url}/`;

/** The page's entity graph. No ratings, reviews or offers: there are none. */
export function buildJsonLd(copy: Copy, config: Config = site): Graph {
  const organization: Organization = {
    '@type': 'Organization',
    '@id': `${base}#organization`,
    name: 'Lumenstat',
    url: base,
    logo: `${base}icon.svg`,
    parentOrganization: { '@type': 'Organization', name: site.builtBy.name, url: site.builtBy.url },
    ...(config.repoPublic ? { sameAs: [config.repoUrl] } : {}),
  };

  const website: WebSite = {
    '@type': 'WebSite',
    '@id': `${base}#website`,
    url: base,
    name: 'Lumenstat',
    inLanguage: 'en',
    publisher: { '@id': `${base}#organization` },
  };

  const software: SoftwareApplication = {
    '@type': 'SoftwareApplication',
    '@id': `${base}#software`,
    name: 'Lumenstat',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Web and API analytics',
    operatingSystem: 'Web',
    url: `${site.appUrl}/`,
    description: copy.meta.softwareDescription,
    ...(config.repoPublic ? { license: 'https://opensource.org/licenses/MIT' } : {}),
    publisher: { '@id': `${base}#organization` },
  };

  const faq: FAQPage = {
    '@type': 'FAQPage',
    '@id': `${base}#faq`,
    mainEntity: copy.faq.items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return { '@context': 'https://schema.org', '@graph': [organization, website, software, faq] };
}

/** Serialized for a script tag: `<` is escaped so the tag cannot be closed early. */
export function serializeJsonLd(graph: Graph): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}
