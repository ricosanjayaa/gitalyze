import { sendJson } from '../../../../_lib/http';
import { githubCache, buildGitHubHeaders } from '../../../_lib/github';

const CACHE_TTL_MS = 15 * 60 * 1000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const owner = String(req.query?.owner || '').trim();
  const repoName = String(req.query?.repoName || '').trim();
  if (!owner || !repoName) {
    return sendJson(res, 400, { message: 'Missing owner or repoName' });
  }

  const cacheKey = `readme_${owner.toLowerCase()}_${repoName.toLowerCase()}`;
  const cached = githubCache.get<string>(cacheKey);
  if (typeof cached === 'string') {
    return sendJson(res, 200, { readme: cached });
  }

  try {
    const headers = {
      ...buildGitHubHeaders(),
      Accept: 'application/vnd.github.v3.raw',
    };

    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, {
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        githubCache.set(cacheKey, '', CACHE_TTL_MS);
        return sendJson(res, 200, { readme: '' });
      }
      throw new Error(`GitHub API responded with ${response.status} for README`);
    }

    const readmeContent = await response.text();
    githubCache.set(cacheKey, readmeContent, CACHE_TTL_MS);
    return sendJson(res, 200, { readme: readmeContent });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Failed to fetch README from GitHub' });
  }
}
