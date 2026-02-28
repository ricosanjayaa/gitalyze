import { sendJson } from '../../../_lib/http';
import { cachedJsonFetch } from '../../_lib/github';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const username = String(req.query?.username || '').trim();
  if (!username) {
    return sendJson(res, 400, { message: 'Missing username' });
  }

  try {
    const url = `https://api.github.com/users/${username}/repos?per_page=100`;
    const data = await cachedJsonFetch<any[]>(`repos_${username.toLowerCase()}`, url);
    return sendJson(res, 200, data);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Failed to fetch repos from GitHub' });
  }
}
