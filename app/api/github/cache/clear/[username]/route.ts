import { NextResponse } from "next/server";
import { clearUserCache } from "@/lib/server/github-api";
import type { NextRequest } from "next/server";

export async function POST(_req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  try {
    const deletedCount = clearUserCache(username);
    return NextResponse.json({ message: `Cache cleared for ${username}`, deletedCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to clear cache" }, { status: 500 });
  }
}
