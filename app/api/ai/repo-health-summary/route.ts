import { NextResponse } from "next/server";
import { getGroqRepoHealthSummary } from "@/lib/groq";

type HealthSummaryRequest = {
  owner: string;
  repoName: string;
  scorePercent: number;
  label: string;
  reasons: string[];
};

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

  try {
    const summary = await getGroqRepoHealthSummary({
      owner: body.owner || "",
      repoName: body.repoName,
      scorePercent: body.scorePercent ?? 0,
      label: body.label || "",
      reasons: Array.isArray(body.reasons) ? body.reasons : [],
    });
    return NextResponse.json({ summary: summary || "" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ summary: "", message: "AI summary unavailable" });
  }
}
