import { desc, eq, type SQL, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outcomes, shares, shareTags, tags, verifications } from "@/lib/schema";
import type { SolutionType } from "@/lib/types";

const VALID_SOLUTION_TYPES = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];
const VALID_SORTS = ["trending", "popular", "newest", "verified"];
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function getOrderByClause(sort: string): SQL {
  switch (sort) {
    case "trending":
      return desc(shares.installCount);
    case "newest":
      return desc(shares.firstSeenAt);
    case "verified":
      return sql`(
        SELECT cast(count(*) as int) FROM ${verifications}
        WHERE ${verifications.shareId} = ${shares.id}
      ) DESC`;
    default:
      return desc(shares.installCount);
  }
}

function parseParams(searchParams: URLSearchParams) {
  const rawTags = searchParams.get("tags");
  const filterTags = rawTags?.split(",").filter(Boolean);
  const rawType = searchParams.get("type");
  const type =
    rawType && VALID_SOLUTION_TYPES.includes(rawType)
      ? (rawType as SolutionType)
      : undefined;
  const sort = VALID_SORTS.includes(searchParams.get("sort") ?? "")
    ? (searchParams.get("sort") ?? "popular")
    : "popular";
  const parsedLimit = Number.parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10
  );
  const limit = Math.min(
    Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit,
    MAX_LIMIT
  );
  const rawCursor = searchParams.get("cursor");
  const cursor = rawCursor ? Number.parseInt(rawCursor, 10) : undefined;

  return { filterTags, type, sort, limit, cursor };
}

function buildConditions(
  type: SolutionType | undefined,
  filterTags: string[] | undefined,
  cursor: number | undefined
): SQL[] {
  const conditions: SQL[] = [];

  if (type) {
    conditions.push(eq(shares.solutionType, type));
  }

  if (filterTags && filterTags.length > 0) {
    const tagFilter = filterTags.map((t) => t.toLowerCase());
    conditions.push(
      sql`${shares.id} IN (
        SELECT ${shareTags.shareId} FROM ${shareTags}
        INNER JOIN ${tags} ON ${tags.id} = ${shareTags.tagId}
        WHERE ${tags.name} = ANY(${tagFilter})
      )`
    );
  }

  if (cursor) {
    conditions.push(sql`${shares.id} < ${cursor}`);
  }

  return conditions;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { filterTags, type, sort, limit, cursor } = parseParams(searchParams);

    const conditions = buildConditions(type, filterTags, cursor);
    const whereClause =
      conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`;

    const results = await db
      .select({
        share: shares,
        verificationCount: sql<number>`(
          SELECT cast(count(*) as int) FROM ${verifications}
          WHERE ${verifications.shareId} = ${shares.id}
        )`,
        successCount: sql<number>`COALESCE(${outcomes.successCount}, 0)`,
        failureCount: sql<number>`COALESCE(${outcomes.failureCount}, 0)`,
      })
      .from(shares)
      .leftJoin(outcomes, eq(outcomes.shareId, shares.id))
      .where(whereClause)
      .orderBy(getOrderByClause(sort))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const resultRows = hasMore ? results.slice(0, limit) : results;
    const shareIds = resultRows.map((r) => r.share.id);

    const tagMap = new Map<number, string[]>();
    if (shareIds.length > 0) {
      const tagResults = await db
        .select({ shareId: shareTags.shareId, tagName: tags.name })
        .from(shareTags)
        .innerJoin(tags, eq(tags.id, shareTags.tagId))
        .where(sql`${shareTags.shareId} = ANY(${shareIds})`);

      for (const r of tagResults) {
        const existing = tagMap.get(r.shareId) ?? [];
        existing.push(r.tagName);
        tagMap.set(r.shareId, existing);
      }
    }

    const sharesResult = resultRows.map((r) => {
      const total = r.successCount + r.failureCount;
      return {
        slug: r.share.slug,
        owner: r.share.owner,
        repo: r.share.repo,
        title: r.share.title,
        problem: r.share.problem,
        solution_type: r.share.solutionType,
        tags: tagMap.get(r.share.id) ?? [],
        verified: r.share.verified > 0,
        install_count: r.share.installCount,
        views: r.share.viewCount,
        verifications: r.verificationCount,
        success_rate: total > 0 ? r.successCount / total : null,
        first_seen_at: r.share.firstSeenAt.toISOString(),
        url: r.share.url,
      };
    });

    const lastId =
      resultRows.length > 0 ? (resultRows.at(-1)?.share.id ?? null) : null;
    const nextCursor = hasMore ? lastId : null;

    return NextResponse.json({
      shares: sharesResult,
      sort,
      nextCursor,
    });
  } catch (error) {
    console.error("Discover error:", error);
    return NextResponse.json(
      { error: "Failed to discover shares" },
      { status: 500 }
    );
  }
}
