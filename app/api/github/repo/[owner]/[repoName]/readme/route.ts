import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchRepoReadme } from "@/lib/server/github-api";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ owner: string; repoName: string }> }
) {
  const { owner, repoName } = await context.params;
  try {
    const readme = await fetchRepoReadme(owner, repoName);
    return NextResponse.json({ readme: readme ?? "" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to fetch README from GitHub" }, { status: 500 });
  }
}
