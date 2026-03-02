import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type GitHubUser, type GitHubRepo } from "@/lib/github";
import { calculateScoreV2, type ScoreBreakdown } from '@/lib/scoring';
import { buildProfileSnapshot, type ProfileSnapshot } from "@/lib/profile-snapshot";
import { generateRecommendationsV2, type Deficiency } from "@/lib/recommendation";
import { 
  format, 
  subMonths,
  eachQuarterOfInterval,
  isSameQuarter
} from 'date-fns';

const CLIENT_CACHE_TTL_MS = Number(process.env.NEXT_PUBLIC_RECOMMENDATION_CACHE_TTL_MS) || 15 * 60 * 1000;

interface InitialAnalyticsData {
  user?: GitHubUser | null;
  repos?: GitHubRepo[];
  scoreData?: ScoreBreakdown | null;
  recommendations?: string[];
}

function normalizeRecommendations(raw: string[] | string): string[] {
<<<<<<< HEAD
  const normalizeList = (list: string[]) =>
    list
      .map((s) => String(s).trim())
      .map((s) => s.replace(/^[-•\d\.\)\s]+/, "").replace(/^"|"$/g, "").trim())
=======
  const looksLikeSerializedList = (value: string) => /^\s*\[/.test(value) || /"\s*,\s*"/.test(value);

  const normalizeList = (list: string[]) =>
    list
      .map((s) => String(s).trim())
      .map((s) =>
        s
          .replace(/^[-•\d\.\)\s]+/, "")
          .replace(/^"|"$/g, "")
          .replace(/^\[+\s*/, "")
          .replace(/\s*\]+$/, "")
          .trim()
      )
>>>>>>> develop
      .filter(Boolean)
      .flatMap((s) => {
        if (s.length <= 200) return [s];
        return s.split(/(?<=[.!?])\s+/).slice(0, 2).filter(Boolean);
      })
      .map((s) => (s.length > 200 ? s.slice(0, 200).replace(/\s+\S*$/, "").trim() : s))
      .slice(0, 6);

<<<<<<< HEAD
  if (Array.isArray(raw)) return normalizeList(raw);
=======
  if (Array.isArray(raw)) {
    if (raw.length === 1) {
      const nested = String(raw[0]).trim();
      if (looksLikeSerializedList(nested)) {
        const reparsed = normalizeRecommendations(nested);
        if (reparsed.length > 0) return reparsed;
      }
    }
    return normalizeList(raw);
  }
>>>>>>> develop

  const text = String(raw).trim();
  if (!text) return [];

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return normalizeList(parsed as string[]);
    } catch {
      // fall through
    }
  }

