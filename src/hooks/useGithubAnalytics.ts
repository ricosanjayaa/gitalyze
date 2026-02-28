import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  fetchGitHubUser, 
  fetchUserRepos, 
  type GitHubUser, 
  type GitHubRepo
} from '@/lib/github';
import { calculateScore, type ScoreBreakdown } from '@/lib/scoring';
import { 
  format, 
  subMonths,
  eachQuarterOfInterval,
  isSameQuarter
} from 'date-fns';

const CLIENT_CACHE_TTL_MS = Number(import.meta.env.VITE_RECOMMENDATION_CACHE_TTL_MS) || 15 * 60 * 1000;

export function useGithubAnalytics(username: string | undefined) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreBreakdown | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);
  const [isRecRateLimited, setIsRecRateLimited] = useState(false);
  const [recRetryAfter, setRecRetryAfter] = useState<number | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [recRetryTrigger, setRecRetryTrigger] = useState(0);
  const hasFetchedRecs = useRef(false);

  // Effect to reset state when username changes
  useEffect(() => {
    setUser(null);
    setRepos([]);
    setScoreData(null);
    setRecommendations([]);
    setLoading(true);
    setLoadingRecs(true);
    setRecError(null);
    setIsRecRateLimited(false);
    setError(null);
    hasFetchedRecs.current = false;
  }, [username]);

  // Effect for fetching core GitHub data
  useEffect(() => {
    let ignore = false;

    async function loadCoreData() {
      if (!username) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [userData, reposData] = await Promise.all([
          fetchGitHubUser(username),
          fetchUserRepos(username),
        ]);

        if (ignore) return;

        setUser(userData);
        setRepos(reposData);
        setLastUpdated(new Date());

        const score = calculateScore(userData, reposData);
        setScoreData(score);
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setError("Failed to load GitHub data. Please check the username and try again.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
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

    async function loadRecs() {
      if (!scoreData || !user || !repos.length || (hasFetchedRecs.current && recRetryTrigger === 0)) {
        if(scoreData && !repos.length) setLoadingRecs(false)
        return;
      }

      // Check client-side cache only for DIFFERENT profiles (not page refresh)
      const cacheKey = `recs_${user.login}`;
      const lastViewedUsername = localStorage.getItem('last_viewed_username');
      const cachedData = localStorage.getItem(cacheKey);
      
      // Only use cache if this is a different profile (not a page refresh)
      const isNewProfile = lastViewedUsername !== user.login;
      
      if (cachedData && recRetryTrigger === 0 && isNewProfile) {
        try {
          const { recs, timestamp } = JSON.parse(cachedData);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < CLIENT_CACHE_TTL_MS) {
            console.log('[CLIENT CACHE] Using cached recommendations for new profile');
            setRecommendations(recs);
            setLoadingRecs(false);
            localStorage.setItem('last_viewed_username', user.login);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      // Update last viewed username
      localStorage.setItem('last_viewed_username', user.login);

      hasFetchedRecs.current = true;
      setLoadingRecs(true);
      setRecError(null);
      setIsRecRateLimited(false);

      try {
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

        const response = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scoreData, user: minimalUser, repos: minimalRepos }),
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
          const newRecs = data.recommendations || [];
          setRecommendations(newRecs);
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
    error,
    scoreData,
    recommendations,
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
