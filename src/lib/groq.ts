import { Groq } from "groq-sdk";
import { ScoreBreakdown } from "./scoring";
import { GitHubUser, GitHubRepo } from "./github";
import { generateRecommendations } from "./recommendation";

export type { ScoreBreakdown, GitHubUser, GitHubRepo };

const SCORE_MAXIMA = {
  activity: 25,
  quality: 30,
  volume: 15,
  diversity: 10,
  completeness: 10,
  maturity: 10,
} as const;

const CACHE_TTL_MS = Number(process.env.RECOMMENDATION_CACHE_TTL_MS) || 15 * 60 * 1000;
const recommendationCache = new Map<string, { data: string[]; timestamp: number }>();
const retrievalPromises = new Map<string, Promise<string[]>>();
const cooldownMs = Number(process.env.GROQ_COOLDOWN_MS) || 60 * 1000;
const cooldowns = new Map<string, number>();

function getCachedRecommendations(username: string): string[] | null {
  const key = username.toLowerCase();
  const cached = recommendationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log("[CACHE] Returning cached recommendations for:", username);
    return cached.data;
  }
  return null;
}

function setCachedRecommendations(username: string, data: string[]): void {
  recommendationCache.set(username.toLowerCase(), { data, timestamp: Date.now() });
  console.log("[CACHE] Cached recommendations for:", username);
}

function getCooldown(username: string): number | null {
  const key = username.toLowerCase();
  const until = cooldowns.get(key) ?? null;
  if (until && Date.now() < until) return until;
  return null;
}

function setCooldown(username: string) {
  const key = username.toLowerCase();
  const until = Date.now() + cooldownMs;
  cooldowns.set(key, until);
  console.log(`[AI] Cooldown activated for ${username} until ${new Date(until).toISOString()}`);
  return until;
}

function getGroqConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    timeoutMS: Number(process.env.GROQ_TIMEOUT_MS) || 15000,
    maxRetries: Number(process.env.GROQ_MAX_RETRIES) || 2,
  };
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function buildPrompt(user: GitHubUser, repos: GitHubRepo[], breakdown?: ScoreBreakdown) {
  const accountAge = user.created_at
    ? Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : 0;
  const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))];
  const top = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  const recentlyUpdated = repos.filter((r) => {
    const daysSinceUpdate = (Date.now() - new Date(r.pushed_at).getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceUpdate <= 30;
  }).length;

  const system =
    "You are a senior engineer mentoring developers on GitHub portfolios. Give 2-4 unique recommendations as a JSON array of strings. Start each with an action verb. If the user has only a profile README (Top: profile-only), recommend creating REAL project repositories, NOT improving the README. If ANY category score is below 70% of its max, return 2-4 actionable items; otherwise return [].";
  const isProfileOnly = top?.name === user.login;
  const userMsg = `${user.login}: ${user.public_repos} repo, ${accountAge}yr, ${user.followers} followers, ${
    languages.slice(0, 3).join(",") || "-"
  }. Top: ${isProfileOnly ? "profile-only" : top?.name || "-"}. Missing: ${
    !user.bio ? "bio " : ""
  }${!user.location ? "loc " : ""}${!user.blog ? "blog" : ""}. Active: ${
    recentlyUpdated > 0 ? "yes" : "no"
  }.`;

  const scoreSummary = breakdown
    ? `Scores: ${Object.entries(SCORE_MAXIMA)
        .map(([k, max]) => `${k} ${((breakdown as any)[k] ?? 0)}/${max}`)
        .join(", ")}.`
    : "";

  return `${system}\n\n${scoreSummary ? scoreSummary + "\n\n" : ""}Profile: ${userMsg}\n\nResponse format: JSON array of recommendations (strings).`;
}

function extractText(body: any): string {
  if (!body) return "";
  const choice = body.choices?.[0];
  if (!choice) return "";
  if (typeof choice === "string") return choice;
  if (typeof choice?.text === "string") return choice.text;
  if (typeof choice?.content === "string") return choice.content;
  if (choice?.message?.content) return choice.message.content;
  if (choice?.message?.reasoning) return choice.message.reasoning;
  if (Array.isArray(choice) && choice.length > 0 && typeof choice[0] === "string") return choice[0];
  if (typeof body?.text === "string") return body.text;
  return "";
}

