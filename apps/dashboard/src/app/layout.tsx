import '@stellar/design-system/build/styles.min.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inconsolata, Inter } from 'next/font/google';
import type { ReactNode } from 'react';

// Fonts are downloaded at build time and served from this app, so viewers'
// browsers never contact Google.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = Inconsolata({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'SCF Analytics', template: '%s · SCF Analytics' },
  description: 'Privacy-first web and API analytics for projects building on Stellar.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`sds-theme-light ${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
