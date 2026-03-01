import { NextResponse } from "next/server";
import { getGroqRepoHealthSummary } from "@/lib/groq";

type HealthSummaryRequest = {
  owner: string;
  repoName: string;
  scorePercent: number;
  label: string;
  reasons: string[];
};

function buildDeterministicHealthSummary(input: HealthSummaryRequest) {
  const reasonSnippet = Array.isArray(input.reasons) && input.reasons.length > 0
    ? input.reasons.slice(0, 2).join("; ")
    : "No specific signals available.";
  return `Health score is ${input.scorePercent}% (${input.label}). ${reasonSnippet}`;
}

function isValidHealthSummary(summary: string, scorePercent: number, label: string) {
  const normalized = summary.trim();
  if (normalized.length < 30) return false;
  const includesScore = normalized.includes(`${scorePercent}%`);
  const includesLabel = label ? normalized.toLowerCase().includes(label.toLowerCase()) : false;
  return includesScore && includesLabel;
}

export async function POST(req: Request) {
  let body: HealthSummaryRequest | null = null;
  try {
    body = (await req.json()) as HealthSummaryRequest;
  } catch {
    body = null;
  }

  if (!body?.repoName) {
    return NextResponse.json({ message: "Missing repoName" }, { status: 400 });
  }

  const deterministic = buildDeterministicHealthSummary(body);

  try {
    const summary = await getGroqRepoHealthSummary({
      owner: body.owner || "",
      repoName: body.repoName,
      scorePercent: body.scorePercent ?? 0,
      label: body.label || "",
      reasons: Array.isArray(body.reasons) ? body.reasons : [],
    });
    const cleaned = summary || "";
    if (!isValidHealthSummary(cleaned, body.scorePercent ?? 0, body.label || "")) {
      return NextResponse.json({ summary: deterministic, message: "AI summary fallback" });
    }
    return NextResponse.json({ summary: cleaned });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ summary: deterministic, message: "AI summary unavailable" });
  }
}
