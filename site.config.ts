import metadata from './metadata.json';
import type { SitemapEntry } from './src/lib/sitemap';

interface ViteEnv {
  VITE_SITE_URL?: string;
}

function getEnvSiteUrl() {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const value = (import.meta.env as ViteEnv).VITE_SITE_URL;
    if (value) {
      return value;
    }
  }

  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    const value = process.env.SITE_URL;
    if (value) {
      return value;
    }
  }

  return metadata.origin ?? 'http://localhost:3000';
}

const rawSiteUrl = getEnvSiteUrl();
const normalizedSiteUrl = rawSiteUrl.replace(/\/$/, '');

/** Shared configuration for sitemap generation and metadata helpers. */
export const siteConfig = {
  siteUrl: normalizedSiteUrl,
  defaultChangeFreq: 'weekly',
  defaultPriority: 0.5,
  routes: [
    { path: '/', changefreq: 'daily', priority: 0.9 },
    { path: '/dashboard', changefreq: 'weekly', priority: 0.7 },
    { path: '/redirect', changefreq: 'monthly', priority: 0.3 },
  ] satisfies SitemapEntry[],
};

export type SiteConfig = typeof siteConfig;
