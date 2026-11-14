/** Plain-English names for the flag reasons stored by the Umami patch (src/lib/scf/quality.ts). */
export const FLAG_REASONS: Record<string, string> = {
  missing_origin: 'No browser origin',
  not_browser_fetch: 'Not a browser request',
  no_site_domain: 'Site has no domain',
  origin_mismatch: 'Sent from another domain',
  no_proof: 'No proof of JavaScript',
  bad_proof: 'Invalid proof of JavaScript',
  datacenter_ip: 'Data-center IP',
  many_visitors_per_network: 'Too many visitors from one network',
};

export const reasonLabel = (reason: string) => FLAG_REASONS[reason] ?? reason;
