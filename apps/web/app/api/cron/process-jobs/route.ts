import { and, asc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { indexRepo } from "@/lib/indexer";
import { isRegistered, registerRepo } from "@/lib/registry";
import { indexJobs } from "@/lib/schema";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await db
    .select()
    .from(indexJobs)
    .where(
      and(eq(indexJobs.status, "pending"), lt(indexJobs.attempts, MAX_ATTEMPTS))
    )
    .orderBy(asc(indexJobs.createdAt))
    .limit(BATCH_SIZE);

  let processed = 0;

  for (const job of jobs) {
    await db
      .update(indexJobs)
      .set({ status: "processing", attempts: job.attempts + 1 })
      .where(eq(indexJobs.id, job.id));

    try {
      if (!(await isRegistered(job.owner, job.repo))) {
        await registerRepo(job.owner, job.repo);
      }

      await indexRepo(job.owner, job.repo);

      await db
        .update(indexJobs)
        .set({ status: "done", processedAt: new Date() })
        .where(eq(indexJobs.id, job.id));

      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(indexJobs)
        .set({
          status: job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
          error: message,
        })
        .where(eq(indexJobs.id, job.id));
    }
  }

  return NextResponse.json({ processed, total: jobs.length });
}
