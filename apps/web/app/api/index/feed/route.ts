import { asc, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shares, shareTags, tags } from "@/lib/schema";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const parsed = Number.parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10
  );
  const limit = Math.min(
    Math.max(1, Number.isNaN(parsed) ? DEFAULT_LIMIT : parsed),
    MAX_LIMIT
  );

  const conditions = since ? [gt(shares.indexedAt, new Date(since))] : [];

  const rows = await db
    .select()
    .from(shares)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(asc(shares.indexedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;

  const shareIds = resultRows.map((r) => r.id);
  const tagMap = new Map<number, string[]>();

  if (shareIds.length > 0) {
    const tagResults = await db
      .select({ shareId: shareTags.shareId, tagName: tags.name })
      .from(shareTags)
      .innerJoin(tags, eq(tags.id, shareTags.tagId))
      .where(inArray(shareTags.shareId, shareIds));

    for (const r of tagResults) {
      const existing = tagMap.get(r.shareId) ?? [];
      existing.push(r.tagName);
      tagMap.set(r.shareId, existing);
    }
  }

  const entries = resultRows.map((row) => ({
    action: "upsert" as const,
    owner: row.owner,
    repo: row.repo,
    slug: row.slug,
    title: row.title,
    problem: row.problem,
    solution_type: row.solutionType,
    tags: tagMap.get(row.id) ?? [],
    indexed_at: row.indexedAt.toISOString(),
    indexed_by: row.indexedBy,
  }));

  const cursor =
    resultRows.length > 0
      ? (resultRows.at(-1)?.indexedAt.toISOString() ?? "")
      : (since ?? "");

  return NextResponse.json({ entries, cursor, has_more: hasMore });
}
