import { writeFile, mkdir } from "node:fs/promises";

import { buildProfileSnapshot } from "../src/lib/profile-snapshot";
import { calculateScoreV2 } from "../src/lib/scoring";
import { generateRecommendationsV2 } from "../src/lib/recommendation";

type FetchJson = <T = any>(path: string) => Promise<T>;

function getBaseUrl() {
  return process.env.EVAL_BASE_URL || "http://localhost:3000";
}

const fetchJson: FetchJson = async (path) => {
  const base = getBaseUrl().replace(/\/$/, "");
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fetch failed ${res.status} ${path}. ${body.slice(0, 200)}`);
  }
  return res.json();
};

function assert(condition: any, message: string) {
  if (!condition) {
    const err = new Error(message);
    (err as any).code = "ASSERT";
    throw err;
  }
}

function warn(warnings: string[], message: string) {
  warnings.push(message);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2).filter(Boolean);
  return args;
}

function extractCount(text: string, label: string) {
  // Matches: "Repos without a license: 5/8"
  const re = new RegExp(`${label}:\\s*(\\d+)\\/(\\d+)`);
  const m = text.match(re);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]) };
}

async function evalUsername(username: string) {
  const warnings: string[] = [];

  const [user, repos, snapshot] = await Promise.all([
    fetchJson(`/api/github/user/${encodeURIComponent(username)}`),
    fetchJson(`/api/github/user/${encodeURIComponent(username)}/repos`),
    fetchJson(`/api/github/user/${encodeURIComponent(username)}/snapshot`),
  ]);

  const repoExtras = snapshot?.repoExtras ?? [];
  const events = snapshot?.events ?? [];

  const profileSnapshot = buildProfileSnapshot({ user, repos, repoExtras, events });
  const score = calculateScoreV2(profileSnapshot);
  const recs = generateRecommendationsV2(profileSnapshot);

  // Fairness rubric checks: wording should be unambiguous.
  for (const d of recs.deficiencies) {
    for (const t of d.evidenceText ?? []) {
      if (/\bMissing license\b/i.test(t)) {
        assert(false, `Ambiguous wording found in deficiency evidenceText: "${t}"`);
      }
      if (/\bMissing README\b/i.test(t)) {
        assert(false, `Ambiguous wording found in deficiency evidenceText: "${t}"`);
      }
    }
  }

  // Consistency checks: if both "with" and "without" are present, they must sum correctly.
  for (const d of recs.deficiencies) {
    const withoutLicense = (d.evidenceText || []).find((t) => t.startsWith("Repos without a license:"));
    const withLicense = (d.evidenceText || []).find((t) => t.startsWith("Repos with a license:"));
    if (withoutLicense && withLicense) {
      const a = extractCount(withoutLicense, "Repos without a license");
      const b = extractCount(withLicense, "Repos with a license");
      if (!a || !b) {
        warn(warnings, `Could not parse license counts for ${d.id}`);
      } else {
        assert(a.b === b.b, `License denom mismatch: "${withoutLicense}" vs "${withLicense}"`);
        assert(a.a + b.a === a.b, `License counts don't add up: "${withoutLicense}" + "${withLicense}"`);
      }
    }
  }

  return {
    username,
    score: {
      activity: score.activity,
      consistency: score.consistency,
      quality: score.quality,
      depth: score.depth,
      impact: score.impact,
      completeness: score.completeness,
      total: score.total,
      grade: score.grade,
    },
    signals: {
      eventsLast30Days: score.signals.eventsLast30Days,
      activeDaysLast30: score.signals.activeDaysLast30,
      weeksActiveLast12: score.signals.weeksActiveLast12,
      activeRepos90: score.signals.activeRepos90,
      pushedLast30Days: score.signals.pushedLast30Days,
    },
    deficiencies: recs.deficiencies.slice(0, 3).map((d) => ({
      id: d.id,
      severity: d.severity,
      title: d.title,
      summary: d.summary,
      evidenceText: d.evidenceText,
    })),
    actions: recs.actions.map((a) => ({ id: a.id, text: a.text })),
    warnings,
  };
}

async function main() {
  const usernames = parseArgs(process.argv);
  if (usernames.length === 0) {
    console.error("Usage: bun scripts/eval-profiles.ts <username...>");
    process.exit(2);
  }

  const report = {
    baseUrl: getBaseUrl(),
    generatedAt: new Date().toISOString(),
    results: [] as any[],
  };

  for (const u of usernames) {
    report.results.push(await evalUsername(u));
  }

  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/fairness-report.json", JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

