import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { indexRepo } from "@/lib/indexer";
import { isRegistered, registerRepo } from "@/lib/registry";
import { indexUpstreams } from "@/lib/schema";

const TRUST_DEGRADE_AMOUNT = 5;
const MIN_TRUST_SCORE = 0;

interface FeedEntry {
  action: string;
  owner: string;
  repo: string;
  slug: string;
  title: string;
  problem: string;
  solution_type: string;
  tags: string[];
  indexed_at: string;
  indexed_by: string;
}

interface FeedResponse {
  entries: FeedEntry[];
  cursor: string;
  has_more: boolean;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upstreams = await db
    .select()
    .from(indexUpstreams)
    .where(eq(indexUpstreams.status, "active"));

  let totalSynced = 0;

  for (const upstream of upstreams) {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (upstream.cursor) {
        params.set("since", upstream.cursor);
      }

      const res = await fetch(
        `${upstream.url}/api/index/feed?${params.toString()}`
      );

      if (!res.ok) {
        await degradeTrust(upstream.id, upstream.trustScore);
        continue;
      }

      const feed: FeedResponse = await res.json();

      for (const entry of feed.entries) {
        try {
          if (!(await isRegistered(entry.owner, entry.repo))) {
            await registerRepo(entry.owner, entry.repo);
          }
          await indexRepo(entry.owner, entry.repo);
          totalSynced++;
        } catch {
          // Skip individual entries that fail
        }
      }

      await db
        .update(indexUpstreams)
        .set({
          cursor: feed.cursor || upstream.cursor,
          lastSyncedAt: new Date(),
        })
        .where(eq(indexUpstreams.id, upstream.id));
    } catch {
      await degradeTrust(upstream.id, upstream.trustScore);
    }
  }

  return NextResponse.json({
    upstreams: upstreams.length,
    synced: totalSynced,
  });
}

async function degradeTrust(
  upstreamId: number,
  currentScore: number
): Promise<void> {
  const newScore = Math.max(
    MIN_TRUST_SCORE,
    currentScore - TRUST_DEGRADE_AMOUNT
  );
  await db
    .update(indexUpstreams)
    .set({ trustScore: newScore })
    .where(eq(indexUpstreams.id, upstreamId));
}
