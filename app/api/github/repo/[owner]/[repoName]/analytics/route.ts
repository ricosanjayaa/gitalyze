import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchRepoCommits, fetchRepoDetail, fetchRepoLanguages } from "@/lib/server/github-api";

type AnalyticsResponse = {
  repo: {
    name: string;
    full_name: string;
    owner: { login: string; avatar_url: string };
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    license: { name: string } | null;
    topics: string[];
    archived?: boolean;
    created_at: string;
    pushed_at: string;
    default_branch: string;
    visibility: "public" | "private" | "internal";
    homepage: string | null;
  };
  contributorsTop: Array<{
    login: string;
    avatar_url: string;
    contributions: number;
    html_url: string;
  }>;
  contributorsCount: number;
  languages: Record<string, number>;
  commitSeries30d: Array<{ date: string; commits: number }>;
  contributorSeries30d: Record<string, Array<{ date: string; commits: number }>>;
  health: { scorePercent: number; label: "Elite" | "Good" | "Fair" | "Poor"; reasons: string[] };
  warnings: string[];
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildLastNDaysSeries(days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    dates.push(toDateKey(d));
  }
  return dates;
}

function labelFromScore(scorePercent: number): "Elite" | "Good" | "Fair" | "Poor" {
  if (scorePercent >= 85) return "Elite";
  if (scorePercent >= 70) return "Good";
  if (scorePercent >= 50) return "Fair";
  return "Poor";
}

