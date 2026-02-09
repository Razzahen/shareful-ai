import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { shares } from "@/lib/schema";

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip, "install", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const shareStr = typeof body.share === "string" ? body.share : "";
    const parts = shareStr.split("/");

    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return NextResponse.json(
        { error: "Invalid share format. Expected: owner/repo/slug" },
        { status: 400 }
      );
    }

    const [owner, repo, slug] = parts;

    await db
      .update(shares)
      .set({ installCount: sql`${shares.installCount} + 1` })
      .where(
        and(
          eq(shares.owner, owner),
          eq(shares.repo, repo),
          eq(shares.slug, slug)
        )
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Install tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track install" },
      { status: 500 }
    );
  }
}
