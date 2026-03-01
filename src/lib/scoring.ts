import { GitHubUser, GitHubRepo } from "./github";
import type { ProfileSnapshot } from "./profile-snapshot";
import { buildProfileSnapshot } from "./profile-snapshot";
import { differenceInDays } from "date-fns";

export interface ScoreBreakdown {
  activity: number;
  quality: number;
  depth: number;
  impact: number;
  consistency: number;
  completeness: number;
  total: number;
  grade: string;
  signals: Record<string, number | string | boolean | null>;
  subscores: Record<string, number>;
  reasons: Array<{ key: string; label: string; value: string; whyItMatters: string }>;
}

const MAXIMA = {
  activity: 20,
  quality: 25,
  depth: 15,
  impact: 15,
  consistency: 15,
  completeness: 10,
} as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function gradeFromTotal(total: number) {
  if (total >= 97) return "A+";
  if (total >= 93) return "A";
  if (total >= 90) return "A-";
  if (total >= 87) return "B+";
  if (total >= 83) return "B";
  if (total >= 80) return "B-";
  if (total >= 77) return "C+";
  if (total >= 73) return "C";
  if (total >= 70) return "C-";
  if (total >= 60) return "D";
  return "F";
}

export function calculateScoreV2(snapshot: ProfileSnapshot): ScoreBreakdown {
  const { user, repos, activity: activitySnap, extrasByRepo } = snapshot;
  const now = new Date();

  const nonForkNonArchived = repos.filter((r) => !r.fork && !r.archived);
  const totalStars = repos.reduce((acc, r) => acc + (r.stargazers_count ?? 0), 0);
  const totalForks = repos.reduce((acc, r) => acc + (r.forks_count ?? 0), 0);

  const languages = new Set(nonForkNonArchived.map((r) => r.language).filter(Boolean));

  const topRepos = [...nonForkNonArchived]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 8);

  const topRepoReadmeCount = topRepos.filter((r) => {
    const key = `${user.login}/${r.name}`.toLowerCase();
    return extrasByRepo[key]?.readmeExists;
  }).length;

  const topRepoHasReleaseCount = topRepos.filter((r) => {
    const key = `${user.login}/${r.name}`.toLowerCase();
    return extrasByRepo[key]?.hasRelease;
  }).length;

  const topRepoDescriptionCount = topRepos.filter((r) => Boolean(r.description && r.description.trim().length)).length;
  const topRepoTopicsCount = topRepos.filter((r) => Array.isArray(r.topics) && r.topics.length > 0).length;
  const topRepoLicenseCount = topRepos.filter((r) => Boolean(r.license)).length;

  // Activity (20): prefer public events (PR/issues/reviews) + repo push breadth.
  const eventVolumeSub = clamp01(Math.log1p(activitySnap.eventsLast30Days) / Math.log1p(60)); // ~2/day caps
  const eventRecencyDays = activitySnap.lastEventAt
    ? differenceInDays(now, new Date(activitySnap.lastEventAt))
    : 9999;
  const eventRecencySub = clamp01(1 - eventRecencyDays / 30);

  const repoBreadthSub = clamp01(activitySnap.pushedLast30Days / Math.max(3, Math.min(8, nonForkNonArchived.length)));
  const activitySub = clamp01(eventVolumeSub * 0.55 + eventRecencySub * 0.25 + repoBreadthSub * 0.2);
  const activityScore = Math.round(MAXIMA.activity * activitySub);

  // Quality (25): README/description/topics/license/releases on top repos
  const denom = Math.max(1, topRepos.length);
  const readmeSub = topRepoReadmeCount / denom;
  const descSub = topRepoDescriptionCount / denom;
  const topicsSub = topRepoTopicsCount / denom;
  const licenseSub = topRepoLicenseCount / denom;
  const releasesSub = topRepoHasReleaseCount / denom;
  const qualityComposite = clamp01(readmeSub * 0.35 + descSub * 0.2 + topicsSub * 0.15 + licenseSub * 0.15 + releasesSub * 0.15);
  const qualityScore = Math.round(MAXIMA.quality * qualityComposite);

  // Depth (15): number of non-trivial repos
  const realRepoCount = nonForkNonArchived.filter((r) => r.name.toLowerCase() !== user.login.toLowerCase()).length;
  const depthSub = clamp01(Math.log1p(realRepoCount) / Math.log1p(12));
  const depthScore = Math.round(MAXIMA.depth * depthSub);

  // Impact (15): log-scaled stars+forks
  const impactRaw = totalStars + totalForks;
  const impactSub = clamp01(Math.log1p(impactRaw) / Math.log1p(5000));
  const impactScore = Math.round(MAXIMA.impact * impactSub);

  // Consistency (15): repeated activity over time (weekly coverage) with breadth dampener.
  const activeRepos90 = nonForkNonArchived.filter((r) => {
    const pushedAt = r.pushed_at ? new Date(r.pushed_at) : null;
    if (!pushedAt) return false;
    return differenceInDays(now, pushedAt) <= 90;
  }).length;
  const weeklyConsistency = activitySnap.weeksActiveLast12 / 12;
  const breadth = clamp01(Math.sqrt(activeRepos90 / 5));
  const dayConsistency = clamp01(activitySnap.activeDaysLast30 / 20);
  const consistencySub = clamp01(weeklyConsistency * 0.6 + dayConsistency * 0.4) * breadth;
  const consistencyScore = Math.round(MAXIMA.consistency * consistencySub);

  // Completeness (10)
  let completenessRaw = 0;
  if (user.bio) completenessRaw += 2;
  if (user.location) completenessRaw += 2;
  if (user.blog) completenessRaw += 2;
  if (user.email) completenessRaw += 2;
  if (user.name) completenessRaw += 2;
  const completenessScore = completenessRaw;

  const total = activityScore + qualityScore + depthScore + impactScore + consistencyScore + completenessScore;
  const grade = gradeFromTotal(total);

  return {
    activity: activityScore,
    quality: qualityScore,
    depth: depthScore,
    impact: impactScore,
    consistency: consistencyScore,
    completeness: completenessScore,
    total,
    grade,
    signals: {
      pushedLast30Days: activitySnap.pushedLast30Days,
      pushedLast90Days: activitySnap.pushedLast90Days,
      lastPushAt: activitySnap.lastPushAt,
      weeksActiveLast12: activitySnap.weeksActiveLast12,
      eventsLast30Days: activitySnap.eventsLast30Days,
      eventsLast90Days: activitySnap.eventsLast90Days,
      lastEventAt: activitySnap.lastEventAt,
      activeDaysLast30: activitySnap.activeDaysLast30,
      activeRepos90,
      realRepoCount,
      languages: languages.size,
      totalStars,
      totalForks,
      topRepoReadmeCount,
      topRepoHasReleaseCount,
    },
    subscores: {
      activity: activitySub,
      quality: qualityComposite,
      depth: depthSub,
      impact: impactSub,
      consistency: consistencySub,
      completeness: completenessScore / MAXIMA.completeness,
    },
    reasons: [
      {
        key: "activity",
        label: "Recent activity",
        value: `${activitySnap.eventsLast30Days} public events (30d)`,
        whyItMatters: "Counts public activity like PRs/issues/reviews plus repo updates—closer to GitHub’s contributions signal.",
      },
      {
        key: "consistency",
        label: "Consistency",
        value: `${activitySnap.weeksActiveLast12}/12 active weeks; ${activeRepos90} repos active (90d)`,
        whyItMatters: "Consistent progress over weeks matters more than a single burst of commits.",
      },
      {
        key: "quality",
        label: "Project clarity",
        value: `${topRepoReadmeCount}/${denom} top repos have a README`,
        whyItMatters: "Clear documentation helps others understand your projects and shows good engineering habits.",
      },
      {
        key: "depth",
        label: "Portfolio depth",
        value: `${realRepoCount} non-profile repos`,
        whyItMatters: "Multiple real projects demonstrate practice and growth beyond a single repo.",
      },
    ],
  };
}

// Backwards-compatible export name used across the app.
export function calculateScore(user: GitHubUser, repos: GitHubRepo[]): ScoreBreakdown {
  // V2 without extras; treat README/releases as unknown.
  const snapshot = buildProfileSnapshot({ user, repos, repoExtras: [] });
  return calculateScoreV2(snapshot);
}
