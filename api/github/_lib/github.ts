import { TtlCache } from '../../_lib/ttl-cache';

const CACHE_TTL_MS = 15 * 60 * 1000;
export const githubCache = new TtlCache();

export function buildGitHubHeaders() {
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_API_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
  }
  return headers;
}

export async function cachedJsonFetch<T>(cacheKey: string, url: string): Promise<T> {
  const cached = githubCache.get<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, { headers: buildGitHubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub API responded with ${response.status}`);
  }
  const data = (await response.json()) as T;
  githubCache.set(cacheKey, data, CACHE_TTL_MS);
  return data;
}

