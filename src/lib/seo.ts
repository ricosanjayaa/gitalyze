import metadata from '../../metadata.json';
import { siteConfig } from '../../site.config';
import type { GitHubUser } from './github';
import type { ScoreBreakdown } from './scoring';

/**
 * Structured metadata that every page can provide to the shared SEO layer.
 */
export interface SeoOpenGraph {
  title?: string;
  description?: string;
  url?: string;
  type?: string;
}

export interface SeoMetadata {
  title?: string;
  description?: string;
  canonicalPath?: string;
  canonicalUrl?: string;
  openGraph?: SeoOpenGraph;
  keywords?: string[];
  robots?: string;
  meta?: Array<{ name: string; content: string }>;
}

/** Metadata derived from `metadata.json` that never changes at runtime. */
export const siteMetadata = {
  name: metadata.name,
  description: metadata.description,
  keywords: metadata.keywords ?? [],
  themeColor: metadata.themeColor,
};

/** Resolve a relative path into a fully qualified URL within this site. */
export function resolveUrl(path?: string) {
  if (!path) {
    return siteConfig.siteUrl;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, siteConfig.siteUrl).toString();
}

/**
 * Build metadata for the home page to highlight the hero copy.
 */
export function buildHomeMetadata(): SeoMetadata {
  const title = `${siteMetadata.name} · GitHub analytics, reimagined`;
  return {
    title,
    description: siteMetadata.description,
    canonicalPath: '/',
    keywords: siteMetadata.keywords,
    openGraph: {
      title,
      description: siteMetadata.description,
      url: resolveUrl('/'),
      type: 'website',
    },
  };
}

interface DashboardMetadataOptions {
  user: GitHubUser;
  scoreData?: ScoreBreakdown | null;
  totalStars?: number;
  totalForks?: number;
}

/**
 * Build metadata for a dashboard that showcases a specific GitHub profile.
 * @param user required user info containing login and optional name/bio
 * @param scoreData optional score breakdown used to highlight performance grade
 * @param totalStars optional aggregated star count
 * @param totalForks optional aggregated fork count
 */
export function buildDashboardMetadata({
  user,
  scoreData,
  totalStars = 0,
  totalForks = 0,
}: DashboardMetadataOptions): SeoMetadata {
  const displayName = user.name ?? user.login;
  const gradeCopy = scoreData?.grade ? ` ${scoreData.grade} grade` : '';
  const title = `${displayName} · ${siteMetadata.name}`;
  const description = `${displayName} has ${totalStars.toLocaleString()} stars and ${totalForks.toLocaleString()} forks across ${user.public_repos} repositories${gradeCopy}.`;
  return {
    title,
    description,
    canonicalPath: `/dashboard/${user.login}`,
    keywords: [user.login, 'GitHub dashboard', 'repository score'],
    openGraph: {
      title,
      description,
      url: resolveUrl(`/dashboard/${user.login}`),
      type: 'profile',
    },
  };
}

export interface RepoMetadataInput {
  name: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  topics?: string[];
  owner?: {
    login: string;
    avatar_url?: string;
  };
}

/**
 * Build metadata for an individual repository detail page.
 * @param repo repository data coming from the GitHub API (or server)
 */
export function buildRepoMetadata(repo: RepoMetadataInput): SeoMetadata {
  const ownerHandle = repo.owner?.login ?? repo.full_name.split('/')[0];
  const cleanDescription = repo.description ?? `Detailed analytics for ${repo.full_name}.`;
  const title = `${repo.name} by ${ownerHandle} · ${siteMetadata.name}`;
  const topics = repo.topics?.filter(Boolean) ?? [];
  const keywordList = [ownerHandle, repo.name, ...topics].slice(0, 8);
  return {
    title,
    description: cleanDescription,
    canonicalPath: `/repo/${ownerHandle}/${repo.name}`,
    keywords: keywordList,
    openGraph: {
      title,
      description: `${cleanDescription}${topics.length ? ` · Topics: ${topics.slice(0, 3).join(', ')}` : ''}`,
      url: resolveUrl(`/repo/${ownerHandle}/${repo.name}`),
      type: 'repository',
    },
  };
}
