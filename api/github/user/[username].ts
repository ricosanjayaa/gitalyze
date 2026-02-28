import { sendJson } from '../../_lib/http';
import { cachedJsonFetch } from '../_lib/github';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const username = String(req.query?.username || '').trim();
  if (!username) {
    return sendJson(res, 400, { message: 'Missing username' });
  }

  try {
    const data = await cachedJsonFetch<any>(`user_${username.toLowerCase()}`, `https://api.github.com/users/${username}`);
    return sendJson(res, 200, data);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { message: 'Failed to fetch user from GitHub' });
  }
}
