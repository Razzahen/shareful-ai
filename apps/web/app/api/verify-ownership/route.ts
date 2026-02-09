import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logIndexEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { fetchFileContent } from "@/lib/github";
import { indexEvents, repos } from "@/lib/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const repoStr = typeof body.repo === "string" ? body.repo : "";
    const parts = repoStr.split("/");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return NextResponse.json(
        { error: "Invalid repo format. Expected: owner/repo" },
        { status: 400 }
      );
    }

    const [owner, repo] = parts;

    if (body.token) {
      return confirmOwnership(owner, repo, body.token);
    }

    const token = crypto.randomUUID();

    await logIndexEvent("verify_challenge", owner, repo, undefined, { token });

    return NextResponse.json({
      token,
      instructions: `Create a file named .shareful-verify containing this token in your repo root, then call POST /api/verify-ownership with { "repo": "${owner}/${repo}", "token": "${token}" }`,
    });
  } catch (error) {
    console.error("Verify ownership error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

async function confirmOwnership(
  owner: string,
  repo: string,
  token: string
): Promise<Response> {
  const [challenge] = await db
    .select({ metadata: indexEvents.metadata })
    .from(indexEvents)
    .where(
      and(
        eq(indexEvents.eventType, "verify_challenge"),
        eq(indexEvents.owner, owner),
        eq(indexEvents.repo, repo)
      )
    )
    .orderBy(sql`${indexEvents.createdAt} DESC`)
    .limit(1);

  if (!challenge?.metadata) {
    return NextResponse.json(
      { error: "No pending challenge found. Request a new token first." },
      { status: 400 }
    );
  }

  const stored = (challenge.metadata as { token?: string }).token;
  if (stored !== token) {
    return NextResponse.json(
      { error: "Token does not match" },
      { status: 400 }
    );
  }

  const fileContent = await fetchFileContent(owner, repo, ".shareful-verify");

  if (fileContent === null) {
    return NextResponse.json(
      { error: "Could not find .shareful-verify file in repo" },
      { status: 400 }
    );
  }

  if (fileContent.trim() !== token) {
    return NextResponse.json(
      { error: "Token in .shareful-verify does not match" },
      { status: 400 }
    );
  }

  await db
    .update(repos)
    .set({
      ownerVerified: 1,
      trustScore: sql`${repos.trustScore} + 50`,
    })
    .where(and(eq(repos.owner, owner), eq(repos.repo, repo)));

  await logIndexEvent("verify", owner, repo);

  return NextResponse.json({ verified: true });
}
