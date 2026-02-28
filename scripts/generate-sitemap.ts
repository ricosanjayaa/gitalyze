import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { siteConfig } from '../site.config';
import { buildSitemapXml, buildRobotsTxt } from '../src/lib/sitemap';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const distDir = path.resolve('dist');
const sitemapPath = path.join(distDir, 'sitemap.xml');
const robotsPath = path.join(distDir, 'robots.txt');

mkdirSync(distDir, { recursive: true });

const sitemapXml = buildSitemapXml(siteConfig.siteUrl, siteConfig.routes);
writeFileSync(sitemapPath, sitemapXml, 'utf-8');

const robotsTxt = buildRobotsTxt(siteConfig.siteUrl);
writeFileSync(robotsPath, robotsTxt, 'utf-8');

console.log(`Generated ${sitemapPath} and ${robotsPath}`);
