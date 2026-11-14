import type { MetadataRoute } from 'next';
import { copy } from '../content/copy';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lumenstat',
    short_name: 'Lumenstat',
    description: copy.meta.description,
    start_url: '/',
    display: 'browser',
    background_color: '#161616',
    theme_color: '#161616',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
