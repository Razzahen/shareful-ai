import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ShareDetail } from "@/components/share-detail";
import { getShare } from "@/lib/indexer";
import { enrichWithStats, incrementViews } from "@/lib/search";

export const dynamic = "force-dynamic";

interface ShareParams {
  owner: string;
  repo: string;
  slug: string;
}

export async function generateMetadata(props: {
  params: Promise<ShareParams>;
}): Promise<Metadata> {
  const { owner, repo, slug } = await props.params;
  const share = await getShare(owner, repo, slug);

  if (!share) {
    return {};
  }

  const title = share.title;
  const description =
    share.problem.length > 160
      ? `${share.problem.slice(0, 157)}...`
      : share.problem;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      canonical: `https://shareful.ai/s/${owner}/${repo}/${slug}`,
    },
  };
}

export default async function SharePage(props: {
  params: Promise<ShareParams>;
}) {
  const { owner, repo, slug } = await props.params;
  const share = await getShare(owner, repo, slug);

  if (!share) {
    notFound();
  }

  after(() => incrementViews(owner, repo, slug));

  const shareWithStats = await enrichWithStats(share);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ShareDetail share={shareWithStats} />
    </div>
  );
}
