import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  fetchGitHubUser, 
  fetchUserRepos, 
  type GitHubUser, 
  type GitHubRepo
} from '@/lib/github';
import { calculateScore, type ScoreBreakdown } from '@/lib/scoring';
import { getAIRecoomendations } from '@/lib/recommendation';
import { 
  format, 
  subMonths,
  eachQuarterOfInterval,
  isSameQuarter
} from 'date-fns';

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

      hasFetchedRecs.current = true;
      setLoadingRecs(true);
      setRecError(null);
      setIsRecRateLimited(false);

      try {
        const aiRecs = await getAIRecoomendations(scoreData, user, repos);
        if (!ignore) {
          setRecommendations(aiRecs);
        }
      } catch (err: any) {
        console.error("Failed to get AI recommendations", err);
        if (!ignore) {
          const msg = err.message || "Something went wrong while generating recommendations.";
          setRecError(msg);
          setIsRecRateLimited(msg.includes("limit"));
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
    [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5), 
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
    totalStars,
    totalForks,
    activeRepos,
    languageData,
    topRepos,
    growthData,
    refetch
  };
}
