import type { Metadata } from "next";
import Dashboard from "@/views/Dashboard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const title = username;
  const description = `${username}'s GitHub profile analytics and score breakdown.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/dashboard/${username}`,
    },
    openGraph: {
      title,
      description,
      url: `/dashboard/${username}`,
      type: "profile",
    },
  };
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <Dashboard username={username} />;
}
