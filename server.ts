import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { Request, Response } from 'express';
import NodeCache from 'node-cache';
import path from 'node:path';
import fs from 'node:fs';
import { getGroqRecommendations, getRemediationPlan } from './src/lib/groq';
import type { ScoreBreakdown, GitHubUser, GitHubRepo } from './src/lib/groq';
import { buildSitemapXml, buildRobotsTxt } from './src/lib/sitemap';
import { siteConfig } from './site.config';

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
      // Build headers only if a GitHub API token is provided
      const headers: any = {};
      if (process.env.GITHUB_API_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
      }
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers,
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
      const headers: any = {};
      if (process.env.GITHUB_API_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
      }
      const response = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
        headers,
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

      const headers: any = {};
      if (process.env.GITHUB_API_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
      }
      const [repoRes, contributorsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`, { headers }),
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

      const headers: any = {};
      if (process.env.GITHUB_API_TOKEN) {
        headers.Authorization = `token ${process.env.GITHUB_API_TOKEN}`;
      }
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: {
          ...headers,
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

  app.post('/api/ai/recommendations', async (req: Request, res: Response) => {
    const body = req.body as {
      scoreData: ScoreBreakdown;
      user: GitHubUser;
      repos: GitHubRepo[];
    };
    const { scoreData, user, repos } = body;

    if (!scoreData || !user || !repos) {
      return res.status(400).json({ message: 'Missing required fields: scoreData, user, or repos' });
    }

    const forceFallback = process.env.FORCE_AI_RECS === 'true';
    if (forceFallback) {
      console.log('[SERVER] FORCE_AI_RECS enabled, returning heuristic recommendations');
      const fallbackPlan = getRemediationPlan(scoreData, user, repos);
        return res.json({ recommendations: fallbackPlan, fallback: true, message: 'Heuristic plan; Groq disabled' });
    }

    try {
      // Skip AI if ALL category scores are great (<=75% of max)
      const MAXIMA: Record<string, number> = { activity: 25, quality: 30, volume: 15, diversity: 10, completeness: 10, maturity: 10 };
      const hasWeakCategory = Object.entries(MAXIMA).some(([k, max]) => {
        const val = (scoreData as any)[k] ?? 0;
        return val <= max * 0.75;
      });

      if (!hasWeakCategory) {
        console.log('[SERVER] All categories are strong, skipping AI recommendations');
        return res.json({ recommendations: [] });
      }

      const recommendations = await getGroqRecommendations(user, repos);
      console.log('[SERVER] AI recommendations:', recommendations);
      
      // Return what AI gives - no template fallback
      const finalRecommendations = recommendations;
      console.log('[SERVER] Final recommendations:', finalRecommendations);
      res.json({ recommendations: finalRecommendations });
    } catch (error: any) {
      console.error('[SERVER] AI error:', error.message);
      const status = error?.status || 500;

      // Skip fallback for rate limit errors - return proper 429 to frontend
      if (status === 429) {
        console.log('[SERVER] Groq rate limit, falling back to remediation plan');
        const fallbackPlan = getRemediationPlan(scoreData, user, repos);
        const extra: any = { fallback: true };
        if (error?.details && typeof error.details.retryAfter !== 'undefined') {
          extra.retryAfter = error.details.retryAfter;
        }
        res.status(429).json({ message: error?.message || 'Rate limit exceeded', error: 'RATE_LIMIT', recommendations: fallbackPlan, ...extra });
        return;
      }

      // No fallback - return empty recommendations on error
      res.json({ recommendations: [] });
    }
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  const distDir = path.resolve('dist');
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  const robotsPath = path.join(distDir, 'robots.txt');

  app.get('/sitemap.xml', (_req, res) => {
    if (fs.existsSync(sitemapPath)) {
      return res.sendFile(sitemapPath);
    }
    const xml = buildSitemapXml(siteConfig.siteUrl, siteConfig.routes);
    res.type('application/xml').send(xml);
  });

  app.get('/robots.txt', (_req, res) => {
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    const robots = buildRobotsTxt(siteConfig.siteUrl);
    res.type('text/plain').send(robots);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

  } else {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/sitemap.xml' || req.path === '/robots.txt') {
        return next();
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
