import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchGitHubUser, fetchRepoReadme, fetchRepoReleases, fetchUserEvents, fetchUserRepos } from "@/lib/server/github-api";

export async function GET(_req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;

  try {
    const [user, repos, events] = await Promise.all([
      fetchGitHubUser(username),
      fetchUserRepos(username),
      fetchUserEvents(username).catch(() => []),
    ]);

    const topRepos = [...repos]
      .filter((r) => r && !r.fork && !r.archived)
      .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
      .slice(0, 8);

    const repoExtras = await Promise.all(
      topRepos.map(async (repo: any) => {
        const owner = repo.owner?.login ?? username;
        const name = repo.name;

        const [readme, releases] = await Promise.all([
          fetchRepoReadme(owner, name).catch(() => ""),
          fetchRepoReleases(owner, name).catch(() => []),
        ]);

        return {
          owner,
          name,
          readmeExists: Boolean(readme && readme.trim().length > 0),
          hasRelease: Array.isArray(releases) && releases.length > 0,
        };
      })
    );

    return NextResponse.json({ user, repos, repoExtras, events });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to build snapshot" }, { status: 500 });
  }
}
