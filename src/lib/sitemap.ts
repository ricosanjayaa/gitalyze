export interface SitemapEntry {
  /** Path relative to the site root (must start with `/`). */
  path: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Optional ISO date string (e.g. `2026-02-28`). */
  lastmod?: string;
}

function ensureLeadingSlash(value: string) {
  if (!value.startsWith('/')) {
    return `/${value}`;
  }
  return value;
}

/** Build a sitemap XML string from the provided routes and the canonical site URL. */
export function buildSitemapXml(siteUrl: string, entries: SitemapEntry[]) {
  const encoded = entries
    .map((entry) => {
      const path = ensureLeadingSlash(entry.path);
      const url = new URL(path, siteUrl).toString();
      const lines = [
        '  <url>',
        `    <loc>${url}</loc>`,
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
        typeof entry.priority === 'number' ? `    <priority>${Math.min(1, Math.max(0, entry.priority)).toFixed(1)}</priority>` : null,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
        '  </url>',
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    encoded,
    '</urlset>',
  ].join('\n');
}

/** Generate a basic robots.txt referencing the sitemap. */
export function buildRobotsTxt(siteUrl: string, sitemapPath = '/sitemap.xml') {
  const sitemapUrl = new URL(ensureLeadingSlash(sitemapPath), siteUrl).toString();
  return ['User-agent: *', 'Allow: /', `Sitemap: ${sitemapUrl}`].join('\n');
}
