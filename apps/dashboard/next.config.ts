import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // A self-contained server bundle for the Docker image.
  output: 'standalone',
  transpilePackages: ['@stellar/design-system'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'referrer-policy', value: 'same-origin' },
          { key: 'x-frame-options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
