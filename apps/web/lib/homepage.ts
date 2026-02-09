import { desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { outcomes, shares, shareTags, tags } from "./schema";
import type { SolutionType } from "./types";

export interface LeaderboardShare {
  title: string;
  slug: string;
  tags: string[];
  problem: string;
  solution_type: SolutionType;
  owner: string;
  repo: string;
  created?: string;
  views: number;
  verifications: number;
  successRate: number | null;
}

export interface LeaderboardData {
  shares: LeaderboardShare[];
  total: number;
}

async function getTagsForShareIds(
  shareIds: number[]
): Promise<Map<number, string[]>> {
  if (shareIds.length === 0) {
    return new Map();
  }

  const results = await db
    .select({ shareId: shareTags.shareId, tagName: tags.name })
    .from(shareTags)
    .innerJoin(tags, eq(tags.id, shareTags.tagId))
    .where(inArray(shareTags.shareId, shareIds));

  const map = new Map<number, string[]>();
  for (const r of results) {
    const existing = map.get(r.shareId) ?? [];
    existing.push(r.tagName);
    map.set(r.shareId, existing);
  }
  return map;
}

async function fetchSharesWithStats(
  orderBy: "views" | "trending" | "recent",
  limit: number
): Promise<LeaderboardData> {
  const [{ count: total }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(shares);

  const baseSelect = {
    id: shares.id,
    title: shares.title,
    slug: shares.slug,
    problem: shares.problem,
    solutionType: shares.solutionType,
    owner: shares.owner,
    repo: shares.repo,
    createdAt: shares.createdAt,
    viewCount: shares.viewCount,
    successCount: sql<number>`COALESCE(${outcomes.successCount}, 0)`,
    failureCount: sql<number>`COALESCE(${outcomes.failureCount}, 0)`,
    verificationCount: sql<number>`COALESCE(vc.cnt, 0)`,
  };

  let query = db
    .select(baseSelect)
    .from(shares)
    .leftJoin(outcomes, eq(outcomes.shareId, shares.id))
    .leftJoin(
      sql`(SELECT share_id, cast(count(*) as int) AS cnt FROM verifications GROUP BY share_id) vc`,
      sql`vc.share_id = ${shares.id}`
    )
    .$dynamic();

  if (orderBy === "trending") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    query = query.where(gt(shares.createdAt, sevenDaysAgo));
  }

  if (orderBy === "recent") {
    query = query.orderBy(desc(shares.createdAt)).limit(limit);
  } else {
    query = query.limit(limit * 3);
  }

  const results = await query;

  const shareIds = results.map((r) => r.id);
  const tagMap = await getTagsForShareIds(shareIds);

  const enriched: LeaderboardShare[] = results.map((r) => {
    const totalOutcomes = r.successCount + r.failureCount;

    return {
      title: r.title,
      slug: r.slug,
      tags: tagMap.get(r.id) ?? [],
      problem: r.problem,
      solution_type: r.solutionType,
      owner: r.owner,
      repo: r.repo,
      created: r.createdAt?.toISOString(),
      views: r.viewCount,
      verifications: r.verificationCount,
      successRate: totalOutcomes > 0 ? r.successCount / totalOutcomes : null,
    };
  });

  if (orderBy !== "recent") {
    enriched.sort((a, b) => b.views - a.views);
    return { shares: enriched.slice(0, limit), total };
  }

  return { shares: enriched, total };
}

export async function getHomepageData(limit = 20): Promise<{
  allTime: LeaderboardData;
  trending: LeaderboardData;
  recent: LeaderboardData;
}> {
  const [allTime, trending, recent] = await Promise.all([
    fetchSharesWithStats("views", limit),
    fetchSharesWithStats("trending", limit),
    fetchSharesWithStats("recent", limit),
  ]);

  return { allTime, trending, recent };
}
