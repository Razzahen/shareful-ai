import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchDefaultBranchSha } from "@/lib/github";
import { enqueueIndexJob } from "@/lib/registry";
import { repos } from "@/lib/schema";

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoRows = await db
    .select()
    .from(repos)
    .orderBy(asc(repos.lastIndexedAt))
    .limit(BATCH_SIZE);

  let enqueued = 0;

  for (const row of repoRows) {
    const sha = await fetchDefaultBranchSha(row.owner, row.repo);
    if (!sha) {
      continue;
    }

    if (sha !== row.gitSha) {
      await enqueueIndexJob(row.owner, row.repo);
      enqueued++;
    }
  }

  return NextResponse.json({ checked: repoRows.length, enqueued });
}