function computeHealthScore(options: {
  pushedAt: string;
  openIssuesCount: number;
  hasLicense: boolean;
  hasTopics: boolean;
  hasDescription: boolean;
  isArchived: boolean;
  contributorsCount: number;
}) {
  const reasons: string[] = [];

  // Recency (40%)
  const pushedAt = new Date(options.pushedAt);
  const daysSincePush = Math.max(
    0,
    Math.floor((Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24))
  );
  const recencySub = clamp01(1 - daysSincePush / 90);
  const recencyPoints = recencySub * 40;
  if (daysSincePush <= 7) reasons.push("Recent push within 7 days");
  else if (daysSincePush <= 30) reasons.push("Active within the last 30 days");
  else reasons.push(`Last push ${daysSincePush} days ago`);

  // Issue load (20%) - log curve so large counts don’t instantly zero it.
  const issuePenalty = Math.log10(options.openIssuesCount + 1) / Math.log10(100 + 1);
  const issueSub = clamp01(1 - issuePenalty);
  const issuePoints = issueSub * 20;
  if (options.openIssuesCount === 0) reasons.push("No open issues");
  else if (options.openIssuesCount >= 25)
    reasons.push(`High open issues count (${options.openIssuesCount}) lowers score`);

  // Basics (25%)
  let basicsPoints = 0;
  if (options.hasLicense) {
    basicsPoints += 10;
    reasons.push("License detected");
  } else {
    reasons.push("No license detected");
  }
  if (options.hasTopics) basicsPoints += 5;
  if (options.hasDescription) basicsPoints += 5;
  if (!options.isArchived) basicsPoints += 5;
  if (options.isArchived) reasons.push("Repository is archived");

  // Community (15%) - log scale, capped.
  const communitySub = clamp01(Math.log10(options.contributorsCount + 1) / Math.log10(50 + 1));
  const communityPoints = communitySub * 15;
  if (options.contributorsCount >= 10) reasons.push("Healthy contributor count");

  const scorePercent = Math.round(recencyPoints + issuePoints + basicsPoints + communityPoints);
  return {
    scorePercent,
    label: labelFromScore(scorePercent),
    reasons,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ owner: string; repoName: string }> }
) {
  const { owner, repoName } = await context.params;
  const warnings: string[] = [];

  let repoDetail: any;
  try {
    repoDetail = await fetchRepoDetail(owner, repoName);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to fetch repo details from GitHub" },
      { status: 500 }
    );
  }

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 30);
  const sinceIso = sinceDate.toISOString();

  const dateKeys = buildLastNDaysSeries(30);
  const commitCountsByDate = new Map<string, number>();
  for (const key of dateKeys) commitCountsByDate.set(key, 0);

  const contributorCountsByDate = new Map<string, Map<string, number>>();
  const contributorsTop = Array.isArray(repoDetail.contributors)
    ? repoDetail.contributors
        .slice(0, 5)
        .map((c: any) => ({
          login: c.login,
          avatar_url: c.avatar_url,
          contributions: c.contributions,
          html_url: c.html_url,
        }))
    : [];
  const contributorsCount = Array.isArray(repoDetail.contributors) ? repoDetail.contributors.length : 0;

  let languages: Record<string, number> = {};
  try {
    languages = await fetchRepoLanguages(owner, repoName);
  } catch (error) {
    console.error(error);
    warnings.push("Languages data unavailable (rate-limited or restricted).");
  }

  try {
    const commits = await fetchRepoCommits({
      owner,
      repoName,
      sinceIso,
      pageLimit: 3,
      perPage: 100,
      maxCommits: 300,
    });

    for (const commit of commits) {
      const dateStr = commit?.commit?.author?.date;
      if (!dateStr) continue;
      const dateKey = dateStr.slice(0, 10);
      if (!commitCountsByDate.has(dateKey)) continue;
      commitCountsByDate.set(dateKey, (commitCountsByDate.get(dateKey) ?? 0) + 1);

      const authorLogin = commit?.author?.login;
      if (!authorLogin) continue;
      if (!contributorsTop.some(c => c.login === authorLogin)) continue;

      const byContributor = contributorCountsByDate.get(authorLogin) ?? new Map<string, number>();
      byContributor.set(dateKey, (byContributor.get(dateKey) ?? 0) + 1);
      contributorCountsByDate.set(authorLogin, byContributor);
    }
  } catch (error) {
    console.error(error);
    warnings.push("Commit velocity data unavailable (rate-limited or restricted).");
  }

  const commitSeries30d = dateKeys.map(date => ({
    date,
    commits: commitCountsByDate.get(date) ?? 0,
  }));

  const contributorSeries30d: AnalyticsResponse["contributorSeries30d"] = {};
  for (const c of contributorsTop) {
    const byDate = contributorCountsByDate.get(c.login) ?? new Map<string, number>();
    contributorSeries30d[c.login] = dateKeys.map(date => ({
      date,
      commits: byDate.get(date) ?? 0,
    }));
  }

  const health = computeHealthScore({
    pushedAt: repoDetail.pushed_at,
    openIssuesCount: repoDetail.open_issues_count ?? 0,
    hasLicense: Boolean(repoDetail.license?.name),
    hasTopics: Array.isArray(repoDetail.topics) && repoDetail.topics.length > 0,
    hasDescription: Boolean(repoDetail.description),
    isArchived: Boolean(repoDetail.archived),
    contributorsCount: Array.isArray(repoDetail.contributors) ? repoDetail.contributors.length : 0,
  });

  const response: AnalyticsResponse = {
    repo: {
      name: repoDetail.name,
      full_name: repoDetail.full_name,
      owner: repoDetail.owner,
      html_url: repoDetail.html_url,
      description: repoDetail.description ?? null,
      stargazers_count: repoDetail.stargazers_count ?? 0,
      forks_count: repoDetail.forks_count ?? 0,
      open_issues_count: repoDetail.open_issues_count ?? 0,
      license: repoDetail.license?.name ? { name: repoDetail.license.name } : null,
      topics: Array.isArray(repoDetail.topics) ? repoDetail.topics : [],
      archived: Boolean(repoDetail.archived),
      created_at: repoDetail.created_at,
      pushed_at: repoDetail.pushed_at,
      default_branch: repoDetail.default_branch ?? "main",
      visibility: repoDetail.visibility ?? (repoDetail.private ? "private" : "public"),
      homepage: repoDetail.homepage ?? null,
    },
    contributorsTop,
    contributorsCount,
    languages,
    commitSeries30d,
    contributorSeries30d,
    health,
    warnings,
  };

  const hasAnything =
    Boolean(response.repo?.full_name) ||
    response.contributorsTop.length > 0 ||
    Object.keys(response.languages).length > 0 ||
    response.commitSeries30d.some(p => p.commits > 0);

  if (!hasAnything) {
    return NextResponse.json({ message: "GitHub data temporarily unavailable" }, { status: 429 });
  }

  return NextResponse.json(response);
}
