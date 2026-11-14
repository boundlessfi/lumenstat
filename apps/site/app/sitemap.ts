import type { MetadataRoute } from 'next';
import { site } from '../site.config';

// One page. Add routes here only when pages are added.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.url}/`, lastModified: new Date() }];
}
