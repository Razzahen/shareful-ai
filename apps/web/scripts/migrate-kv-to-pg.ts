/**
 * One-time migration script: Vercel KV → Neon Postgres
 *
 * Transfers all shares, outcomes, verifications, and repos from KV to Postgres.
 * Run with: npx tsx scripts/migrate-kv-to-pg.ts
 *
 * Requires DATABASE_URL, KV_REST_API_URL, and KV_REST_API_TOKEN env vars.
 */

import { kv } from "@vercel/kv";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  outcomes,
  repos,
  shares,
  shareTags,
  tags,
  verifications,
} from "../lib/schema";

interface KVShare {
  title: string;
  slug: string;
  tags: string[];
  problem: string;
  solution_type: "fix" | "workaround" | "pattern" | "reference" | "config";
  verified?: boolean;
  created?: string;
  updated?: string;
  ai_provider?: "claude" | "gpt" | "gemini";
  environment?: { language?: string; framework?: string; version?: string };
  related?: string[];
  owner: string;
  repo: string;
  content: string;
  url: string;
}

interface KVRepoEntry {
  owner: string;
  repo: string;
  indexed_at: string;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const result = await kv.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);
  return keys;
}

async function upsertTag(name: string): Promise<number> {
  const [result] = await db
    .insert(tags)
    .values({ name })
    .onConflictDoNothing({ target: tags.name })
    .returning({ id: tags.id });

  if (result) {
    return result.id;
  }

  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);

  return existing.id;
}

async function migrateRepos(): Promise<void> {
  console.log("Migrating repos...");
  const repoList = await kv.get<KVRepoEntry[]>("registry:repos");
  if (!repoList || repoList.length === 0) {
    console.log("  No repos found in KV");
    return;
  }

  for (const entry of repoList) {
    await db
      .insert(repos)
      .values({
        owner: entry.owner,
        repo: entry.repo,
        indexedAt: new Date(entry.indexed_at),
      })
      .onConflictDoNothing();
  }

  console.log(`  Migrated ${repoList.length} repos`);
}

async function migrateShares(): Promise<void> {
  console.log("Migrating shares...");
  const keys = await scanKeys("share:*");
  console.log(`  Found ${keys.length} share keys`);

  let migrated = 0;
  for (const key of keys) {
    const share = await kv.get<KVShare>(key);
    if (!share) {
      continue;
    }

    const [inserted] = await db
      .insert(shares)
      .values({
        owner: share.owner,
        repo: share.repo,
        slug: share.slug,
        title: share.title,
        problem: share.problem,
        solutionType: share.solution_type,
        content: share.content,
        url: share.url,
        verified: share.verified ? 1 : 0,
        aiProvider: share.ai_provider ?? null,
        environment: share.environment ?? null,
        related: share.related ?? null,
        createdAt: share.created ? new Date(share.created) : null,
        updatedAt: share.updated ? new Date(share.updated) : null,
      })
      .onConflictDoNothing()
      .returning({ id: shares.id });

    if (!inserted) {
      continue;
    }

    if (share.tags.length > 0) {
      const tagIds = await Promise.all(share.tags.map(upsertTag));
      await db
        .insert(shareTags)
        .values(tagIds.map((tagId) => ({ shareId: inserted.id, tagId })))
        .onConflictDoNothing();
    }

    migrated++;
    if (migrated % 100 === 0) {
      console.log(`  Migrated ${migrated}/${keys.length} shares`);
    }
  }

  console.log(`  Migrated ${migrated} shares total`);
}

async function migrateOutcomes(): Promise<void> {
  console.log("Migrating outcomes...");
  const keys = await scanKeys("outcome:*");
  console.log(`  Found ${keys.length} outcome keys`);

  let migrated = 0;
  for (const key of keys) {
    const data = await kv.get<{ success: number; failure: number }>(key);
    if (!data) {
      continue;
    }

    const parts = key.replace("outcome:", "").split("/");
    if (parts.length !== 3) {
      continue;
    }
    const [owner, repo, slug] = parts;

    const [share] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(
        eq(shares.owner, owner) &&
          eq(shares.repo, repo) &&
          eq(shares.slug, slug)
      )
      .limit(1);

    if (!share) {
      continue;
    }

    await db
      .insert(outcomes)
      .values({
        shareId: share.id,
        successCount: data.success,
        failureCount: data.failure,
      })
      .onConflictDoNothing();

    migrated++;
  }

  console.log(`  Migrated ${migrated} outcomes`);
}

async function migrateVerifications(): Promise<void> {
  console.log("Migrating verifications...");
  const keys = await scanKeys("verified:*");
  console.log(`  Found ${keys.length} verification keys`);

  let migrated = 0;
  for (const key of keys) {
    const data = await kv.get<{ count: number; users: string[] }>(key);
    if (!data || data.users.length === 0) {
      continue;
    }

    const parts = key.replace("verified:", "").split("/");
    if (parts.length !== 3) {
      continue;
    }
    const [owner, repo, slug] = parts;

    const [share] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(
        eq(shares.owner, owner) &&
          eq(shares.repo, repo) &&
          eq(shares.slug, slug)
      )
      .limit(1);

    if (!share) {
      continue;
    }

    for (const githubUser of data.users) {
      await db
        .insert(verifications)
        .values({ shareId: share.id, githubUser })
        .onConflictDoNothing();
      migrated++;
    }
  }

  console.log(`  Migrated ${migrated} verifications`);
}

async function main(): Promise<void> {
  console.log("Starting KV → Postgres migration...\n");

  await migrateRepos();
  await migrateShares();
  await migrateOutcomes();
  await migrateVerifications();

  console.log("\nMigration complete!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
