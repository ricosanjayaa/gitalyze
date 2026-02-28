import type { Metadata } from "next";
import Dashboard from "@/views/Dashboard";
import { calculateScore } from "@/lib/scoring";
import type { GitHubRepo, GitHubUser } from "@/lib/github";
import type { ScoreBreakdown } from "@/lib/scoring";
import { fetchGitHubUser, fetchUserRepos } from "@/lib/server/github-api";
import { getGroqRecommendations, getRemediationPlan } from "@/lib/groq";
import metadataJson from "../../../metadata.json";

const MAXIMA: Record<string, number> = {
  activity: 25,
  quality: 30,
  volume: 15,
  diversity: 10,
  completeness: 10,
  maturity: 10,
};

function hasWeakCategory(scoreData: ScoreBreakdown) {
  return Object.entries(MAXIMA).some(([k, max]) => {
    const val = (scoreData as any)[k] ?? 0;
    return val <= max * 0.75;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  try {
    const user = (await fetchGitHubUser(username)) as GitHubUser;
    const displayName = user.name ?? user.login;
    const title = `${displayName} · ${metadataJson.name}`;
    const description = `${displayName}'s GitHub profile analytics and score breakdown.`;
    return {
      title,
      description,
      alternates: {
        canonical: `/dashboard/${user.login}`,
      },
      openGraph: {
        title,
        description,
        url: `/dashboard/${user.login}`,
        type: "profile",
      },
    };
  } catch {
    const title = `Dashboard · ${metadataJson.name}`;
    return {
      title,
      description: metadataJson.description,
      alternates: {
        canonical: `/dashboard/${username}`,
      },
    };
  }
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  try {
    const user = (await fetchGitHubUser(username)) as GitHubUser;
    const repos = (await fetchUserRepos(username)) as GitHubRepo[];
    const scoreData = calculateScore(user, repos);

    const forceFallback = process.env.FORCE_AI_RECS === "true";
    let recommendations: string[] = [];

    if (forceFallback) {
      recommendations = getRemediationPlan(scoreData, user, repos);
    } else if (hasWeakCategory(scoreData)) {
      try {
        const ai = await getGroqRecommendations(user, repos, scoreData);
        if (ai.length > 0) {
          recommendations = ai;
        } else {
          const fallback = getRemediationPlan(scoreData, user, repos);
          recommendations = fallback.length ? fallback : [];
        }
      } catch (err: any) {
        const fallback = getRemediationPlan(scoreData, user, repos);
        recommendations = fallback.length ? fallback : [];
      }
    }

    return (
      <Dashboard
        username={user.login}
        initial={{
          user,
          repos,
          scoreData,
          recommendations,
        }}
      />
    );
  } catch {
    // Fall back to client fetching so the page still works if GitHub is down.
    return <Dashboard username={username} />;
  }
}
