import { TtlCache } from "./ttl-cache";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new TtlCache();

function buildGitHubHeaders() {
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_API_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
  }
  return headers;
}

async function cachedJsonFetch<T>(cacheKey: string, url: string): Promise<T> {
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(url, { headers: buildGitHubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub API responded with ${response.status}`);
  }

  const data = (await response.json()) as T;
  cache.set(cacheKey, data, CACHE_TTL_MS);
  return data;
}

export async function fetchGitHubUser(username: string) {
  const key = `user_${username.toLowerCase()}`;
  return cachedJsonFetch<any>(key, `https://api.github.com/users/${username}`);
}

export async function fetchUserRepos(username: string) {
  const key = `repos_${username.toLowerCase()}`;
  const url = `https://api.github.com/users/${username}/repos?per_page=100`;
  return cachedJsonFetch<any[]>(key, url);
}

export async function fetchUserEvents(username: string) {
  const key = `events_${username.toLowerCase()}`;
  const url = `https://api.github.com/users/${username}/events/public?per_page=30`;
  return cachedJsonFetch<any[]>(key, url);
}

export async function fetchRepoReleases(owner: string, repoName: string) {
  const key = `releases_${owner.toLowerCase()}_${repoName.toLowerCase()}`;
  const url = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=1`;
  return cachedJsonFetch<any[]>(key, url);
}

export async function fetchRepoDetail(owner: string, repoName: string) {
  const key = `repo_detail_${owner.toLowerCase()}_${repoName.toLowerCase()}`;
  const cached = cache.get<any>(key);
  if (cached) return cached;

  const headers = buildGitHubHeaders();
  const [repoRes, contributorsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repoName}/contributors`, { headers }),
  ]);

  if (!repoRes.ok) throw new Error(`GitHub API responded with ${repoRes.status} for repo details`);
  if (!contributorsRes.ok) throw new Error(`GitHub API responded with ${contributorsRes.status} for contributors`);

  const repoData = await repoRes.json();
  const contributorsData = await contributorsRes.json();

  const responseData = {
    ...repoData,
    contributors: contributorsData,
  };

  cache.set(key, responseData, CACHE_TTL_MS);
  return responseData;
}

export async function fetchRepoReadme(owner: string, repoName: string) {
  const key = `readme_${owner.toLowerCase()}_${repoName.toLowerCase()}`;
  const cached = cache.get<string>(key);
  if (typeof cached === "string") return cached;

  const headers = {
    ...buildGitHubHeaders(),
    Accept: "application/vnd.github.v3.raw",
  };

  const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      cache.set(key, "", CACHE_TTL_MS);
      return "";
    }
    throw new Error(`GitHub API responded with ${response.status} for README`);
  }

  const text = await response.text();
  cache.set(key, text, CACHE_TTL_MS);
  return text;
}

export function clearUserCache(username: string) {
  const userKey = `user_${username.toLowerCase()}`;
  const reposKey = `repos_${username.toLowerCase()}`;
  const eventsKey = `events_${username.toLowerCase()}`;
  cache.deleteMany([userKey, reposKey, eventsKey]);
  return 3;
}
