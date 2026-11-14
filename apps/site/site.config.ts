// Every piece of copy or link that depends on an open decision reads from here.
// Defaults are the safe choice. See README.md for what each switch changes.
export const site = {
  url: 'https://lumenstat.com', // canonical apex; www redirects to it (a Vercel setting)
  appUrl: 'https://app.lumenstat.com',
  signupUrl: 'https://app.lumenstat.com/signup',
  signinUrl: 'https://app.lumenstat.com/login',

  // D2: repo visibility. While false, every GitHub link and every "open source" claim is hidden.
  repoPublic: false as boolean,
  repoUrl: 'https://github.com/boundlessfi/lumenstat',

  // D3: docs site. null hides the Docs links.
  docsUrl: 'https://docs.lumenstat.com' as string | null,

  // D4: enrollment mode at launch. 'open' → "Enroll your project". 'approval' → "Request access".
  signupMode: 'open' as 'open' | 'approval',

  // D5: SCF relationship. Keep false until an award is public.
  // While false, the page never says "SCF uses" or "SCF operators".
  scfAwarded: false as boolean,

  // D6: credits.
  builtBy: { name: 'Boundless', url: 'https://www.boundlessfi.xyz' },
  legalEntity: 'Thirtn Limited', // footer copyright; confirm with the owner

  // D7: Lumenstat's own website id for lumenstat.com is read from the env var
  // NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID. The tracker tag renders only when it is set
  // AND VERCEL_ENV === 'production'. See app/layout.tsx.

  // D8: optional public stats page for lumenstat.com. null hides the footer link.
  publicStatsUrl: null as string | null,

  // D9: real dashboard screenshots. false renders the numberless schematic.
  screenshots: false as boolean,

  // D10: theme. Dark only for v1.
} as const;

export type Site = typeof site;
