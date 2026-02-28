import { ScoreBreakdown } from "./scoring";
import { GitHubUser, GitHubRepo } from "./github";
import { generateRecommendations } from "./recommendation";

// small type re-exports for server usage
export type { ScoreBreakdown, GitHubUser, GitHubRepo };

function getOpenRouterConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    endpoint: process.env.OPENROUTER_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions',
    model: process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free',
    timeoutMS: Number(process.env.OPENROUTER_TIMEOUT_MS) || 12000,
    maxRetries: Number(process.env.OPENROUTER_MAX_RETRIES) || 2,
  };
}

function truncate(s: string | null | undefined, n = 140) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// Minimal, robust OpenRouter caller that keeps prompts small and dynamic.
export async function getAIRecoomendations(
  breakdown: ScoreBreakdown,
  user: GitHubUser,
  repos: GitHubRepo[]
): Promise<string[]> {
  const cfg = getOpenRouterConfig();
  if (!cfg.apiKey) throw { code: 'MISSING_API_KEY', message: 'OPENROUTER_API_KEY not set.' };

  // Prepare a compact summary
  const top = (repos || [])
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 3)
    .map(r => `${r.name} (${r.stargazers_count || 0}★): ${truncate(r.description, 80)}`)
    .join(' | ');

  // Determine weak areas (threshold: less than 70% of category max)
  const maxima: Record<string, number> = { activity: 25, quality: 30, volume: 15, diversity: 10, completeness: 10, maturity: 10 };
  const weakAreas = Object.entries(maxima)
    .filter(([k, max]) => (breakdown as any)[k] < Math.round(max * 0.7))
    .map(([k]) => k);

  if (!weakAreas.length) {
    // No weak areas — don't call the model unnecessarily
    return [];
  }

  // Dynamic, engaging recommendations based on actual user data
  const system = 'You are a senior engineer giving portfolio advice. Be practical, direct, and mentorship-oriented.';
  const userMsg = `Give 2-4 concise suggestions to improve this GitHub profile as a professional portfolio. User: ${user.name || user.login}, ${user.public_repos} repos, ${user.followers} followers. Top repo: ${top || 'none'}. Missing: ${!user.bio ? 'bio ' : ''}${!user.location ? 'location ' : ''}${!user.blog ? 'blog' : ''}. Rules: Start with action verbs like Add, Pin, Strengthen, Enhance, Showcase. No numbers. No em dashes. Under 20 words each. Focus on what helps their career.`;

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
          max_tokens: 180,
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        lastErr = { status: res.status, details: errData };

        // If rate-limited, do NOT auto-retry - surface the retry info to the caller
        if (res.status === 429) {
          const retryAfterHeader = res.headers?.get ? res.headers.get('retry-after') : null;
          const retryAfter = retryAfterHeader ? (parseInt(retryAfterHeader, 10) || 60) : 60; // default to 60s if missing
          throw { code: 'RATE_LIMIT', message: errData.message || 'OpenRouter rate limit exceeded', status: 429, details: { retryAfter } };
        }

        // For server errors, allow a single retry
        if (res.status >= 500 && attempt < maxAttempts) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000;
          await sleep(backoff);
          continue;
        }

        throw { code: 'OPENROUTER_API_ERROR', message: errData.message || `HTTP ${res.status}`, status: res.status, details: errData };
      }

      const body = await res.json();
      // Robustly extract text from various AI response shapes (different providers/models)
      const extractText = (b: any): string => {
        if (!b) return '';
        const c = b.choices?.[0];
        if (!c) return '';
        if (typeof c === 'string') return c;
        if (c?.message?.content) return c.message.content;
        if (typeof c?.text === 'string') return c.text;
        if (typeof c?.content === 'string') return c.content;
        if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'string') return c[0];
        // fallback to any top-level field that might contain text
        if (typeof b?.text === 'string') return b.text;
        return '';
      };
      const text = extractText(body);

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
        return [];
      }

      // Normalize and limit
      const normalized = arr.map(s => s.replace(/^[-•\d\.\)\s]+/, '').trim()).filter(Boolean).slice(0, 4);
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
  breakdown: ScoreBreakdown,
  user: GitHubUser,
  repos: GitHubRepo[]
): Promise<string[]> {
  return getAIRecoomendations(breakdown, user, repos);
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
