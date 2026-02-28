import { sendJson, readJsonBody } from '../../../_lib/http';
import { githubCache } from '../../_lib/github';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  // Read body to match the old endpoint behavior (even though we don't need it).
  // This also ensures Vercel doesn't keep the request stream open.
  await readJsonBody(req);

  const username = String(req.query?.username || '').trim();
  if (!username) {
    return sendJson(res, 400, { message: 'Missing username' });
  }

  const userKey = `user_${username.toLowerCase()}`;
  const reposKey = `repos_${username.toLowerCase()}`;
  githubCache.deleteMany([userKey, reposKey]);

  return sendJson(res, 200, { message: `Cache cleared for ${username}`, deletedCount: 2 });
}
