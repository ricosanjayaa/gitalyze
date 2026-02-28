import { ScoreBreakdown } from "./scoring";
import { GitHubUser, GitHubRepo } from "./github";
import { generateRecommendations } from "./recommendation";

// small type re-exports for server usage
export type { ScoreBreakdown, GitHubUser, GitHubRepo };

// Server-side cache for recommendations (5 minute TTL)
const recommendationCache = new Map<string, { data: string[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedRecommendations(username: string): string[] | null {
  const cached = recommendationCache.get(username.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[CACHE] Returning cached recommendations for:', username);
    return cached.data;
  }
  recommendationCache.delete(username.toLowerCase());
  return null;
}

function setCachedRecommendations(username: string, data: string[]): void {
  recommendationCache.set(username.toLowerCase(), { data, timestamp: Date.now() });
  console.log('[CACHE] Cached recommendations for:', username);
}

function getOpenRouterConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    endpoint: process.env.OPENROUTER_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions',
    model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free',
    timeoutMS: Number(process.env.OPENROUTER_TIMEOUT_MS) || 15000,
    maxRetries: Number(process.env.OPENROUTER_MAX_RETRIES) || 2,
  };
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// Minimal, robust OpenRouter caller that keeps prompts small and dynamic.
export async function getAIRecoomendations(
  user: GitHubUser,
  repos: GitHubRepo[]
): Promise<string[]> {
  const cfg = getOpenRouterConfig();
  if (!cfg.apiKey) throw { code: 'MISSING_API_KEY', message: 'OPENROUTER_API_KEY not set.' };

  // Check server-side cache first
  const cachedRecs = getCachedRecommendations(user.login);
  if (cachedRecs) {
    return cachedRecs;
  }

  // Prepare compact profile data
  const accountAge = user.created_at ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
  const languages = [...new Set(repos.map(r => r.language).filter(Boolean))];
  const top = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  const recentlyUpdated = repos.filter(r => {
    const daysSinceUpdate = (Date.now() - new Date(r.pushed_at).getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceUpdate <= 30;
  }).length;

  // Compact prompt for AI - optimized for Qwen3
  const system = `You are a senior engineer mentoring developers on GitHub portfolios. Give 2-4 unique recommendations as a JSON array. Start each with an action verb. If the user has only a profile README (Top: profile-only), recommend creating REAL project repositories, NOT improving the README. If profile is strong, return [].`;

  // Compact user data - with profile detection
  const isProfileOnly = top?.name === user.login;
  const userMsg = `${user.login}: ${user.public_repos} repo, ${accountAge}yr, ${user.followers} followers, ${languages.slice(0,3).join(',') || '-'}. Top: ${isProfileOnly ? 'profile-only' : top?.name || '-'}. Missing: ${!user.bio ? 'bio ' : ''}${!user.location ? 'loc ' : ''}${!user.blog ? 'blog' : ''}. Active: ${recentlyUpdated > 0 ? 'yes' : 'no'}.`;

  const maxAttempts = cfg.maxRetries + 1;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.timeoutMS);
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.6,
          max_tokens: 300,
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        lastErr = { status: res.status, details: errData };

        // Rate-limited: auto retry with backoff (max 2 retries)
        if (res.status === 429) {
          if (attempt < maxAttempts) {
            const backoffMs = 10000 * Math.pow(2, attempt - 1); // 10s, 20s
            console.log(`[AI] Rate limited, retrying in ${backoffMs/1000}s (attempt ${attempt + 1}/${maxAttempts})`);
            await sleep(backoffMs);
            continue;
          }
          // After retries exhausted, surface the error
          const retryAfterHeader = res.headers?.get ? res.headers.get('retry-after') : null;
          const retryAfter = retryAfterHeader ? (parseInt(retryAfterHeader, 10) || 60) : 60;
          throw { code: 'RATE_LIMIT', message: errData.message || 'OpenRouter rate limit exceeded', status: 429, details: { retryAfter } };
        }

        // For server errors, allow a single retry
        if (res.status >= 500 && attempt < maxAttempts) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000;
          console.log(`[AI] Server error ${res.status}, retrying in ${Math.round(backoff)}ms`);
          await sleep(backoff);
          continue;
        }

        throw { code: 'OPENROUTER_API_ERROR', message: errData.message || `HTTP ${res.status}`, status: res.status, details: errData };
      }

      const body = await res.json();
      console.log('[AI] Raw response:', JSON.stringify(body).slice(0, 500));

      // Robustly extract text from various AI response shapes (different providers/models)
      const extractText = (b: any): string => {
        if (!b) return '';
        const c = b.choices?.[0];
        if (!c) return '';
        if (typeof c === 'string') return c;
        if (c?.message?.content) return c.message.content;
        if (c?.message?.reasoning) return c.message.reasoning;
        if (typeof c?.text === 'string') return c.text;
        if (typeof c?.content === 'string') return c.content;
        if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'string') return c[0];
        // fallback to any top-level field that might contain text
        if (typeof b?.text === 'string') return b.text;
        return '';
      };
      const text = extractText(body);
      console.log('[AI] Extracted text:', text.slice(0, 300));

      // Robust parsing strategy:
      // 1) Try direct JSON parse
      // 2) Extract first JSON array substring
      // 3) Convert bullet/numbered/plain sentence lists into an array
      let arr: string[] | null = null;

      // 1) direct JSON
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) arr = parsed.map((s: any) => String(s));
        else if (typeof parsed === 'object' && parsed !== null) {
          // if an object with a field that looks like suggestions, try to find an array
          const vals = Object.values(parsed).find(v => Array.isArray(v));
          if (Array.isArray(vals)) arr = (vals as any[]).map(s => String(s));
        }
      } catch (e) {
        // ignore
      }

      // 2) extract JSON array substring
      if (!arr) {
        const m = text.match(/\[[\s\S]*?\]/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            if (Array.isArray(parsed)) arr = parsed.map((s: any) => String(s));
          } catch (e) {
            // ignore
          }
        }
      }

      // 3) fallback: parse as lines/bullets
      if (!arr) {
        const lines = text
          .split(/\r?\n|\u2022|\u2023|\u25E6|\u2043/) // split on newlines and common bullet chars
          .map(l => l.replace(/^\s*[-*\d\.\)\s]+/, '').trim())
          .filter(Boolean);

        if (lines.length) {
          // If the model returned a single paragraph with multiple sentences separated by periods
          if (lines.length === 1) {
            const sentences = lines[0].split(/(?<=\.|\?|\!)\s+/).map(s => s.trim()).filter(Boolean);
            if (sentences.length > 1) arr = sentences;
          }
          // Otherwise treat each line as one recommendation
          if (!arr && lines.length > 0) arr = lines;
        }
      }

      if (!arr || !Array.isArray(arr) || arr.length === 0) {
        // Graceful fallback: no recommendations can be parsed from the response
        console.log('[AI] No valid recommendations found, returning empty array');
        return [];
      }

      // Normalize and limit
      const normalized = arr.map(s => s.replace(/^[-•\d\.\)\s]+/, '').trim()).filter(Boolean).slice(0, 4);
      console.log('[AI] Final parsed recommendations:', normalized);
      
      // Cache the recommendations
      setCachedRecommendations(user.login, normalized);
      return normalized;

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') lastErr = { code: 'TIMEOUT', message: 'timeout' };
      else lastErr = err;
      const retryable = lastErr && (lastErr.code === 'TIMEOUT' || (lastErr.status && lastErr.status >= 500));
      if (attempt < maxAttempts && retryable) { await sleep(400 * attempt); continue; }
      throw lastErr;
    }
  }
  throw { code: 'OPENROUTER_FAILED', message: 'requests failed' };
}

export async function getAIRecommendations(
  user: GitHubUser,
  repos: GitHubRepo[]
): Promise<string[]> {
  return getAIRecoomendations(user, repos);
}

// Lightweight recommendation plan when scores are low (no UI changes)
export function getRemediationPlan(
  breakdown: ScoreBreakdown,
  user: GitHubUser,
  repos: GitHubRepo[]
): string[] {
  const plan = generateRecommendations(breakdown, user, repos);
  return plan.map(p => p.text);
}
