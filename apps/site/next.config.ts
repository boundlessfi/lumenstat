import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
// Set by Vercel during its builds. `upgrade-insecure-requests` is only sent
// there: on http://localhost Safari would upgrade the page's own assets to
// HTTPS, and a local production build could not load its CSS or scripts.
const onVercel = Boolean(process.env.VERCEL);

// The only origin this site may contact besides itself is Lumenstat's own tracker.
// 'unsafe-inline' in script-src is a deliberate trade-off: Next.js needs inline
// bootstrap scripts, and a nonce would force dynamic rendering. See README.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://t.lumenstat.com`,
  `connect-src 'self' https://t.lumenstat.com${dev ? ' ws:' : ''}`,
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(onVercel ? ['upgrade-insecure-requests'] : []),
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default config;
