import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// The interim mark, full bleed: iOS rounds the corners itself.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#6E56CF' }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <rect x="8" y="17" width="4" height="7" rx="1" fill="#fff" />
          <rect x="14" y="12.5" width="4" height="11.5" rx="1" fill="#fff" />
          <rect x="20" y="8" width="4" height="16" rx="1" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
