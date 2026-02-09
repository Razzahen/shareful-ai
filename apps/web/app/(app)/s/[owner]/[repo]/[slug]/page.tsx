import { notFound } from "next/navigation";
import { after } from "next/server";
import { ShareDetail } from "@/components/share-detail";
import { getShare } from "@/lib/indexer";
import { enrichWithStats, incrementViews } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SharePage(props: {
  params: Promise<{ owner: string; repo: string; slug: string }>;
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