export async function getGroqRecommendations(
  user: GitHubUser,
  repos: GitHubRepo[],
  scoreData?: ScoreBreakdown
): Promise<string[]> {
  const cfg = getGroqConfig();
  if (!cfg.apiKey) throw { code: "MISSING_API_KEY", message: "GROQ_API_KEY not set." };

  const cacheKey = user.login.toLowerCase();
  const cachedRecs = getCachedRecommendations(cacheKey);
  if (cachedRecs) return cachedRecs;

  if (retrievalPromises.has(cacheKey)) {
    return retrievalPromises.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    const cooldownUntil = getCooldown(cacheKey);
    if (cooldownUntil) {
      const retryAfter = Math.ceil((cooldownUntil - Date.now()) / 1000) || 1;
      throw { code: "RATE_LIMIT", message: "AI rate limit cooldown active", status: 429, details: { retryAfter } };
    }

    const prompt = buildPrompt(user, repos, scoreData);
    const groq = new Groq({ apiKey: cfg.apiKey });
    const maxAttempts = cfg.maxRetries + 1;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: cfg.model,
          temperature: 1,
          max_completion_tokens: 1024,
          top_p: 1,
          stop: null,
        });
        const body = await response;
        console.log("[AI] Raw response:", JSON.stringify(body).slice(0, 500));
        const text = extractText(body);
        console.log("[AI] Extracted text:", text.slice(0, 300));

        let arr: string[] | null = null;
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) arr = parsed.map((s: any) => String(s));
          else if (typeof parsed === "object" && parsed !== null) {
            const vals = Object.values(parsed).find((v) => Array.isArray(v));
            if (Array.isArray(vals)) arr = (vals as any[]).map((s) => String(s));
          }
        } catch (e) {
          // ignore
        }

        if (!arr) {
          const m = text.match(/\[[\s\S]*?\]/);
          if (m) {
            try {
              const parsed = JSON.parse(m[0]);
              if (Array.isArray(parsed)) arr = parsed.map((s: any) => String(s));
            } catch {}
          }
        }

        if (!arr) {
          const lines = text
            .split(/\r?\n|\u2022|\u2023|\u25E6|\u2043/)
            .map((l) => l.replace(/^\s*[-*\d\.\)\s]+/, "").trim())
            .filter(Boolean);
          if (lines.length) {
            if (lines.length === 1) {
              const sentences = lines[0].split(/(?<=\.|\?|\!)\s+/).map((s) => s.trim()).filter(Boolean);
              if (sentences.length > 1) arr = sentences;
            }
            if (!arr && lines.length > 0) arr = lines;
          }
        }

        if (!arr || arr.length === 0) {
          console.log("[AI] No valid recommendations found, returning empty array");
          return [];
        }

        const normalized = arr
          .map((s) => s.replace(/^[-•\d\.\)\s]+/, "").trim())
          .filter(Boolean)
          .slice(0, 4);
        console.log("[AI] Final parsed recommendations:", normalized);
        setCachedRecommendations(user.login, normalized);
        return normalized;
      } catch (err: any) {
        if (err?.status === 429) {
          const retryAfter = err?.details?.retryAfter || 60;
          if (attempt < maxAttempts) {
            const backoffMs = 10000 * Math.pow(2, attempt - 1);
            console.log(
              `[AI] Rate limited, retrying in ${backoffMs / 1000}s (attempt ${attempt + 1}/${maxAttempts})`
            );
            await sleep(backoffMs);
            continue;
          }
          setCooldown(cacheKey);
          lastErr = { code: "RATE_LIMIT", message: err?.message || "Groq rate limit exceeded", status: 429, details: { retryAfter } };
          break;
        }

        if (err?.status >= 500 && attempt < maxAttempts) {
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000) + Math.random() * 1000;
          console.log(`[AI] Server error ${err.status}, retrying in ${Math.round(backoff)}ms`);
          await sleep(backoff);
          continue;
        }

        lastErr = err;
        break;
      }
    }
    if (lastErr) throw lastErr;
    throw { code: "GROQ_FAILED", message: "requests failed" };
  })();

  retrievalPromises.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    retrievalPromises.delete(cacheKey);
  }
}

export function getRemediationPlan(breakdown: ScoreBreakdown, user: GitHubUser, repos: GitHubRepo[]): string[] {
  const plan = generateRecommendations(breakdown, user, repos);
  return plan.map((p) => p.text);
}
