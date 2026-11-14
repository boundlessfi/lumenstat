// Every string on the page. Copy that depends on an open decision reads the
// switches in site.config.ts. Do not rewrite these lines: they are the approved
// copy, and scripts/lint-copy.mjs checks them.
import { site, type Site } from '../site.config';
import { facts } from './facts';

export type Config = Pick<
  Site,
  'repoPublic' | 'repoUrl' | 'docsUrl' | 'signupMode' | 'scfAwarded' | 'publicStatsUrl' | 'screenshots'
>;

/** A headline in two tones: `lead` in the text color, `rest` in the accent. */
export type TwoTone = { lead: string; rest: string };

export type FaqItem = { question: string; answer: string };

export const tagline = 'Proof of usage for the Stellar ecosystem.';

/** The reason labels the dashboard shows for flagged events. Used verbatim. */
export const reasons = {
  noOrigin: 'No browser origin',
  notBrowser: 'Not a browser request',
  otherDomain: 'Sent from another domain',
  noProof: 'No proof of JavaScript',
  invalidProof: 'Invalid proof of JavaScript',
  dataCenter: 'Data-center IP',
  perNetwork: 'Too many visitors from one network',
} as const;

export const microcopy = {
  skip: 'Skip to content',
  homeLabel: 'Lumenstat home',
  menuOpen: 'Menu',
  menuClose: 'Close',
  pause: 'Pause animation',
  play: 'Play animation',
  replay: 'Replay',
  step: 'Next event',
  copy: 'Copy',
  copied: 'Copied',
  copiedLive: 'Copied to clipboard',
  opensApp: '(opens app.lumenstat.com)',
  opensGitHub: '(opens GitHub)',
  terminal: 'Terminal',
} as const;

