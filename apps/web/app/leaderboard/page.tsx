import { ContributorCard } from "@/components/contributor-card";
import { getLeaderboard } from "@/lib/reputation";
import type { Reputation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const entries = await getLeaderboard("all-time", 50);

  const contributors = entries.map((entry, index) => ({
    username: entry.username,
    reputation: {
      score: entry.score,
      shares_count: 0,
      total_views: 0,
      avg_success_rate: 0,
    } as Reputation,
    rank: index + 1,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="font-bold text-2xl tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          Developers who share the most useful fixes. Your solution could help
          thousands of agents solve the same bug.
        </p>
      </div>

      {contributors.length > 0 ? (
        <div className="space-y-3">
          {contributors.map(({ username, reputation, rank }) => (
            <ContributorCard
              key={username}
              rank={rank}
              reputation={reputation}
              username={username}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No contributors yet. Be the first to share a solution!
          </p>
          <code className="mt-4 inline-block rounded-lg border bg-muted px-4 py-2 font-mono text-sm">
            npx shareful-ai init
          </code>
        </div>
      )}
    </div>
  );
}
