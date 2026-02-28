import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchRepoDetail } from "@/lib/server/github-api";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ owner: string; repoName: string }> }
) {
  const { owner, repoName } = await context.params;
  try {
    const data = await fetchRepoDetail(owner, repoName);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to fetch repo details from GitHub" }, { status: 500 });
  }
}
