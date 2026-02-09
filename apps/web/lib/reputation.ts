import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { leaderboardEntries, outcomes, shares, verifications } from "./schema";
import type { ContributorProfile, Reputation, ShareWithStats } from "./types";

async function recalculateReputation(username: string): Promise<Reputation> {
  const userShares = await db
    .select({ id: shares.id, viewCount: shares.viewCount })
    .from(shares)
    .where(eq(shares.owner, username));

  if (userShares.length === 0) {
    return { score: 0, shares_count: 0, total_views: 0, avg_success_rate: 0 };
  }

  const shareIds = userShares.map((s) => s.id);
  const totalViews = userShares.reduce((sum, s) => sum + s.viewCount, 0);

  const [outcomeAgg] = await db
    .select({
      totalSuccess: sql<number>`COALESCE(cast(SUM(${outcomes.successCount}) as int), 0)`,
      totalFailure: sql<number>`COALESCE(cast(SUM(${outcomes.failureCount}) as int), 0)`,
    })
    .from(outcomes)
    .where(sql`${outcomes.shareId} = ANY(${shareIds})`);

  const [verAgg] = await db
    .select({
      totalVerifications: sql<number>`cast(count(*) as int)`,
    })
    .from(verifications)
    .where(sql`${verifications.shareId} = ANY(${shareIds})`);

  const totalSuccess = outcomeAgg?.totalSuccess ?? 0;
  const totalOutcomes = totalSuccess + (outcomeAgg?.totalFailure ?? 0);
  const totalVerifications = verAgg?.totalVerifications ?? 0;

  const avgSuccessRate = totalOutcomes > 0 ? totalSuccess / totalOutcomes : 0;

  const score =
    avgSuccessRate * 40 + (totalViews / 100) * 30 + totalVerifications * 30;

  const reputation: Reputation = {
    score: Math.round(score * 100) / 100,
    shares_count: userShares.length,
    total_views: totalViews,
    avg_success_rate: Math.round(avgSuccessRate * 100) / 100,
  };

  const monthKey = new Date().toISOString().slice(0, 7);

  await db
    .insert(leaderboardEntries)
    .values([
      {
        username,
        period: "all-time",
        score: reputation.score,
      },
      {
        username,
        period: monthKey,
        score: reputation.score,
      },
    ])
    .onConflictDoUpdate({
      target: [leaderboardEntries.username, leaderboardEntries.period],
      set: {
        score: sql`excluded.score`,
        updatedAt: sql`now()`,
      },
    });

  return reputation;
}

export async function getContributorProfile(
  username: string
): Promise<ContributorProfile | null> {
  const userShares = await db.query.shares.findMany({
    where: eq(shares.owner, username),
    with: {
      shareTags: { with: { tag: true } },
      outcomes: true,
      verifications: true,
    },
  });

  if (userShares.length === 0) {
    return null;
  }

  const reputation = await recalculateReputation(username);

  const enrichedShares: ShareWithStats[] = userShares.map((s) => {
    const outcome = s.outcomes[0] ?? {
      successCount: 0,
      failureCount: 0,
    };
    const total = outcome.successCount + outcome.failureCount;

    return {
      title: s.title,
      slug: s.slug,
      tags: s.shareTags.map((st) => st.tag.name),
      problem: s.problem,
      solution_type: s.solutionType,
      verified: s.verified > 0,
      created: s.createdAt?.toISOString(),
      updated: s.updatedAt?.toISOString(),
      ai_provider: s.aiProvider ?? undefined,
      environment: s.environment ?? undefined,
      related: s.related ?? undefined,
      owner: s.owner,
      repo: s.repo,
      content: s.content,
      url: s.url,
      views: s.viewCount,
      outcome: {
        success: outcome.successCount,
        failure: outcome.failureCount,
      },
      verifications: s.verifications.length,
      successRate: total > 0 ? outcome.successCount / total : null,
      install_count: s.installCount,
      first_seen_at: s.firstSeenAt.toISOString(),
      indexed_by: s.indexedBy,
    };
  });

  return { username, ...reputation, shares: enrichedShares };
}

export async function getLeaderboard(
  period: "all-time" | "monthly" = "all-time",
  limit = 20
): Promise<{ username: string; score: number }[]> {
  const key =
    period === "monthly" ? new Date().toISOString().slice(0, 7) : "all-time";

  const results = await db
    .select({
      username: leaderboardEntries.username,
      score: leaderboardEntries.score,
    })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.period, key))
    .orderBy(desc(leaderboardEntries.score))
    .limit(limit);

  return results;
}

export async function recordOutcome(
  owner: string,
  repo: string,
  slug: string,
  outcome: "success" | "failure"
): Promise<void> {
  const [share] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(eq(shares.owner, owner), eq(shares.repo, repo), eq(shares.slug, slug))
    )
    .limit(1);

  if (!share) {
    throw new Error(`Share not found: ${owner}/${repo}/${slug}`);
  }

  if (outcome === "success") {
    await db
      .insert(outcomes)
      .values({ shareId: share.id, successCount: 1, failureCount: 0 })
      .onConflictDoUpdate({
        target: outcomes.shareId,
        set: {
          successCount: sql`${outcomes.successCount} + 1`,
        },
      });
  } else {
    await db
      .insert(outcomes)
      .values({ shareId: share.id, successCount: 0, failureCount: 1 })
      .onConflictDoUpdate({
        target: outcomes.shareId,
        set: {
          failureCount: sql`${outcomes.failureCount} + 1`,
        },
      });
  }

  await recalculateReputation(owner);
}

export async function recordVerification(
  owner: string,
  repo: string,
  slug: string,
  githubUser: string
): Promise<{ count: number; alreadyVerified: boolean }> {
  const [share] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(eq(shares.owner, owner), eq(shares.repo, repo), eq(shares.slug, slug))
    )
    .limit(1);

  if (!share) {
    throw new Error(`Share not found: ${owner}/${repo}/${slug}`);
  }

  try {
    await db.insert(verifications).values({ shareId: share.id, githubUser });
  } catch {
    const [countResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(verifications)
      .where(eq(verifications.shareId, share.id));
    return { count: countResult?.count ?? 0, alreadyVerified: true };
  }

  const [countResult] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(verifications)
    .where(eq(verifications.shareId, share.id));

  await recalculateReputation(owner);

  return { count: countResult?.count ?? 0, alreadyVerified: false };
}
