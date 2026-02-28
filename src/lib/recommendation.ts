import { ScoreBreakdown } from './scoring';
import { GitHubUser, GitHubRepo } from './github';

export interface RecommendationItem {
  id: string;
  text: string;
  category: string;
  impact: number;
  effort: number;
  prerequisites?: string[];
  targetDeficiencies?: string[];
  rationale?: string;
}

const RECOMMENDATION_CATALOG: RecommendationItem[] = [
  {
    id: 'add_more_repos',
    text: 'Add more repositories to increase portfolio diversity',
    category: 'Diversity',
    impact: 0.9,
    effort: 0.4,
    targetDeficiencies: ['diversity'],
    rationale: 'Diversification of the repository portfolio reduces risk of single-point underperformance and broadens demonstrated capabilities; expanding coverage is likely to improve diversity and overall credibility.'
  },
  {
    id: 'update_profile',
    text: 'Complete profile details: bio, location, blog, email, and name',
    category: 'Completeness',
    impact: 0.8,
    effort: 0.1,
    targetDeficiencies: ['completeness'],
    rationale: 'Profile completeness signals professionalism and attention to detail, directly improving the Completeness score while enhancing discoverability.'
  },
  {
    id: 'add_readme',
    text: 'Add or improve README files with clear descriptions, usage instructions, and examples',
    category: 'Quality',
    impact: 0.7,
    effort: 0.3,
    targetDeficiencies: ['quality', 'completeness'],
    rationale: 'Well-documented repositories demonstrate engineering maturity and user empathy, positively impacting quality signals.'
  },
  {
    id: 'add_topics',
    text: 'Add relevant topics/tags to repositories to improve discoverability',
    category: 'Completeness',
    impact: 0.5,
    effort: 0.2,
    targetDeficiencies: ['completeness', 'diversity'],
    rationale: 'Topics enhance repository categorization and searchability, improving completeness and demonstrating domain breadth.'
  },
  {
    id: 'contribute_more',
    text: 'Increase commit frequency and maintain consistent activity patterns',
    category: 'Activity',
    impact: 0.85,
    effort: 0.7,
    targetDeficiencies: ['activity'],
    rationale: 'Consistent activity signals sustained engagement and reliability, directly strengthening activity metrics.'
  },
  {
    id: 'add_stars',
    text: 'Increase repository stars through quality projects and community engagement',
    category: 'Volume',
    impact: 0.8,
    effort: 0.6,
    targetDeficiencies: ['volume', 'quality'],
    rationale: 'Stars serve as social proof of project value, directly improving volume scores while indirectly validating quality.'
  },
  {
    id: 'fork_strategically',
    text: 'Fork relevant repositories to show interest in the ecosystem',
    category: 'Volume',
    impact: 0.4,
    effort: 0.3,
    targetDeficiencies: ['volume'],
    rationale: 'Strategic forking demonstrates ecosystem awareness and can indirectly signal Volume through portfolio expansion.'
  },
  {
    id: 'use_github_actions',
    text: 'Implement GitHub Actions CI/CD workflows for automated testing and deployment',
    category: 'Maturity',
    impact: 0.75,
    effort: 0.5,
    targetDeficiencies: ['maturity', 'quality'],
    rationale: 'CI/CD automation demonstrates DevOps maturity and operational excellence, positively impacting both maturity and quality scores.'
  },
  {
    id: 'add_license',
    text: 'Add appropriate open source licenses to repositories',
    category: 'Completeness',
    impact: 0.5,
    effort: 0.1,
    targetDeficiencies: ['completeness', 'maturity'],
    rationale: 'Licensing clarity is a legal and professional best practice, improving completeness and signaling project maturity.'
  },
  {
    id: 'release_versions',
    text: 'Create proper releases with version tags and release notes',
    category: 'Maturity',
    impact: 0.6,
    effort: 0.4,
    targetDeficiencies: ['maturity', 'quality'],
    rationale: 'Versioned releases demonstrate structured development and product thinking, directly improving maturity signals.'
  },
  {
    id: 'write_tests',
    text: 'Add comprehensive test coverage to repositories',
    category: 'Quality',
    impact: 0.7,
    effort: 0.6,
    targetDeficiencies: ['quality', 'maturity'],
    rationale: 'Test coverage demonstrates code reliability and engineering rigor, strongly influencing quality assessment.'
  },
  {
    id: 'improve_descriptions',
    text: 'Write detailed, keyword-rich repository descriptions',
    category: 'Completeness',
    impact: 0.5,
    effort: 0.2,
    targetDeficiencies: ['completeness', 'diversity'],
    rationale: 'Descriptive metadata improves searchability and signals project intentionality, boosting completeness.'
  },
  {
    id: 'code_review',
    text: 'Participate in code reviews on other repositories',
    category: 'Activity',
    impact: 0.5,
    effort: 0.4,
    targetDeficiencies: ['activity'],
    rationale: 'Code review activity demonstrates technical engagement and community contribution, strengthening activity.'
  },
  {
    id: 'health_check',
    text: 'Regularly update dependencies and address security vulnerabilities',
    category: 'Quality',
    impact: 0.55,
    effort: 0.5,
    targetDeficiencies: ['quality', 'consistency'],
    rationale: 'Regular health checks maintain codebase quality and consistency, reinforcing overall quality signals.'
  }
];

export function generateRecommendations(
  breakdown: ScoreBreakdown,
  user: GitHubUser,
  repos: GitHubRepo[]
): RecommendationItem[] {
  void user;
  void repos;
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

  const deficitWeights: Record<string, number> = {};
  deficits.forEach(d => {
    const max = maxima[d];
    const val = (breakdown as any)[d] ?? 0;
    deficitWeights[d] = Math.max(0, 1 - val / max);
  });

  const scored = RECOMMENDATION_CATALOG.map(item => {
    const target = item.targetDeficiencies || [];
    let score = 0;
    target.forEach(d => {
      const w = deficitWeights[d] ?? 0;
      score += w * item.impact;
    });
    score = item.impact > 0 ? score / (item.effort + 0.01) : 0;
    return { item, score };
  });

  const topN = Math.max(3, Math.min(5, deficits.length));
  const ordered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.item);

  return ordered;
}
