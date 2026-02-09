import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { moderationActions, repos, shares } from "@/lib/schema";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip, "report", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const target = typeof body.target === "string" ? body.target : "";
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!target) {
      return NextResponse.json(
        { error: "Target is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    const parts = target.split("/");

    let targetType: string;
    let targetId: number | null = null;

    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      targetType = "share";
      const [owner, repo, slug] = parts;
      const [share] = await db
        .select({ id: shares.id })
        .from(shares)
        .where(
          and(
            eq(shares.owner, owner),
            eq(shares.repo, repo),
            eq(shares.slug, slug)
          )
        )
        .limit(1);
      targetId = share?.id ?? null;
    } else if (parts.length === 2 && parts[0] && parts[1]) {
      targetType = "repo";
      const [owner, repo] = parts;
      const [repoRow] = await db
        .select({ id: repos.id })
        .from(repos)
        .where(and(eq(repos.owner, owner), eq(repos.repo, repo)))
        .limit(1);
      targetId = repoRow?.id ?? null;
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid target format. Expected: owner/repo or owner/repo/slug",
        },
        { status: 400 }
      );
    }

    if (targetId === null) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    await db.insert(moderationActions).values({
      targetType,
      targetId,
      action: "reported",
      reason,
      moderator: "anonymous",
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 }
    );
  }
}
