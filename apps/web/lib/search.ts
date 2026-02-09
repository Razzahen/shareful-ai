import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { outcomes, shares, shareTags, tags, verifications } from "./schema";
import type { Share, ShareWithStats, SolutionType } from "./types";

function shareToModel(
  row: typeof shares.$inferSelect,
  tagNames: string[]
): Share {
  return {
    title: row.title,
    slug: row.slug,
    tags: tagNames,
    problem: row.problem,
    solution_type: row.solutionType,
    verified: row.verified > 0,
    created: row.createdAt?.toISOString(),
    updated: row.updatedAt?.toISOString(),
    ai_provider: row.aiProvider ?? undefined,
    environment: row.environment ?? undefined,
    related: row.related ?? undefined,
    owner: row.owner,
    repo: row.repo,
    content: row.content,
    url: row.url,
  };
}

async function getTagsForShares(
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

export async function enrichWithStats(share: Share): Promise<ShareWithStats> {
  const [shareRow] = await db
    .select({
      id: shares.id,
      viewCount: shares.viewCount,
      installCount: shares.installCount,
      firstSeenAt: shares.firstSeenAt,
      indexedBy: shares.indexedBy,
    })
    .from(shares)
    .where(
      and(
        eq(shares.owner, share.owner),
        eq(shares.repo, share.repo),
        eq(shares.slug, share.slug)
      )
    )
    .limit(1);

  let outcomeData = { success: 0, failure: 0 };
  let verificationCount = 0;
  let views = 0;
  let installCount = 0;
  let firstSeenAt = new Date().toISOString();
  let indexedBy = "shareful.ai";

  if (shareRow) {
    views = shareRow.viewCount;
    installCount = shareRow.installCount;
    firstSeenAt = shareRow.firstSeenAt.toISOString();
    indexedBy = shareRow.indexedBy;

    const [outcome] = await db
      .select({
        successCount: outcomes.successCount,
        failureCount: outcomes.failureCount,
      })
      .from(outcomes)
      .where(eq(outcomes.shareId, shareRow.id))
      .limit(1);

    if (outcome) {
      outcomeData = {
        success: outcome.successCount,
        failure: outcome.failureCount,
      };
    }

    const [vc] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(verifications)
      .where(eq(verifications.shareId, shareRow.id));

    verificationCount = vc?.count ?? 0;
  }

  const total = outcomeData.success + outcomeData.failure;

  return {
    ...share,
    views,
    outcome: outcomeData,
    verifications: verificationCount,
    successRate: total > 0 ? outcomeData.success / total : null,
    install_count: installCount,
    first_seen_at: firstSeenAt,
    indexed_by: indexedBy,
  };
}

export async function searchShares(
  query: string,
  options?: {
    type?: SolutionType;
    tags?: string[];
    limit?: number;
    cursor?: number;
  }
): Promise<{
  shares: ShareWithStats[];
  total: number;
  nextCursor: number | null;
}> {
  const limit = options?.limit ?? 10;

  const ftsQuery = sql`websearch_to_tsquery('english', ${query})`;

  const conditions = [
    sql`(
      ${shares.searchVector}::tsvector @@ ${ftsQuery}
      OR similarity(${shares.title}, ${query}) > 0.15
      OR similarity(${shares.problem}, ${query}) > 0.15
    )`,
  ];

  if (options?.type) {
    conditions.push(sql`${shares.solutionType} = ${options.type}`);
  }

  if (options?.tags && options.tags.length > 0) {
    const tagFilter = options.tags.map((t) => t.toLowerCase());
    conditions.push(
      inArray(
        shares.id,
        db
          .select({ shareId: shareTags.shareId })
          .from(shareTags)
          .innerJoin(tags, eq(tags.id, shareTags.tagId))
          .where(inArray(tags.name, tagFilter))
      )
    );
  }

  if (options?.cursor) {
    conditions.push(sql`${shares.id} < ${options.cursor}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const results = await db
    .select({
      share: shares,
      ftsRank: sql<number>`ts_rank_cd(${shares.searchVector}::tsvector, ${ftsQuery})`,
      titleSim: sql<number>`similarity(${shares.title}, ${query})`,
      successCount: sql<number>`COALESCE(${outcomes.successCount}, 0)`,
      failureCount: sql<number>`COALESCE(${outcomes.failureCount}, 0)`,
      verificationCount: sql<number>`COALESCE(vc.cnt, 0)`,
      viewCount: shares.viewCount,
      installCount: shares.installCount,
      firstSeenAt: shares.firstSeenAt,
      indexedBy: shares.indexedBy,
    })
    .from(shares)
    .leftJoin(outcomes, eq(outcomes.shareId, shares.id))
    .leftJoin(
      sql`(SELECT share_id, cast(count(*) as int) AS cnt FROM verifications GROUP BY share_id) vc`,
      sql`vc.share_id = ${shares.id}`
    )
    .where(whereClause)
    .orderBy(
      sql`(
        ts_rank_cd(${shares.searchVector}::tsvector, ${ftsQuery}) * 10.0
        + similarity(${shares.title}, ${query}) * 5.0
        + CASE WHEN (COALESCE(${outcomes.successCount}, 0) + COALESCE(${outcomes.failureCount}, 0)) > 0
            THEN COALESCE(${outcomes.successCount}, 0)::real
              / (COALESCE(${outcomes.successCount}, 0) + COALESCE(${outcomes.failureCount}, 0)) * 2.0
            ELSE 1.0
          END
        + log(COALESCE(${shares.installCount}, 0) + 1) * 3.0
      ) DESC`
    )
    .limit(limit);

  const shareIds = results.map((r) => r.share.id);
  const tagMap = await getTagsForShares(shareIds);

  const enriched: ShareWithStats[] = results.map((r) => {
    const total = r.successCount + r.failureCount;

    return {
      ...shareToModel(r.share, tagMap.get(r.share.id) ?? []),
      views: r.viewCount,
      outcome: { success: r.successCount, failure: r.failureCount },
      verifications: r.verificationCount,
      successRate: total > 0 ? r.successCount / total : null,
      install_count: r.installCount,
      first_seen_at: r.firstSeenAt.toISOString(),
      indexed_by: r.indexedBy,
    };
  });

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(shares)
    .where(whereClause);

  const lastId = results.length > 0 ? (results.at(-1)?.share.id ?? null) : null;
  const nextCursor = results.length === limit ? lastId : null;

  return { shares: enriched, total: countResult?.count ?? 0, nextCursor };
}

export async function incrementViews(
  owner: string,
  repo: string,
  slug: string
): Promise<void> {
  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(
      and(eq(shares.owner, owner), eq(shares.repo, repo), eq(shares.slug, slug))
    );
}
