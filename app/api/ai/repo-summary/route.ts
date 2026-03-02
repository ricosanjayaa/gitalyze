import { NextResponse } from "next/server";
import { clearGroqRepoSummaryCache, getGroqRepoSummary } from "@/lib/groq";

type SummaryRequest = {
  owner: string;
  repoName: string;
  description?: string;
  readme?: string;
  topLanguages?: string[];
  stars?: number;
  forks?: number;
  openIssues?: number;
  lastPush?: string;
};

const DEFAULT_RETRY_AFTER_SECONDS = 10;

function buildDeterministicSummary(input: SummaryRequest) {
  const name = input.repoName || "Repository";
  const description = (input.description ?? "").trim();
  const readmeSnippet = extractReadmeSnippet(input.readme ?? "");
  const topLanguage = Array.isArray(input.topLanguages) ? input.topLanguages[0] : undefined;

  const sentences: string[] = [];
  if (description) {
    sentences.push(`${name} is ${description}${description.endsWith(".") ? "" : "."}`);
  } else {
    sentences.push(`${name} is a repository.`);
  }

  if (readmeSnippet) {
    sentences.push(`README highlights ${readmeSnippet}${readmeSnippet.endsWith(".") ? "" : "."}`);
  }

  if (topLanguage) {
    sentences.push(`Primary language: ${topLanguage}.`);
  }

  return sentences.join(" ");
}

function countSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function looksLikePromptLeak(summary: string) {
  const text = summary.toLowerCase();
  return [
    /then mention\s+metric/.test(text),
    /that's\s+\d+\s+sentences?/.test(text),
    /could add\s+(a\s+)?third sentence/.test(text),
    /that'?s description\.?/.test(text),
    /return plain text only/.test(text),
    /no markdown/.test(text),
  ].some(Boolean);
}

function isValidSummary(summary: string, owner: string, repoName: string) {
  const normalized = summary.trim();
  if (normalized.length < 40) return false;
  if (!normalized.endsWith(".") && !normalized.endsWith("!") && !normalized.endsWith("?")) return false;
  if (looksLikePromptLeak(normalized)) return false;

  const sentenceCount = countSentences(normalized);
  if (sentenceCount < 2 || sentenceCount > 3) return false;

  const hasMetric = /(stars?|forks?|open\s+issues?|last\s+(updated|push|pushed))/i.test(normalized);
  if (!hasMetric) return false;

  const lower = normalized.toLowerCase();
  const ownerLower = (owner || "").toLowerCase();
  const repoLower = (repoName || "").toLowerCase();
  const fullName = ownerLower && repoLower ? `${ownerLower}/${repoLower}` : "";
  const hasIdentity = (repoLower && lower.includes(repoLower)) || (fullName && lower.includes(fullName));
  if (!hasIdentity) return false;

  return true;
}

function extractReadmeSnippet(readmeText: string) {
  if (!readmeText) return "";
  const withoutCode = readmeText.replace(/```[\s\S]*?```/g, " ");
  const withoutHeadings = withoutCode
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join(" ");
  const withoutImages = withoutHeadings.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const withoutHtml = withoutLinks.replace(/<[^>]+>/g, " ");
  const cleaned = withoutHtml.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const maxLength = 220;
  const sentenceMatch = cleaned.match(/^(.*?[\.!?])\s/);
  const candidate = sentenceMatch ? sentenceMatch[1] : cleaned.slice(0, maxLength);
  return candidate.slice(0, maxLength).trim();
}

export async function POST(req: Request) {
  let body: SummaryRequest | null = null;
  try {
    body = (await req.json()) as SummaryRequest;
  } catch {
    body = null;
  }

  if (!body?.repoName) {
    return NextResponse.json({ message: "Missing repoName" }, { status: 400 });
  }

  const deterministic = buildDeterministicSummary(body);
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ summary: deterministic, fallback: true, message: "AI disabled" });
  }

  try {
    const summary = await getGroqRepoSummary({
      owner: body.owner || "",
      repoName: body.repoName,
      description: body.description ?? "",
      readme: body.readme ?? "",
      topLanguages: Array.isArray(body.topLanguages) ? body.topLanguages : [],
      stars: body.stars ?? 0,
      forks: body.forks ?? 0,
      openIssues: body.openIssues ?? 0,
      lastPush: body.lastPush ?? "",
    });
    const cleaned = summary || "";
    if (!isValidSummary(cleaned, body.owner || "", body.repoName)) {
      clearGroqRepoSummaryCache(body.owner || "", body.repoName);
      return NextResponse.json({
        summary: deterministic,
        fallback: true,
        message: "AI summary fallback",
        retryAfter: DEFAULT_RETRY_AFTER_SECONDS,
        retryable: false,
        fallbackReason: "validation_failed",
      });
    }
    return NextResponse.json({ summary: cleaned });
  } catch (error: any) {
    console.error(error);
    const retryAfter =
      typeof error?.details?.retryAfter === "number" && error.details.retryAfter > 0
        ? error.details.retryAfter
        : DEFAULT_RETRY_AFTER_SECONDS;
    const isRateLimit = error?.status === 429;
    const isRetryable = isRateLimit || (typeof error?.status === "number" ? error.status >= 500 : true);

    if (!isRetryable) {
      clearGroqRepoSummaryCache(body.owner || "", body.repoName);
    }

    return NextResponse.json({
      summary: deterministic,
      fallback: true,
      message: "AI summary unavailable",
      retryAfter,
      retryable: isRetryable,
      fallbackReason: isRateLimit ? "rate_limit" : isRetryable ? "upstream_error" : "validation_failed",
    });
  }
}
