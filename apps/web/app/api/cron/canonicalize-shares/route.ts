import { asc, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalizeShare } from "@/lib/dedupe/canonicalize-share";
import { shares } from "@/lib/schema";

const MAX_BATCH_SIZE = 20;
const DEFAULT_BATCH_SIZE = 5;

function parseLimit(value: string | null): number {
  if (!value) {
    return DEFAULT_BATCH_SIZE;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(Math.max(parsed, 1), MAX_BATCH_SIZE);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

  const candidates = await db
    .select({
      id: shares.id,
      owner: shares.owner,
      repo: shares.repo,
      slug: shares.slug,
      problem: shares.problem,
      content: shares.content,
      environment: shares.environment,
    })
    .from(shares)
    .where(
      or(isNull(shares.canonicalProblemId), isNull(shares.canonicalSolutionId))
    )
    .orderBy(asc(shares.indexedAt))
    .limit(limit);

  let processed = 0;
  const errors: Array<{ share: string; error: string }> = [];

  for (const share of candidates) {
    try {
      const res = await canonicalizeShare({
        shareId: share.id,
        owner: share.owner,
        repo: share.repo,
        slug: share.slug,
        frontmatterProblem: share.problem,
        content: share.content,
        environment: share.environment ?? null,
      });

      if (res && res.action === "updated") {
        processed++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({
        share: `${share.owner}/${share.repo}/${share.slug}`,
        error: message.slice(0, 200),
      });
    }
  }

  return NextResponse.json({
    processed,
    total: candidates.length,
    errors,
  });
}
