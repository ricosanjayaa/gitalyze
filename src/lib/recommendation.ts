import { ScoreBreakdown } from './scoring';
import { GitHubUser, GitHubRepo } from './github';

export interface RecommendationItem {
  id: string;
  text: string;
  category: string;
  impact: number;
  effort: number;
  targetDeficiencies?: string[];
}

function getTopLanguage(repos: GitHubRepo[]): string | null {
  const langs: Record<string, number> = {};
  repos.forEach(r => {
    if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  });
  return Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function getTopRepo(repos: GitHubRepo[], excludeName?: string): GitHubRepo | null {
  const filtered = excludeName
    ? repos.filter(r => r.name.toLowerCase() !== excludeName.toLowerCase())
    : repos;
  return [...filtered].sort((a, b) => b.stargazers_count - a.stargazers_count)[0] || null;
}

function getRecentRepos(repos: GitHubRepo[], days = 90): GitHubRepo[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return repos.filter(r => new Date(r.pushed_at).getTime() > cutoff);
}

function generateCompletenessRecommendation(user: GitHubUser, repos: GitHubRepo[]): RecommendationItem | null {
  const missing: string[] = [];
  if (!user.bio) missing.push('bio');
  if (!user.location) missing.push('location');
  if (!user.blog) missing.push('blog');
  if (!user.email) missing.push('email');

  if (missing.length === 0) return null;

  const topLang = getTopLanguage(repos);

  if (missing.includes('bio') && topLang) {
    return {
      id: 'completeness',
      category: 'Completeness',
      impact: 0.8,
      effort: 0.1,
      text: `Add a concise bio highlighting your ${topLang} expertise, and improve profile completeness`,
      targetDeficiencies: ['completeness'],
    };
  }

  if (missing.includes('bio')) {
    return {
      id: 'completeness',
      category: 'Completeness',
      impact: 0.8,
      effort: 0.1,
      text: 'Add a concise bio to clarify your expertise and improve profile completeness',
      targetDeficiencies: ['completeness'],
    };
  }

  const missingText = missing.join(', ').replace(', ' + missing[missing.length - 1], ' and ');

  return {
    id: 'completeness',
    category: 'Completeness',
    impact: 0.8,
    effort: 0.1,
    text: `Add your ${missingText} to complete your profile and help others discover you`,
    targetDeficiencies: ['completeness'],
  };
}

function generateVolumeRecommendation(user: GitHubUser): RecommendationItem | null {
  const count = user.public_repos || 0;

  if (count <= 1) {
    return {
      id: 'volume',
      category: 'Volume',
      impact: 0.8,
      effort: 0.5,
      text: 'Quality over quantity, focus on creating repos you are proud to showcase',
      targetDeficiencies: ['volume'],
    };
  }

  return {
    id: 'volume',
    category: 'Volume',
    impact: 0.6,
    effort: 0.4,
    text: 'A few well-documented repos tell a better story than many empty ones',
    targetDeficiencies: ['volume'],
  };
}

function generateQualityRecommendation(user: GitHubUser, repos: GitHubRepo[]): RecommendationItem | null {
  const topRepo = getTopRepo(repos, user.login);
  const nonUsernameRepos = repos.filter(r => r.name.toLowerCase() !== user.login.toLowerCase());
  const hasDescription = repos.some(r => r.description);
  const hasTopics = repos.some(r => r.topics && r.topics.length > 0);

  if (nonUsernameRepos.length === 0) {
    return {
      id: 'quality',
      category: 'Quality',
      impact: 0.8,
      effort: 0.5,
      text: 'Create a new project repository with a detailed README to showcase your work',
      targetDeficiencies: ['quality'],
    };
  }

  if (topRepo && !topRepo.description) {
    return {
      id: 'quality',
      category: 'Quality',
      impact: 0.7,
      effort: 0.3,
      text: `Strengthen your ${topRepo.name} with a detailed README explaining features and usage`,
      targetDeficiencies: ['quality'],
    };
  }

  if (!hasDescription) {
    return {
      id: 'quality',
      category: 'Quality',
      impact: 0.7,
      effort: 0.3,
      text: 'Enhance repository descriptions to clearly communicate project purpose and value',
      targetDeficiencies: ['quality'],
    };
  }

  if (!hasTopics) {
    return {
      id: 'quality',
      category: 'Quality',
      impact: 0.6,
      effort: 0.2,
      text: 'Add relevant topics to your repos to improve discoverability',
      targetDeficiencies: ['quality'],
    };
  }

  return {
    id: 'quality',
    category: 'Quality',
    impact: 0.6,
    effort: 0.3,
    text: 'A strong README is your project first impression, make it count',
    targetDeficiencies: ['quality'],
  };
}

function generateActivityRecommendation(user: GitHubUser, repos: GitHubRepo[]): RecommendationItem | null {
  const recent = getRecentRepos(repos, 30);
  const recent90 = getRecentRepos(repos, 90);
  const topRepo = getTopRepo(repos, user.login);

  if (recent90.length === 0) {
    return {
      id: 'activity',
      category: 'Activity',
      impact: 0.85,
      effort: 0.6,
      text: 'Improve contribution consistency to demonstrate sustained development activity',
      targetDeficiencies: ['activity'],
    };
  }

  if (recent.length === 0 && recent90.length > 0) {
    if (topRepo) {
      return {
        id: 'activity',
        category: 'Activity',
        impact: 0.8,
        effort: 0.4,
        text: `Showcase recent work by updating your ${topRepo.name} project`,
        targetDeficiencies: ['activity'],
      };
    }
    return {
      id: 'activity',
      category: 'Activity',
      impact: 0.8,
      effort: 0.4,
      text: 'Showcase recent work by updating your pinned projects section',
      targetDeficiencies: ['activity'],
    };
  }

  return {
    id: 'activity',
    category: 'Activity',
    impact: 0.7,
    effort: 0.5,
    text: 'Regular updates show you are actively maintaining your projects',
    targetDeficiencies: ['activity'],
  };
}

function generateDiversityRecommendation(repos: GitHubRepo[]): RecommendationItem | null {
  const languages = new Set(repos.map(r => r.language).filter(Boolean));
  const topLang = getTopLanguage(repos);

  if (languages.size <= 1 && topLang) {
    return {
      id: 'diversity',
      category: 'Diversity',
      impact: 0.7,
      effort: 0.4,
      text: `Projects across different technologies alongside your ${topLang} expertise demonstrate versatility`,
      targetDeficiencies: ['diversity'],
    };
  }

  if (languages.size <= 1) {
    return {
      id: 'diversity',
      category: 'Diversity',
      impact: 0.7,
      effort: 0.4,
      text: 'Projects across different technologies demonstrate versatility',
      targetDeficiencies: ['diversity'],
    };
  }

  return {
    id: 'diversity',
    category: 'Diversity',
    impact: 0.6,
    effort: 0.3,
    text: 'Showcasing range in your tech stack opens more opportunities',
    targetDeficiencies: ['diversity'],
  };
}

function generateMaturityRecommendation(user: GitHubUser, repos: GitHubRepo[]): RecommendationItem | null {
  const hasLicense = repos.some(r => r.license);
  const topRepo = getTopRepo(repos, user.login);

  if (!hasLicense) {
    if (topRepo) {
      return {
        id: 'maturity',
        category: 'Maturity',
        impact: 0.6,
        effort: 0.2,
        text: `Adding an open-source license to your ${topRepo.name} makes it more professional`,
        targetDeficiencies: ['maturity'],
      };
    }
    return {
      id: 'maturity',
      category: 'Maturity',
      impact: 0.6,
      effort: 0.2,
      text: 'Adding an open-source license makes your projects more professional',
      targetDeficiencies: ['maturity'],
    };
  }

  return {
    id: 'maturity',
    category: 'Maturity',
    impact: 0.5,
    effort: 0.3,
    text: 'Increase visibility by contributing to well-known open-source projects',
    targetDeficiencies: ['maturity'],
  };
}

export function generateRecommendations(
  breakdown: ScoreBreakdown,
  user: GitHubUser,
  repos: GitHubRepo[]
): RecommendationItem[] {
  const maxima: Record<string, number> = {
    activity: 25,
    quality: 30,
    volume: 15,
    diversity: 10,
    completeness: 10,
    maturity: 10,
  };

  const deficits: string[] = Object.entries(maxima)
    .filter(([k, max]) => {
      const val = (breakdown as any)[k] ?? 0;
      return val < max * 0.7;
    })
    .map(([k]) => k);

  if (!deficits.length) {
    return [];
  }

  const generators: Record<string, () => RecommendationItem | null> = {
    completeness: () => generateCompletenessRecommendation(user, repos),
    volume: () => generateVolumeRecommendation(user),
    quality: () => generateQualityRecommendation(user, repos),
    activity: () => generateActivityRecommendation(user, repos),
    diversity: () => generateDiversityRecommendation(repos),
    maturity: () => generateMaturityRecommendation(user, repos),
  };

  const deficitWeights: Record<string, number> = {};
  deficits.forEach(d => {
    const max = maxima[d];
    const val = (breakdown as any)[d] ?? 0;
    deficitWeights[d] = Math.max(0, 1 - val / max);
  });

  const items: RecommendationItem[] = [];
  deficits.forEach(deficit => {
    const generator = generators[deficit];
    if (generator) {
      const item = generator();
      if (item) {
        item.impact = item.impact * (deficitWeights[deficit] || 1);
        items.push(item);
      }
    }
  });

  const topN = Math.max(2, Math.min(5, deficits.length));
  return items
    .sort((a, b) => b.impact - a.impact)
    .slice(0, topN);
}
