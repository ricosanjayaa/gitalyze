import type { GitHubRepo, GitHubUser } from "./github";

export interface RepoExtras {
  owner: string;
  name: string;
  readmeExists: boolean;
  hasRelease: boolean;
}

export interface UserActivitySnapshot {
  pushedLast30Days: number;
  pushedLast90Days: number;
  lastPushAt: string | null;
  weeksActiveLast12: number;
  eventsLast30Days: number;
  eventsLast90Days: number;
  lastEventAt: string | null;
  activeDaysLast30: number;
}

export interface ProfileSnapshot {
  user: GitHubUser;
  repos: GitHubRepo[];
  activity: UserActivitySnapshot;
  extrasByRepo: Record<string, RepoExtras>;
}

function repoKey(owner: string, name: string) {
  return `${owner.toLowerCase()}/${name.toLowerCase()}`;
}

export function buildProfileSnapshot(input: {
  user: GitHubUser;
  repos: GitHubRepo[];
  repoExtras?: RepoExtras[];
  events?: any[];
}): ProfileSnapshot {
  const { user, repos, repoExtras = [], events = [] } = input;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff30 = now - 30 * dayMs;
  const cutoff90 = now - 90 * dayMs;

  let pushedLast30Days = 0;
  let pushedLast90Days = 0;
  let lastPushAt: string | null = null;
  const activeWeekBuckets = new Set<number>();

  const weekMs = 7 * dayMs;
  const weekStart = now - 12 * weekMs;

  for (const repo of repos) {
    const pushedAt = repo.pushed_at ? new Date(repo.pushed_at).getTime() : NaN;
    if (!Number.isFinite(pushedAt)) continue;
    if (pushedAt >= cutoff30) pushedLast30Days += 1;
    if (pushedAt >= cutoff90) pushedLast90Days += 1;
    if (!lastPushAt || pushedAt > new Date(lastPushAt).getTime()) lastPushAt = repo.pushed_at;

    if (pushedAt >= weekStart) {
      const idx = Math.floor((pushedAt - weekStart) / weekMs);
      if (idx >= 0 && idx < 12) activeWeekBuckets.add(idx);
    }
  }

  // Events-based activity (preferred for Activity/Consistency because it includes PRs/issues/reviews).
  let eventsLast30Days = 0;
  let eventsLast90Days = 0;
  let lastEventAt: string | null = null;
  const activeEventWeekBuckets = new Set<number>();
  const activeDaysLast30Set = new Set<string>();

  for (const ev of Array.isArray(events) ? events : []) {
    const createdAt = ev?.created_at ? new Date(ev.created_at).getTime() : NaN;
    if (!Number.isFinite(createdAt)) continue;
    if (createdAt >= cutoff30) eventsLast30Days += 1;
    if (createdAt >= cutoff90) eventsLast90Days += 1;
    if (!lastEventAt || createdAt > new Date(lastEventAt).getTime()) lastEventAt = ev.created_at;

    if (createdAt >= weekStart) {
      const idx = Math.floor((createdAt - weekStart) / weekMs);
      if (idx >= 0 && idx < 12) activeEventWeekBuckets.add(idx);
    }

    if (createdAt >= cutoff30) {
      const d = new Date(createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
      activeDaysLast30Set.add(key);
    }
  }

  // Prefer events-based weekly coverage if available; fallback to repo pushes.
  const weeksActiveLast12 = activeEventWeekBuckets.size > 0 ? activeEventWeekBuckets.size : activeWeekBuckets.size;
  const activeDaysLast30 = activeDaysLast30Set.size;

  const extrasByRepo: Record<string, RepoExtras> = {};
  for (const extra of repoExtras) {
    extrasByRepo[repoKey(extra.owner, extra.name)] = extra;
  }

  return {
    user,
    repos,
    activity: {
      pushedLast30Days,
      pushedLast90Days,
      lastPushAt,
      weeksActiveLast12,
      eventsLast30Days,
      eventsLast90Days,
      lastEventAt,
      activeDaysLast30,
    },
    extrasByRepo,
  };
}

export function getRepoExtras(snapshot: ProfileSnapshot, owner: string, name: string) {
  return snapshot.extrasByRepo[repoKey(owner, name)] ?? null;
}
