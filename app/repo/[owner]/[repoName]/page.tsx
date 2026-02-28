import type { Metadata } from "next";
import RepoDetail from "@/views/RepoDetail";
import { fetchRepoDetail } from "@/lib/server/github-api";
import metadataJson from "../../../../metadata.json";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repoName: string }>;
}): Promise<Metadata> {
  const { owner, repoName } = await params;
  const canonical = `/repo/${owner}/${repoName}`;

  try {
    const repo = await fetchRepoDetail(owner, repoName);
    const title = `${repo.name} by ${repo.owner?.login ?? owner}`;
    const description = repo.description ?? `Detailed analytics for ${repo.full_name}.`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        type: "website",
      },
    };
  } catch {
    return {
      title: "Repository",
      description: metadataJson.description,
      alternates: { canonical },
    };
  }
}

export default async function Page({ params }: { params: Promise<{ owner: string; repoName: string }> }) {
  const { owner, repoName } = await params;

  try {
    const repo = await fetchRepoDetail(owner, repoName);
    return <RepoDetail owner={owner} repoName={repoName} initialRepoData={repo} />;
  } catch {
    // Fall back to client fetching to preserve behavior.
    return <RepoDetail owner={owner} repoName={repoName} />;
  }
}
