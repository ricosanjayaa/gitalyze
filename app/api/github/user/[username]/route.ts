import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchGitHubUser } from "@/lib/server/github-api";

export async function GET(_req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  try {
    const data = await fetchGitHubUser(username);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to fetch user from GitHub" }, { status: 500 });
  }
}
