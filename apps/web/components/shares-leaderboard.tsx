"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { SolutionTypeBadge } from "@/components/solution-type-badge";
import type { LeaderboardData } from "@/lib/homepage";

type Tab = "all-time" | "trending" | "recent";

function formatViews(views: number): string {
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

interface SharesLeaderboardProps {
  allTime: LeaderboardData;
  trending: LeaderboardData;
  recent: LeaderboardData;
}

export function SharesLeaderboard({
  allTime,
  trending,
  recent,
}: SharesLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("all-time");

  const tabDataMap: Record<Tab, typeof allTime> = {
    "all-time": allTime,
    trending,
    recent,
  };
  const data = tabDataMap[activeTab];

  const tabs: { key: Tab; label: string }[] = [
    { key: "all-time", label: `All Time (${allTime.total.toLocaleString()})` },
    { key: "trending", label: "Trending (24h)" },
    { key: "recent", label: "Recent" },
  ];

  return (
    <div className="space-y-6">
      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
        Shares Leaderboard
      </p>

      <SearchBar />

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            className={`rounded-md px-3 py-2 font-medium text-sm transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {data.shares.length > 0 ? (
        <div>
          <div className="flex items-center border-b px-3 py-2 text-muted-foreground text-xs uppercase tracking-wider">
            <span className="w-10">#</span>
            <span className="flex-1">Share</span>
            <span className="text-right">Views</span>
          </div>
          {data.shares.map((share, index) => (
            <Link
              className="flex items-center border-b px-3 py-3 transition-colors hover:bg-accent/50"
              href={`/s/${share.owner}/${share.repo}/${share.slug}`}
              key={`${share.owner}/${share.repo}/${share.slug}`}
            >
              <span className="w-10 font-bold text-muted-foreground text-sm">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{share.title}</p>
                <div className="flex items-center gap-2">
                  <span className="truncate text-muted-foreground text-xs">
                    {share.owner}/{share.repo}
                  </span>
                  <SolutionTypeBadge type={share.solution_type} />
                </div>
              </div>
              <span className="ml-4 font-mono text-muted-foreground text-sm tabular-nums">
                {formatViews(share.views)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No shares yet. Be the first to share a solution!
          </p>
          <code className="mt-4 inline-block rounded-lg border bg-muted px-4 py-2 font-mono text-sm">
            npx shareful-ai create
          </code>
        </div>
      )}
    </div>
  );
}
