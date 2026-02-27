export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
    node_id: string;
  } | null;
  topics: string[];
  visibility: string;
  default_branch: string;
  archived: boolean;
}

export interface GitHubError {
  message: string;
  documentation_url?: string;
}

const API_BASE_URL = '/api/github';

export async function fetchGitHubUser(username: string): Promise<GitHubUser> {
  const response = await fetch(`${API_BASE_URL}/user/${username}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch user: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchUserRepos(username: string): Promise<GitHubRepo[]> {
  const response = await fetch(`${API_BASE_URL}/user/${username}/repos`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch repos: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchReadMe(owner: string, repo: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/repo/${owner}/${repo}/readme`);
  if (!response.ok) {
    console.log(`README not found for ${owner}/${repo}, returning empty string`);
    return ''; // Return empty string if README doesn't exist
  }
  const data = await response.json();
  return data.readme;
}
