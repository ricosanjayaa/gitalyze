import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';

const githubCache = new NodeCache({ stdTTL: 900 }); // 15 minute TTL

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes will go here
  app.get('/api/github/user/:username', async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const cacheKey = `user_${username}`;
      if (githubCache.has(cacheKey)) {
        return res.json(githubCache.get(cacheKey));
      }
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Authorization: `token ${process.env.GITHUB_API_TOKEN}`,
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`);
      }
      const data = await response.json();
      githubCache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch user from GitHub' });
    }
  });

  app.get('/api/github/user/:username/repos', async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const cacheKey = `repos_${username}`;
      if (githubCache.has(cacheKey)) {
        return res.json(githubCache.get(cacheKey));
      }
      const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
        headers: {
          Authorization: `token ${process.env.GITHUB_API_TOKEN}`,
        },
      });
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`);
      }
      const data = await response.json();
      githubCache.set(cacheKey, data);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch repos from GitHub' });
    }
  });

  app.get('/api/github/repo/:owner/:repoName', async (req: Request, res: Response) => {
    try {
      const { owner, repoName: repo } = req.params;
      const cacheKey = `repo_detail_${owner}_${repo}`;
      if (githubCache.has(cacheKey)) {
        return res.json(githubCache.get(cacheKey));
      }

      const [repoRes, contributorsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `token ${process.env.GITHUB_API_TOKEN}` },
        }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`, {
          headers: { Authorization: `token ${process.env.GITHUB_API_TOKEN}` },
        }),
      ]);

      if (!repoRes.ok) throw new Error(`GitHub API responded with ${repoRes.status} for repo details`);
      if (!contributorsRes.ok) throw new Error(`GitHub API responded with ${contributorsRes.status} for contributors`);

      const repoData = await repoRes.json();
      const contributorsData = await contributorsRes.json();

      const responseData = {
        ...repoData,
        contributors: contributorsData,
      };

      githubCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch repo details from GitHub' });
    }
  });

  app.get('/api/github/repo/:owner/:repoName/readme', async (req: Request, res: Response) => {
    try {
      const { owner, repoName: repo } = req.params;
      const cacheKey = `readme_${owner}_${repo}`;
      if (githubCache.has(cacheKey)) {
        return res.json({ readme: githubCache.get(cacheKey) });
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: {
          Authorization: `token ${process.env.GITHUB_API_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      });

      if (!response.ok) {
        // If README is not found, it's not a server error. Send back empty content.
        if (response.status === 404) {
          githubCache.set(cacheKey, '');
          return res.json({ readme: '' });
        }
        throw new Error(`GitHub API responded with ${response.status} for README`);
      }

      const readmeContent = await response.text();
      githubCache.set(cacheKey, readmeContent);
      res.json({ readme: readmeContent });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch README from GitHub' });
    }
  });

  app.post('/api/github/cache/clear/:username', (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const userKey = `user_${username}`;
      const reposKey = `repos_${username}`;
      
      const deletedCount = githubCache.del([userKey, reposKey]);
      
      res.status(200).json({ message: `Cache cleared for ${username}`, deletedCount });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      res.status(500).json({ message: 'Failed to clear cache' });
    }
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
