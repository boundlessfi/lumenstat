import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { copy } from '../content/copy';

export const alt = 'Lumenstat. Proof of usage for the Stellar ecosystem.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Fonts are read from committed files: no network at build or run time.
const font = (file: string) => readFile(join(process.cwd(), 'assets/fonts', file));

const GATES = [660, 780, 900, 1020];

export default async function OpenGraphImage() {
  const [inter, mono] = await Promise.all([
    font('inter-latin-600-normal.woff'),
    font('inconsolata-latin-500-normal.woff'),
  ]);

  const grid: number[] = [];
  for (let i = 0; i <= 50; i++) grid.push(i * 24);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#161616',
          color: '#ededed',
          fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* The faint hairline grid, and a four-gate motif with one flagged event peeling off. */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {grid.map(v => (
            <line key={`v${v}`} x1={v} y1="0" x2={v} y2="630" stroke="#1f1f1f" strokeWidth="1" />
          ))}
          {grid
            .filter(v => v <= 630)
            .map(v => (
              <line key={`h${v}`} x1="0" y1={v} x2="1200" y2={v} stroke="#1f1f1f" strokeWidth="1" />
            ))}
          <line x1="600" y1="150" x2="1128" y2="150" stroke="#505050" strokeWidth="2" />
          {GATES.map(x => (
            <line key={x} x1={x} y1="118" x2={x} y2="182" stroke="#707070" strokeWidth="2" />
          ))}
          <circle cx="624" cy="150" r="9" fill="#9e8cfc" />
          <circle cx="720" cy="150" r="9" fill="#9e8cfc" />
          <circle cx="960" cy="150" r="9" fill="#9e8cfc" />
          <circle cx="1104" cy="150" r="9" fill="#9e8cfc" />
          <path d="M 900 150 Q 900 232 800 244" fill="none" stroke="#573300" strokeWidth="2" />
          <circle cx="800" cy="244" r="9" fill="#161616" stroke="#f1a10d" strokeWidth="3" />
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#6E56CF" />
            <rect x="8" y="17" width="4" height="7" rx="1" fill="#fff" />
            <rect x="14" y="12.5" width="4" height="11.5" rx="1" fill="#fff" />
            <rect x="20" y="8" width="4" height="16" rx="1" fill="#fff" />
          </svg>
          <div style={{ fontSize: 34, letterSpacing: -0.7 }}>Lumenstat</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, letterSpacing: -2.3, lineHeight: 1.06 }}>
          <div>{copy.hero.title.lead}</div>
          <div style={{ color: '#9e8cfc' }}>{copy.hero.title.rest}</div>
        </div>

        <div style={{ fontFamily: 'Inconsolata', fontSize: 26, color: '#a0a0a0', letterSpacing: 1 }}>
          lumenstat.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: inter, style: 'normal', weight: 600 },
        { name: 'Inconsolata', data: mono, style: 'normal', weight: 500 },
      ],
    },
  );
}
