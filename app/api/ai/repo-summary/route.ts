import { NextResponse } from "next/server";
import { getGroqRepoSummary } from "@/lib/groq";

type SummaryRequest = {
  owner: string;
  repoName: string;
  description?: string;
  readme?: string;
  topLanguages?: string[];
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
    });
    return NextResponse.json({ summary: summary || deterministic });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({
      summary: deterministic,
      fallback: true,
      message: "AI summary unavailable",
    });
  }
}
