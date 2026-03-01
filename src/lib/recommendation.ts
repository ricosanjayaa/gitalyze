import type { ProfileSnapshot } from "./profile-snapshot";
import { ACTIONS, type RecommendationActionId } from "./recommendation-playbook";

export interface Deficiency {
  id:
    | "NO_REAL_PROJECTS"
    | "NO_README_TOP_REPOS"
    | "NO_LICENSE"
    | "INACTIVE"
    | "NO_RELEASES"
    | "LOW_DISCOVERABILITY"
    | "SINGLE_LANGUAGE"
    | "PROFILE_INCOMPLETE";
  severity: 1 | 2 | 3;
  evidence: Record<string, string | number | boolean | null>;
  title: string;
  summary: string;
  evidenceText: string[];
  recommendedActions: RecommendationActionId[];
}

export interface RecommendationItem {
  id: RecommendationActionId;
  text: string;
  impact: number;
  effort: number;
  why: string;
}

function repoKey(owner: string, name: string) {
  return `${owner.toLowerCase()}/${name.toLowerCase()}`;
}

export function diagnose(snapshot: ProfileSnapshot): Deficiency[] {
  const { user, repos, activity, extrasByRepo } = snapshot;

  const nonForkNonArchived = repos.filter((r) => !r.fork && !r.archived);
  const realRepos = nonForkNonArchived.filter((r) => r.name.toLowerCase() !== user.login.toLowerCase());

  const topRepos = [...nonForkNonArchived]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 8);

  const denom = Math.max(1, topRepos.length);
  const readmeMissing = topRepos.filter((r) => {
    const key = repoKey(user.login, r.name);
    const extra = extrasByRepo[key];
    return extra ? !extra.readmeExists : false;
  }).length;

  const noLicenseCount = topRepos.filter((r) => !r.license).length;
  const noReleaseCount = topRepos.filter((r) => {
    const key = repoKey(user.login, r.name);
    const extra = extrasByRepo[key];
    return extra ? !extra.hasRelease : false;
  }).length;

  const lowDiscoverability = topRepos.filter((r) => {
    const hasDesc = Boolean(r.description && r.description.trim().length > 0);
    const hasTopics = Array.isArray(r.topics) && r.topics.length > 0;
    return !hasDesc || !hasTopics;
  }).length;

  const languages = new Set(realRepos.map((r) => r.language).filter(Boolean));
  const deficiencies: Deficiency[] = [];

  if (realRepos.length < 2) {
    deficiencies.push({
      id: "NO_REAL_PROJECTS",
      severity: 3,
      evidence: { realRepoCount: realRepos.length },
      title: "Not enough real projects",
      summary: "You don’t have enough non-fork projects to showcase your learning.",
      evidenceText: [`Real (non-fork) repos: ${realRepos.length}`],
      recommendedActions: ["CREATE_REAL_PROJECT"],
    });
  }

  if (topRepos.length > 0 && readmeMissing / denom >= 0.5) {
    deficiencies.push({
      id: "NO_README_TOP_REPOS",
      severity: readmeMissing / denom >= 0.8 ? 3 : 2,
      evidence: { topRepos: denom, missingReadme: readmeMissing },
      title: "Missing READMEs on top repos",
      summary: "Most of your top repositories don’t explain what they do or how to run them.",
      evidenceText: [
        `Repos without a README: ${readmeMissing}/${denom}`,
        `Repos with a README: ${denom - readmeMissing}/${denom}`,
      ],
      recommendedActions: ["ADD_README"],
    });
  }

  if (topRepos.length > 0 && noLicenseCount / denom >= 0.6) {
    deficiencies.push({
      id: "NO_LICENSE",
      severity: 2,
      evidence: { topRepos: denom, missingLicense: noLicenseCount },
      title: "Missing licenses",
      summary: "A license signals professionalism and clarifies how others can use your work.",
      evidenceText: [
        `Repos without a license: ${noLicenseCount}/${denom}`,
        `Repos with a license: ${denom - noLicenseCount}/${denom}`,
      ],
      recommendedActions: ["ADD_LICENSE"],
    });
  }

  if (topRepos.length > 0 && noReleaseCount / denom >= 0.8) {
    deficiencies.push({
      id: "NO_RELEASES",
      severity: 1,
      evidence: { topRepos: denom, missingRelease: noReleaseCount },
      title: "No releases yet",
      summary: "Releases show you can ship versions and maintain a project over time.",
      evidenceText: [
        `Repos without a release: ${noReleaseCount}/${denom}`,
        `Repos with a release: ${denom - noReleaseCount}/${denom}`,
      ],
      recommendedActions: ["CUT_A_RELEASE"],
    });
  }

  if (topRepos.length > 0 && lowDiscoverability / denom >= 0.6) {
    deficiencies.push({
      id: "LOW_DISCOVERABILITY",
      severity: 2,
      evidence: { topRepos: denom, lowDiscoverability },
      title: "Low discoverability",
      summary: "Descriptions and topics help others quickly understand and find your repositories.",
      evidenceText: [`Low discoverability: ${lowDiscoverability}/${denom} top repos need description/topics`],
      recommendedActions: ["ADD_DESCRIPTION_TOPICS"],
    });
  }

  if (activity.pushedLast90Days === 0) {
    deficiencies.push({
      id: "INACTIVE",
      severity: 3,
      evidence: { pushedLast90Days: activity.pushedLast90Days, lastPushAt: activity.lastPushAt },
      title: "No recent activity",
      summary: "There hasn’t been any repository activity recently, which makes progress look stalled.",
      evidenceText: ["0 repos pushed in the last 90 days"],
      recommendedActions: ["MAKE_RECENT_COMMIT"],
    });
  } else if (activity.pushedLast30Days === 0) {
    deficiencies.push({
      id: "INACTIVE",
      severity: 2,
      evidence: { pushedLast30Days: activity.pushedLast30Days, lastPushAt: activity.lastPushAt },
      title: "No activity this month",
      summary: "Recent activity helps show momentum and consistent learning.",
      evidenceText: ["0 repos pushed in the last 30 days"],
      recommendedActions: ["MAKE_RECENT_COMMIT"],
    });
  }

  const completenessMissing = [!user.bio, !user.location, !user.blog, !user.name].filter(Boolean).length;
  if (!user.bio) {
    deficiencies.push({
      id: "PROFILE_INCOMPLETE",
      severity: 2,
      evidence: { missingBio: true, missingCount: completenessMissing },
      title: "Profile is incomplete",
      summary: "A short bio and basic details make your profile easier to understand.",
      evidenceText: ["Missing bio"],
      recommendedActions: ["ADD_BIO", "ADD_PROFILE_DETAILS"],
    });
  } else if (completenessMissing >= 2) {
    deficiencies.push({
      id: "PROFILE_INCOMPLETE",
      severity: 1,
      evidence: { missingCount: completenessMissing },
      title: "Profile could be more complete",
      summary: "Filling out basic fields improves credibility and discoverability.",
      evidenceText: [`Missing fields: ${completenessMissing}`],
      recommendedActions: ["ADD_PROFILE_DETAILS"],
    });
  }

  if (languages.size <= 1 && realRepos.length >= 2) {
    deficiencies.push({
      id: "SINGLE_LANGUAGE",
      severity: 1,
      evidence: { languageCount: languages.size },
      title: "Low tech variety",
      summary: "A small range of technologies can limit what you can demonstrate in a portfolio.",
      evidenceText: [`Languages used: ${languages.size}`],
      recommendedActions: ["CREATE_REAL_PROJECT"],
    });
  }

  return deficiencies;
}

export function generateRecommendationsV2(snapshot: ProfileSnapshot): {
  deficiencies: Deficiency[];
  actions: RecommendationItem[];
} {
  const deficiencies = diagnose(snapshot);
  if (!deficiencies.length) return { deficiencies: [], actions: [] };

  const actionScores = new Map<RecommendationActionId, number>();
  for (const deficiency of deficiencies) {
    for (const actionId of deficiency.recommendedActions) {
      const action = ACTIONS[actionId];
      const score = (deficiency.severity * action.impact) / Math.max(0.05, action.effort);
      actionScores.set(actionId, Math.max(actionScores.get(actionId) ?? 0, score));
    }
  }

  const ranked = [...actionScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => {
      const action = ACTIONS[id];
      return {
        id,
        text: `${action.title}: ${action.steps[0]}`,
        impact: action.impact,
        effort: action.effort,
        why: action.why,
      };
    });

  return { deficiencies, actions: ranked };
}
