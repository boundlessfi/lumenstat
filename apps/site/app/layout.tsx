import '../styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Inconsolata, Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { LIVE_REGION_ID } from '../components/CopyButton';
import { Enhance } from '../components/Enhance';
import { copy, microcopy } from '../content/copy';
import { facts } from '../content/facts';
import { buildJsonLd, serializeJsonLd } from '../lib/jsonld';
import { site } from '../site.config';
import styles from './layout.module.css';

// next/font downloads the files at build time and serves them from this site,
// so browsers never contact Google.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = Inconsolata({ subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: copy.meta.title,
  description: copy.meta.description,
  applicationName: 'Lumenstat',
  creator: site.builtBy.name,
  publisher: site.builtBy.name,
  category: 'technology',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Lumenstat',
    locale: 'en_US',
    title: copy.meta.ogTitle,
    description: copy.meta.ogDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: copy.meta.ogTitle,
    description: copy.meta.ogDescription,
  },
};

export const viewport: Viewport = {
  themeColor: '#161616',
  colorScheme: 'dark',
};

// Lumenstat's own tracker, pinned by version and hash like any tenant's.
// It renders only in Vercel production with a website id set, so previews
// and local runs stay out of the stats.
const websiteId = process.env.NEXT_PUBLIC_LUMENSTAT_WEBSITE_ID;
const trackerOn = Boolean(websiteId) && process.env.VERCEL_ENV === 'production';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(copy)) }}
        />
        {trackerOn ? (
          <script
            defer
            src={facts.tracker.url}
            integrity={facts.tracker.integrity}
            crossOrigin="anonymous"
            data-website-id={websiteId}
            data-domains="lumenstat.com"
          />
        ) : null}
      </head>
      <body>
        <a href="#main" className={styles.skip}>
          {microcopy.skip}
        </a>
        {/* Watched by Enhance: the header gets its hairline once this leaves the viewport. */}
        <div id="scroll-sentinel" className={styles.sentinel} aria-hidden="true" />
        {children}
        <div id={LIVE_REGION_ID} className="vh" aria-live="polite" />
        <Enhance />
      </body>
    </html>
  );
}
