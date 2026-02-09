import { and, eq } from "drizzle-orm";
import { logIndexEvent } from "./audit";
import { db } from "./db";
import { indexJobs, repos } from "./schema";
import type { RepoEntry } from "./types";

export async function listRepos(): Promise<RepoEntry[]> {
  const results = await db.select().from(repos);
  return results.map((r) => ({
    owner: r.owner,
    repo: r.repo,
    indexed_at: r.indexedAt.toISOString(),
  }));
}

export async function registerRepo(
  owner: string,
  repo: string
): Promise<RepoEntry> {
  const [result] = await db
    .insert(repos)
    .values({ owner, repo })
    .onConflictDoUpdate({
      target: [repos.owner, repos.repo],
      set: { indexedAt: new Date() },
    })
    .returning();

  await logIndexEvent("register", owner, repo);

  return {
    owner: result.owner,
    repo: result.repo,
    indexed_at: result.indexedAt.toISOString(),
  };
}

export async function isRegistered(
  owner: string,
  repo: string
): Promise<boolean> {
  const result = await db
    .select({ id: repos.id })
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.repo, repo)))
    .limit(1);
  return result.length > 0;
}

export async function getRepoRecord(
  owner: string,
  repo: string
): Promise<{ id: number; gitSha: string | null } | null> {
  const [result] = await db
    .select({ id: repos.id, gitSha: repos.gitSha })
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.repo, repo)))
    .limit(1);
  return result ?? null;
}

export async function updateRepoSha(
  owner: string,
  repo: string,
  sha: string
): Promise<void> {
  await db
    .update(repos)
    .set({ gitSha: sha, lastIndexedAt: new Date() })
    .where(and(eq(repos.owner, owner), eq(repos.repo, repo)));
}

export async function enqueueIndexJob(
  owner: string,
  repo: string
): Promise<void> {
  await db.insert(indexJobs).values({ owner, repo });
}
