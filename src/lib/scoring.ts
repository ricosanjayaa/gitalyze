import { GitHubUser, GitHubRepo } from "./github";
import { differenceInDays, differenceInYears } from "date-fns";

export interface ScoreBreakdown {
  activity: number; 
  quality: number; 
  volume: number; 
  diversity: number;
  completeness: number;
  maturity: number; 
  total: number; 
  grade: string;
  // Detailed metrics for tooltips/insights
  consistency: number; // 0-1, consistency of updates
  repoHealth: number; // 0-1, avg quality of top repos
  impact: number; // raw number of stars/forks
}

export function calculateScore(user: GitHubUser, repos: GitHubRepo[]): ScoreBreakdown {
  const now = new Date();

  // --- Detailed Metrics Calculation ---
  const reposUpdatedLast30Days = repos.filter(r => differenceInDays(now, new Date(r.updated_at)) <= 30);
  const reposUpdatedLast90Days = repos.filter(r => differenceInDays(now, new Date(r.updated_at)) <= 90);
  const consistency = repos.length > 0 ? reposUpdatedLast90Days.length / repos.length : 0;

  const topRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 10);
  const avgStars = topRepos.reduce((acc, r) => acc + r.stargazers_count, 0) / (topRepos.length || 1);
  const avgForks = topRepos.reduce((acc, r) => acc + r.forks_count, 0) / (topRepos.length || 1);
  const repoHealth = (Math.log1p(avgStars) + Math.log1p(avgForks)) / 20; // Normalized health score

  const totalStars = repos.reduce((acc, r) => acc + r.stargazers_count, 0);
  const totalForks = repos.reduce((acc, r) => acc + r.forks_count, 0);
  const impact = totalStars + totalForks * 2; // Weight forks more

  // --- Main Score Categories (weights adjusted) ---
  // 1. Activity (25%)
  let activity = Math.min(25, reposUpdatedLast30Days.length * 2.5 + (consistency * 10));

  // 2. Quality (30%)
  let quality = Math.min(30, Math.log1p(impact) * 2 + (repoHealth * 15));

  // 3. Volume (15%)
  let volume = Math.min(15, Math.log1p(user.public_repos) * 5);

  // 4. Diversity (10%)
  const languages = new Set(repos.map(r => r.language).filter(Boolean));
  let diversity = Math.min(10, languages.size * 2);

  // 5. Profile Completeness (10%)
  let completeness = 0;
  if (user.bio) completeness += 2;
  if (user.location) completeness += 2;
  if (user.blog) completeness += 2;
  if (user.email) completeness += 2;
  if (user.name) completeness += 2;

  // 6. Account Maturity (10%)
  const yearsActive = differenceInYears(now, new Date(user.created_at));
  let maturity = Math.min(10, yearsActive * 1.5);

  const total = Math.round(activity + quality + volume + diversity + completeness + maturity);

  let grade = "F";
  if (total >= 97) grade = "A+";
  else if (total >= 93) grade = "A";
  else if (total >= 90) grade = "A-";
  else if (total >= 87) grade = "B+";
  else if (total >= 83) grade = "B";
  else if (total >= 80) grade = "B-";
  else if (total >= 77) grade = "C+";
  else if (total >= 73) grade = "C";
  else if (total >= 70) grade = "C-";
  else if (total >= 60) grade = "D";

  return {
    activity, quality, volume, diversity, completeness, maturity, total, grade,
    consistency, repoHealth, impact
  };
}
