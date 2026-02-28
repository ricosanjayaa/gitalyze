import { sendJson } from '../../../_lib/http';
import { githubCache, buildGitHubHeaders } from '../../_lib/github';

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

  const cacheKey = `repo_detail_${owner.toLowerCase()}_${repoName.toLowerCase()}`;
  const cached = githubCache.get<any>(cacheKey);
  if (cached) return sendJson(res, 200, cached);

  try {
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

    githubCache.set(cacheKey, responseData, CACHE_TTL_MS);
    return sendJson(res, 200, responseData);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Failed to fetch repo details from GitHub' });
  }
}
