import type { MetadataRoute } from 'next';
import { site } from '../site.config';

// Everything is allowed, AI crawlers included: showing up in AI answers is a goal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
