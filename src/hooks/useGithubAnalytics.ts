import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  fetchGitHubUser, 
  fetchUserRepos, 
  type GitHubUser, 
  type GitHubRepo
} from '@/lib/github';
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
        const [userData, reposData] = await Promise.all([
          fetchGitHubUser(username),
          fetchUserRepos(username),
        ]);

        if (ignore) return;
        if (requestId !== requestIdRef.current) return;

        setUser(userData);
        setRepos(reposData);
        setLastUpdated(new Date());

        const baseSnapshot = buildProfileSnapshot({ user: userData, repos: reposData, repoExtras: [] });
        setSnapshot(baseSnapshot);
        setScoreData(calculateScoreV2(baseSnapshot));

        // Fetch enhanced snapshot (README/releases) in the background for better accuracy.
        fetch(`/api/github/user/${encodeURIComponent(username)}/snapshot`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data || ignore) return;
            if (requestId !== requestIdRef.current) return;
            const enhanced = buildProfileSnapshot({
              user: data.user,
              repos: data.repos,
              repoExtras: data.repoExtras ?? [],
              events: data.events ?? [],
            });
            setSnapshot(enhanced);

            const nextScore = calculateScoreV2(enhanced);
            setScoreData((prev) => {
              if (!prev) return nextScore;
              const bigJump = Math.abs((nextScore.total ?? 0) - (prev.total ?? 0)) >= 2;
              if (!bigJump) return prev;
              return nextScore;
            });

            if (process.env.NODE_ENV !== "production") debugCounters.current.snapshotApplied += 1;
          })
          .catch(() => {});
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

      const cacheKey = `recs_${user.login}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      // Always compute deterministic deficiencies (for "Why?") even if we use cached recs.
      const activeSnapshot = snapshot ?? buildProfileSnapshot({ user, repos, repoExtras: [] });
      const deterministic = generateRecommendationsV2(activeSnapshot);
      setDeficiencies(deterministic.deficiencies);
      if (process.env.NODE_ENV !== "production") debugCounters.current.deterministicRecs += 1;

      if (cachedData && recRetryTrigger === 0) {
        try {
          const { recs, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < CLIENT_CACHE_TTL_MS) {
            console.log('[CLIENT CACHE] Using cached recommendations for new profile');
            setRecommendations(recs);
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

      try {
        recsFetchInFlightRef.current = true;
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

        // Use deterministic recommendations immediately (no spinner), then optionally refine with AI.
        const deterministicTexts = deterministic.actions.map((a) => a.text);
        setRecommendations(deterministicTexts);
        setLoadingRecs(false);

        if (deterministic.deficiencies.length === 0 || deterministic.actions.length === 0) {
          localStorage.setItem(cacheKey, JSON.stringify({ recs: deterministicTexts, timestamp: Date.now() }));
          return;
        }

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
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          // Surface rate limit info without throwing to allow UI to show manual retry
          if (!ignore) {
            const fallbackRecs = Array.isArray(errorData.recommendations) ? errorData.recommendations : [];
            setRecError(errorData.message || `HTTP ${response.status}`);
            setIsRecRateLimited(errorData.error === 'RATE_LIMIT');
            setRecRetryAfter(typeof errorData.retryAfter === 'number' ? errorData.retryAfter : null);
            if (fallbackRecs.length) {
              setRecommendations(fallbackRecs);
              localStorage.setItem(cacheKey, JSON.stringify({ recs: fallbackRecs, timestamp: Date.now() }));
            } else {
              setRecommendations([]);
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
          const newRecs = data.recommendations || [];
          setRecommendations(newRecs);
          if (process.env.NODE_ENV !== "production") debugCounters.current.aiRecs += 1;
          setRecRetryAfter(null);
          // Cache the recommendations
          localStorage.setItem(cacheKey, JSON.stringify({ recs: newRecs, timestamp: Date.now() }));
        }
      } catch (err: any) {
        console.error("Failed to get AI recommendations", err);
        if (!ignore) {
          const msg = err.message || "Something went wrong while generating recommendations.";
          setRecError(msg);
          // if thrown error included a code, detect rate limit
          setIsRecRateLimited((err && (err.code === 'RATE_LIMIT' || (err.status === 429))) || false);
          if (err && err.details && typeof err.details.retryAfter === 'number') setRecRetryAfter(err.details.retryAfter);
          setRecommendations([]);
        }
      } finally {
        if (!ignore) {
          setLoadingRecs(false);
          recsFetchInFlightRef.current = false;
        }
      }
    }

    loadRecs();

    return () => {
      ignore = true;
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
