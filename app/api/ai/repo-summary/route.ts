import { NextResponse } from "next/server";
import { getGroqRepoSummary } from "@/lib/groq";

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

function isValidSummary(summary: string, repoName: string) {
  const normalized = summary.trim();
  if (normalized.length < 40) return false;
  if (!normalized.endsWith(".") && !normalized.endsWith("!") && !normalized.endsWith("?")) return false;
  if (repoName && !normalized.toLowerCase().includes(repoName.toLowerCase())) return false;
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
    if (!isValidSummary(cleaned, body.repoName)) {
      return NextResponse.json({ summary: deterministic, fallback: true, message: "AI summary fallback" });
    }
    return NextResponse.json({ summary: cleaned });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({
      summary: deterministic,
      fallback: true,
      message: "AI summary unavailable",
    });
  }
}