<<<<<<< HEAD
  if (text.includes('","')) {
=======
  if (/"\s*,\s*"/.test(text)) {
>>>>>>> develop
    const items = text
      .replace(/^\[|\]$/g, "")
      .split(/"\s*,\s*"/)
      .map((s) => s.replace(/^"|"$/g, ""));
    return normalizeList(items);
  }

<<<<<<< HEAD
=======
  if (looksLikeSerializedList(text)) {
    const quotedItems = [...text.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
      .map((match) => match[1])
      .filter(Boolean);
    if (quotedItems.length > 0) return normalizeList(quotedItems);
    return [];
  }

>>>>>>> develop
  return normalizeList([text]);
}

export function useGithubAnalytics(username: string | undefined, initial?: InitialAnalyticsData) {
  const [user, setUser] = useState<GitHubUser | null>(initial?.user ?? null);
  const [repos, setRepos] = useState<GitHubRepo[]>(initial?.repos ?? []);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreBreakdown | null>(initial?.scoreData ?? null);
  const [recommendations, setRecommendations] = useState<string[]>(initial?.recommendations ?? []);
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);
  const [isRecRateLimited, setIsRecRateLimited] = useState(false);
  const [recRetryAfter, setRecRetryAfter] = useState<number | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [recRetryTrigger, setRecRetryTrigger] = useState(0);
  const hasFetchedRecs = useRef(false);
  const hasAppliedInitial = useRef(false);
  const requestIdRef = useRef(0);
  const coreFetchInFlightRef = useRef(false);
  const recsFetchInFlightRef = useRef(false);
  const recsRequestKeyRef = useRef<string | null>(null);
  const aiRequestKeyRef = useRef<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const debugCounters = useRef({ core: 0, snapshotApplied: 0, deterministicRecs: 0, aiRecs: 0 });

  // Effect to reset state when username changes
  useEffect(() => {
    requestIdRef.current += 1;
    setUser(null);
    setRepos([]);
    setScoreData(null);
    setRecommendations([]);
    setSnapshot(null);
    setDeficiencies([]);
    setLoading(true);
    setIsRefreshing(false);
    setLoadingRecs(true);
    setRecError(null);
    setIsRecRateLimited(false);
    setError(null);
    hasFetchedRecs.current = false;
    hasAppliedInitial.current = false;
    coreFetchInFlightRef.current = false;
    recsFetchInFlightRef.current = false;
    recsRequestKeyRef.current = null;
    aiRequestKeyRef.current = null;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
  }, [username]);

  useEffect(() => {
    if (!username || hasAppliedInitial.current) return;
    const hasInitialCore = Boolean(initial?.user && initial?.repos && initial?.scoreData);
    if (!hasInitialCore) return;

    setUser(initial?.user ?? null);
    setRepos(initial?.repos ?? []);
    setScoreData(initial?.scoreData ?? null);
    setRecommendations(initial?.recommendations ?? []);
    setLoading(false);
    setLoadingRecs(false);
    setLastUpdated(new Date());
    hasFetchedRecs.current = true;
    hasAppliedInitial.current = true;
  }, [username, initial?.user, initial?.repos, initial?.scoreData, initial?.recommendations]);

  // Effect for fetching core GitHub data
  useEffect(() => {
    let ignore = false;
    const requestId = requestIdRef.current;

    async function loadCoreData() {
      if (coreFetchInFlightRef.current) return;
      if (!username) {
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (hasAppliedInitial.current && refetchTrigger === 0) {
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      coreFetchInFlightRef.current = true;
      if (process.env.NODE_ENV !== "production") debugCounters.current.core += 1;

      const hasExistingData = Boolean(user) && repos.length > 0 && Boolean(scoreData);
      if (hasExistingData) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        // Option B: compute score once using the enhanced snapshot (events + repoExtras).
        const snapshotData = await fetch(`/api/github/user/${encodeURIComponent(username)}/snapshot`)
          .then((r) => (r.ok ? r.json() : null));

        if (ignore) return;
        if (requestId !== requestIdRef.current) return;
        if (!snapshotData?.user || !snapshotData?.repos) {
          throw new Error("Snapshot missing required fields");
        }

        setUser(snapshotData.user);
        setRepos(snapshotData.repos);
        setLastUpdated(new Date());

        const enhanced = buildProfileSnapshot({
          user: snapshotData.user,
          repos: snapshotData.repos,
          repoExtras: snapshotData.repoExtras ?? [],
          events: snapshotData.events ?? [],
        });
        setSnapshot(enhanced);
        setScoreData(calculateScoreV2(enhanced));

        if (process.env.NODE_ENV !== "production") debugCounters.current.snapshotApplied += 1;
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setError("Failed to load GitHub data. Please check the username and try again.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsRefreshing(false);
          coreFetchInFlightRef.current = false;
        }
      }
    }

    loadCoreData();

    return () => {
      ignore = true;
    };
  }, [username, refetchTrigger]);

  // Effect for fetching AI recommendations
  useEffect(() => {
    let ignore = false;
    const requestId = requestIdRef.current;

    async function loadRecs() {
      if (recsFetchInFlightRef.current) return;
      if (!scoreData || !user || !repos.length || (hasFetchedRecs.current && recRetryTrigger === 0)) {
        if(scoreData && !repos.length) setLoadingRecs(false)
        return;
      }

      let deterministicTexts: string[] = [];

      const requestKey = `${user.login}:${scoreData.total ?? 0}:${repos.length}:${recRetryTrigger}`;
      if (recsRequestKeyRef.current === requestKey && recRetryTrigger === 0) {
        return;
      }
      recsRequestKeyRef.current = requestKey;

      try {
        // Mark in-flight as early as possible to avoid double runs when effects re-fire quickly.
        recsFetchInFlightRef.current = true;

        const cacheKey = `recs_v2_${user.login}`;
        const legacyCacheKey = `recs_${user.login}`;
        const cachedData = localStorage.getItem(cacheKey);
        const legacyCachedData = localStorage.getItem(legacyCacheKey);

        // Always compute deterministic deficiencies (for "Why?") even if we use cached recs.
        const activeSnapshot = snapshot ?? buildProfileSnapshot({ user, repos, repoExtras: [] });
        const deterministic = generateRecommendationsV2(activeSnapshot);
        setDeficiencies(deterministic.deficiencies);
        if (process.env.NODE_ENV !== "production") debugCounters.current.deterministicRecs += 1;

        if ((cachedData || legacyCachedData) && recRetryTrigger === 0) {
          try {
            const source = cachedData ?? legacyCachedData;
            const { recs, timestamp } = JSON.parse(source as string);
            const cacheAge = Date.now() - timestamp;
            if (cacheAge < CLIENT_CACHE_TTL_MS) {
              const normalizedCached = normalizeRecommendations(recs ?? []);
              console.log('[CLIENT CACHE] Using cached recommendations for new profile');
              setRecommendations(normalizedCached);
              localStorage.setItem(cacheKey, JSON.stringify({ recs: normalizedCached, timestamp: Date.now() }));
              if (legacyCachedData) localStorage.removeItem(legacyCacheKey);
              setLoadingRecs(false);
              return;
            }
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }

        hasFetchedRecs.current = true;
        setRecError(null);
        setIsRecRateLimited(false);

        // Send a minimal payload to avoid oversized requests: pick top 5 repos and only required user fields
        const minimalUser = {
          name: user.name,
          login: user.login,
          bio: user.bio,
          followers: user.followers,
          public_repos: user.public_repos,
          blog: user.blog,
          location: user.location,
        };

        const minimalRepos = [...repos]
          .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
          .slice(0, 5)
          .map(r => ({
            name: r.name,
            stargazers_count: r.stargazers_count,
            description: r.description,
            language: r.language,
            archived: r.archived,
            created_at: r.created_at,
          }));

        // Prepare deterministic fallback, but keep loading while AI runs.
        deterministicTexts = deterministic.actions.map((a) => a.text);

        if (deterministic.deficiencies.length === 0 || deterministic.actions.length === 0) {
          setRecommendations(deterministicTexts);
          setLoadingRecs(false);
          localStorage.setItem(cacheKey, JSON.stringify({ recs: deterministicTexts, timestamp: Date.now() }));
          return;
        }

        setLoadingRecs(true);

        const aiKey = `${user.login}:${scoreData.total ?? 0}:${repos.length}:${deterministic.deficiencies.length}:${deterministic.actions.length}:${recRetryTrigger}`;
        if (aiRequestKeyRef.current === aiKey && recRetryTrigger === 0) {
          return;
        }
        aiRequestKeyRef.current = aiKey;

        aiAbortRef.current?.abort();
        aiAbortRef.current = new AbortController();

        const response = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scoreData,
            user: minimalUser,
            repos: minimalRepos,
            deficiencies: deterministic.deficiencies,
            actions: deterministic.actions,
          }),
          signal: aiAbortRef.current.signal,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          // Surface rate limit info without throwing to allow UI to show manual retry
          if (!ignore) {
            const fallbackRecs = Array.isArray(errorData.recommendations) ? normalizeRecommendations(errorData.recommendations) : [];
            setRecError(errorData.message || `HTTP ${response.status}`);
            setIsRecRateLimited(errorData.error === 'RATE_LIMIT');
            setRecRetryAfter(typeof errorData.retryAfter === 'number' ? errorData.retryAfter : null);
            if (fallbackRecs.length) {
              setRecommendations(fallbackRecs);
              localStorage.setItem(cacheKey, JSON.stringify({ recs: fallbackRecs, timestamp: Date.now() }));
            } else {
              setRecommendations(deterministicTexts);
            }
          }
          return;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          const bodyText = await response.text().catch(() => '');
          throw new Error(`Unexpected response content-type (${contentType || 'unknown'}). ${bodyText}`);
        }

        const data = await response.json();
        if (!ignore) {
          if (requestId !== requestIdRef.current) return;
          let newRecs = normalizeRecommendations(data.recommendations || []);
          if (newRecs.length === 1 && newRecs[0].startsWith("[") && newRecs[0].endsWith("]")) {
            newRecs = normalizeRecommendations(newRecs[0]);
          }
          setRecommendations(newRecs.length ? newRecs : deterministicTexts);
          if (process.env.NODE_ENV !== "production") debugCounters.current.aiRecs += 1;
          setRecRetryAfter(null);
          // Cache the recommendations
          localStorage.setItem(cacheKey, JSON.stringify({ recs: newRecs.length ? newRecs : deterministicTexts, timestamp: Date.now() }));
        }
      } catch (err: any) {
        console.error("Failed to get AI recommendations", err);
        if (!ignore) {
          const msg = err.message || "Something went wrong while generating recommendations.";
          setRecError(msg);
          // if thrown error included a code, detect rate limit
          setIsRecRateLimited((err && (err.code === 'RATE_LIMIT' || (err.status === 429))) || false);
          if (err && err.details && typeof err.details.retryAfter === 'number') setRecRetryAfter(err.details.retryAfter);
          setRecommendations(deterministicTexts);
        }
      } finally {
        if (!ignore) {
          setLoadingRecs(false);
        }
        recsFetchInFlightRef.current = false;
        aiAbortRef.current = null;
      }
    }

    loadRecs();

    return () => {
      ignore = true;
      aiAbortRef.current?.abort();
    };
  }, [scoreData, user, repos, recRetryTrigger]);

  const retryRecommendations = useCallback(() => {
    setRecRetryTrigger(prev => prev + 1);
  }, []);

  const refetch = async () => {
    if (!username) return;
    requestIdRef.current += 1;
    await fetch(`/api/github/cache/clear/${username}`, { method: 'POST' });
    setRefetchTrigger(c => c + 1);
  };

  const totalStars = useMemo(() => repos.reduce((acc, repo) => acc + repo.stargazers_count, 0), [repos]);
  const totalForks = useMemo(() => repos.reduce((acc, repo) => acc + repo.forks_count, 0), [repos]);
  const activeRepos = useMemo(() => repos.filter(r => !r.archived).length, [repos]);
  
  const languageData = useMemo(() => {
    const counts: Record<string, number> = {};
    repos.forEach(repo => {
      if (repo.language) {
        counts[repo.language] = (counts[repo.language] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [repos]);

  const topRepos = useMemo(() => 
    [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8), 
  [repos]);

  const growthData = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, 24);
    const quarters = eachQuarterOfInterval({ start, end });
    
    return quarters.map(q => {
      const newRepos = repos.filter(r => {
        if (!r.created_at) return false;
        const d = new Date(r.created_at);
        return isSameQuarter(d, q);
      });
      
      return {
        name: format(q, "QQQ yyyy"),
        shortName: format(q, "QQQ ''yy"),
        date: q,
        count: newRepos.length,
        repoNames: newRepos.map(r => r.name)
      };
    });
  }, [repos]);

  return {
    user,
    loading,
    isRefreshing,
    error,
    scoreData,
    recommendations,
    deficiencies,
    lastUpdated,
    loadingRecs,
    recError,
    isRecRateLimited,
    retryRecommendations,
    recRetryAfter,
    totalStars,
    totalForks,
    activeRepos,
    languageData,
    topRepos,
    growthData,
    refetch
  };
}