export function getCopy(config: Config = site) {
  const enroll = config.signupMode === 'approval' ? 'Request access' : 'Enroll your project';
  // Only reachable once scfAwarded is true. The built page is linted too.
  const operators = config.scfAwarded ? 'SCF operators' : 'program operators'; // copy-lint-allow

  const nav = [
    { label: 'How it works', href: '#checks' },
    { label: 'Privacy', href: '#privacy' },
    { label: 'API', href: '#api' },
    { label: 'Tracker', href: '#tracker' },
    { label: 'FAQ', href: '#faq' },
  ];

  const faq: FaqItem[] = [
    {
      question: 'What is Lumenstat?',
      answer:
        'Lumenstat is privacy-first web and API analytics for Stellar ecosystem projects. It counts website visits and API requests, and it flags bot and inflated traffic instead of counting it.',
    },
    {
      question: 'Does Lumenstat use cookies?',
      answer: 'No. The tracker sets no cookies, and there is no consent banner.',
    },
    {
      question: 'What does Lumenstat keep about visitors?',
      answer:
        'Location stops at the country, and IP addresses are cut to /24 or /48. Visitor hashes use a random daily salt that is deleted after 48 hours. Query strings are stripped, except utm_* tags.',
    },
    {
      question: 'How does Lumenstat stop fake traffic?',
      answer:
        'Every event passes four checks: real-browser origin and Fetch Metadata, proof of JavaScript, about 8,900 data-center IP ranges, and a per-network visitor limit. Events that fail are stored as flagged, not counted.',
    },
    {
      question: 'Can I see what was flagged?',
      answer: `Yes. Each flagged event is stored with its reason, such as "${reasons.noProof}" or "${reasons.dataCenter}". Your project sees them on its Website page, and ${operators} see them too.`,
    },
    {
      question: 'How does API analytics work?',
      answer:
        "You add a second OpenTelemetry exporter with your project's ingest key. The collector turns spans into per-route counts with p50, p95 and p99 latency, then drops traces and logs. Stellar addresses, ids and hashes in paths become placeholders.",
    },
    {
      question: 'How do I know the tracker has not changed?',
      answer:
        'Each version has its own URL that never changes, and the snippet pins it with a sha384 integrity hash. The build is reproducible byte for byte and is checked in CI and on every deploy. You can hash the file yourself with one command.',
    },
    {
      question: 'Who can enroll?',
      answer:
        'Projects in the Stellar ecosystem. You sign up with your domain and one Stellar link: your SCF project page, a stellar.expert page, or a Stellar account, which is checked on Horizon mainnet.',
    },
    ...(config.repoPublic
      ? [
          {
            question: 'Is Lumenstat open source?',
            answer: 'Yes. The code is MIT licensed and public on GitHub, with a security policy.',
          },
        ]
      : []),
    {
      question: 'Where does Lumenstat run?',
      answer:
        'On one Docker host in the EU, with no published ports, reached through Cloudflare Tunnel. The domain uses DNSSEC, and the infrastructure is written as code with OpenTofu and Ansible.',
    },
    {
      question: 'Is Lumenstat affiliated with the Stellar Development Foundation?',
      answer:
        'No. Lumenstat is an independent project built by Boundless. It is not affiliated with, sponsored or endorsed by the Stellar Development Foundation.',
    },
  ];

  return {
    enroll,
    signIn: 'Sign in',
    docs: 'Docs',
    nav,

    hero: {
      eyebrow: 'Web analytics · API analytics · Bot defense',
      title: { lead: 'Proof of usage', rest: 'for the Stellar ecosystem.' } satisfies TwoTone,
      lead: 'Privacy-first web and API analytics for Stellar projects. No cookies, no consent banner, and bot traffic is flagged, not counted.',
      secondary: 'See how it works',
      micro: config.repoPublic ? 'Open source under MIT. Hosted in the EU.' : 'Hosted in the EU.',
      figure: {
        label: 'FIG 01 · FOUR CHECKS',
        caption: 'Simulated traffic, not real data. Events that fail a check are flagged, not counted.',
        aria: 'Diagram with simulated events. Each event passes four checks: real browser, proof of JavaScript, data-center ranges and per-network limit. Events that fail a check move to a list labelled Flagged, not counted, with the reason.',
        gates: ['01 REAL BROWSER', '02 PROOF OF JS', '03 DATA CENTER', '04 PER NETWORK'],
        counted: 'COUNTED',
        tray: 'FLAGGED, NOT COUNTED',
      },
    },

    checks: {
      eyebrow: 'Bot and inflation defense',
      title: {
        lead: 'Four checks before a visit counts.',
        rest: 'The rest are flagged, not counted.',
      } satisfies TwoTone,
      lead: 'Anyone can script fake page views. Lumenstat checks every event four ways and keeps the failures, labelled, where you can see them.',
      cards: [
        {
          n: '01',
          title: 'Real browser',
          text: 'Origin and Fetch Metadata checks confirm the event came from a browser on your site.',
          detail: 'origin · fetch metadata',
        },
        {
          n: '02',
          title: 'Proof of JavaScript',
          text: 'The tracker solves a small proof-of-work on the page. Scripts that skip it are flagged.',
          detail: 'proof-of-work in l.js',
        },
        {
          n: '03',
          title: 'Data-center ranges',
          text: 'About 8,900 IP ranges from AWS, Google Cloud, Oracle, DigitalOcean, Akamai, Hetzner, OVH, Contabo, Vultr and others.',
          detail: '~8,900 ranges',
        },
        {
          n: '04',
          title: 'Per-network limit',
          text: 'One network can only add so many visitors.',
          detail: 'per-network cap',
        },
      ],
      flagged: {
        title: 'Flagged, not counted',
        text: `Failed events are stored with the reason and kept out of your totals. Your project sees them on its Website page, and ${operators} see them too.`,
        chips: [
          reasons.noOrigin,
          reasons.notBrowser,
          reasons.otherDomain,
          reasons.noProof,
          reasons.invalidProof,
          reasons.dataCenter,
          reasons.perNetwork,
        ],
      },
    },

    privacy: {
      eyebrow: 'Privacy',
      title: 'No cookies. No consent banner.',
      lead: 'Lumenstat runs Umami v3.5.0 with four small, documented patches. Two keep less data. Two keep the counts honest.',
      rows: [
        {
          title: 'Country, not city',
          text: 'Location stops at the country. IP addresses are cut before the location lookup.',
          detail: '/24 or /48',
        },
        {
          title: 'A new salt every day',
          text: 'Visitor hashes use a random daily salt. The salt is deleted after 48 hours.',
          detail: 'deleted after 48h',
        },
        {
          title: 'Clean URLs',
          text: 'Query strings are stripped. Campaign tags stay.',
          detail: 'except utm_*',
        },
        {
          title: 'Nothing in the browser',
          text: 'The tracker sets no cookies, so there is no banner to show.',
          detail: '0 cookies',
        },
      ],
      closing: "This page runs the same tracker. Open your browser's storage and check.",
    },

    api: {
      eyebrow: 'API analytics',
      title: {
        lead: 'API analytics without traces or logs.',
        rest: 'Every route, measured.',
      } satisfies TwoTone,
      lead: "Add a second OpenTelemetry exporter with your project's ingest key. The collector turns spans into per-route counts and latency, then drops traces and logs.",
      figure: {
        label: 'FIG 02 · ROUTE NORMALIZATION',
        caption: 'Simulated requests. Addresses are generated for this page and belong to no one.',
        aria: 'Diagram: raw request paths containing Stellar addresses, a transaction hash and an id are rewritten to routes with placeholders such as {account}, {contract}, {hash} and {id}, then grouped into one row per route with p50, p95 and p99 latency.',
        rawHeading: 'Raw path',
        storedHeading: 'Stored route',
        routeHeading: 'Route',
        latencyHeading: 'Latency (simulated)',
        validAccount: 'valid G address',
        validContract: 'valid C address',
        merged: '3 requests',
      },
      rows: [
        {
          title: 'Stellar-aware routes',
          text: 'G, C and M addresses, ids and hashes become placeholders, so one route is one row.',
          detail: '{account} {contract} {hash}',
        },
        {
          title: 'Latency that adds up',
          text: 'p50, p95 and p99 for every route.',
          detail: 'p50 · p95 · p99',
        },
        {
          title: 'Keys per project',
          text: 'Each project issues its own ingest key. Keys are hashed at rest.',
          detail: 'hashed at rest',
        },
      ],
    },

    tracker: {
      eyebrow: 'Supply chain',
      title: {
        lead: 'Check the script before you trust it.',
        rest: 'The bytes are pinned.',
      } satisfies TwoTone,
      lead: 'Every snippet pins the tracker by version and by hash. If the file ever changes, the browser refuses to run it.',
      figure: {
        label: 'FIG 03 · VERIFY THE TRACKER',
        caption: 'A replay of the command below. Run it yourself and compare.',
        aria: 'The sha384 hash printed by the command matches the integrity value in the snippet.',
        snippetHeading: 'Snippet',
        match: 'Match',
        release: `Tracker ${facts.tracker.version} · ${facts.tracker.bytesLabel} bytes · released ${facts.tracker.released}`,
      },
      facts: [
        { text: 'Versioned, immutable URLs.', detail: facts.tracker.path },
        { text: 'Subresource Integrity in every snippet.', detail: 'sha384' },
        {
          text: 'A reproducible build, checked byte for byte in CI and on every deploy.',
          detail: `${facts.tracker.bytesLabel} bytes`,
        },
        { text: 'Published to npm with provenance.', detail: '@lumenstat/tracker' },
      ],
      snippetFile: 'index.html',
    },

    enrollment: {
      eyebrow: 'Get started',
      title: 'Enroll with a Stellar link.',
      lead: 'Three steps. The third is optional.',
      steps: [
        {
          title: 'Sign up',
          text: 'Add your domain and one Stellar link: your SCF project page, a stellar.expert page, or a Stellar account. Accounts are checked on Horizon mainnet.',
        },
        {
          title: 'Add the snippet',
          text: 'Paste the pinned snippet from your Setup page into your site.',
        },
        {
          title: 'Measure your API',
          text: 'Optional. Add an OpenTelemetry exporter with your ingest key.',
        },
      ],
      note:
        config.signupMode === 'approval'
          ? 'New projects are reviewed before they go live.'
          : 'Programs can run sign-up open or with approval.',
    },

    operators: {
      eyebrow: 'For programs',
      title: { lead: 'One pipeline.', rest: 'The same rules for every project.' } satisfies TwoTone,
      lead: 'Every project is measured by the same pipeline with the same bot rules, so operators can compare them on equal terms.',
      projects: { title: 'Projects see', views: ['Overview', 'Website', 'API', 'Setup'] },
      operators: {
        title: 'Operators see',
        views: ['All projects', 'Compare', 'Traffic quality', 'Enrollment'],
      },
      schematic: {
        columns: ['Project', 'Sites', 'Visitors', 'Page views', 'API requests', 'API 5xx', 'API p95'],
        caption: 'Schematic of the operator view.',
        aria: 'Schematic of the operator view: a navigation list with All projects, Compare, Traffic quality and Enrollment, and a table with the columns Project, Sites, Visitors, Page views, API requests, API 5xx and API p95. No data is shown.',
      },
      screenshots: {
        operatorAlt:
          'Operator view listing projects with sites, visitors, page views, API requests, API 5xx and API p95.',
        projectAlt: 'Project Website page with the Flagged, not counted panel.',
        caption: 'Dashboard with a sample project.',
      },
      footnote: 'The dashboard is built with the Stellar Design System.',
    },

    infra: {
      eyebrow: 'How it runs',
      title: config.repoPublic ? 'Small, open and easy to audit.' : 'Small and easy to reason about.',
      rows: [
        ...(config.repoPublic
          ? [{ text: 'MIT licensed, with a security policy.', detail: 'LICENSE · SECURITY.md' }]
          : []),
        { text: 'One Docker host in the EU, with no published ports.', detail: 'eu · docker' },
        { text: 'Reached through Cloudflare Tunnel.', detail: 'cloudflare tunnel' },
        { text: 'DNSSEC on the domain.', detail: 'dnssec' },
        { text: 'Infrastructure as code, with OpenTofu and Ansible.', detail: 'opentofu · ansible' },
      ],
      cta: 'Read the code',
    },

    faq: {
      eyebrow: 'FAQ',
      title: 'Frequently asked questions',
      items: faq,
    },

    final: {
      title: 'Start measuring your Stellar project.',
      text: 'Enroll with your domain and one Stellar link.',
      secondary: config.repoPublic ? 'Read the code' : 'See how it works',
    },

    footer: {
      tagline,
      builtBy: 'Built by',
      productHeading: 'Product',
      projectHeading: 'Project',
      github: 'GitHub',
      security: 'Security policy',
      publicStats: 'Public stats',
      aboutHeading: 'About this site',
      about: `This site is hosted on Vercel. It loads nothing from third parties. Visits are counted by Lumenstat tracker ${facts.tracker.version}, without cookies.`,
      trademark:
        '"Stellar" is a trademark of the Stellar Development Foundation. All rights reserved. Lumenstat is an independent project, not affiliated with, sponsored or endorsed by the Stellar Development Foundation.',
    },

    notFound: {
      title: 'Page not found.',
      text: 'This page does not exist.',
      link: 'Go to the home page',
    },

    meta: {
      title: 'Lumenstat: Privacy-first analytics for Stellar projects',
      description: config.repoPublic
        ? 'Website and API analytics for Stellar projects. No cookies, no consent banner, and bot traffic is flagged, not counted. Open source and hosted in the EU.'
        : 'Website and API analytics for Stellar projects. No cookies, no consent banner, and bot traffic is flagged, not counted. Hosted in the EU.',
      ogTitle: 'Lumenstat: Proof of usage for the Stellar ecosystem',
      ogDescription:
        'Privacy-first web and API analytics for Stellar projects. Bot traffic is flagged, not counted.',
      softwareDescription:
        'Privacy-first web and API analytics for Stellar ecosystem projects. Bot and inflated traffic is flagged, not counted.',
    },
  };
}

export type Copy = ReturnType<typeof getCopy>;

export const copy = getCopy();
