import { after } from "next/server";
import { SearchBar } from "@/components/search-bar";
import { ShareCard } from "@/components/share-card";
import { incrementViews, searchShares } from "@/lib/search";
import type { ShareWithStats } from "@/lib/types";

const VALID_SOLUTION_TYPES = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];

export const dynamic = "force-dynamic";

export default async function SearchPage(props: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    tags?: string;
    limit?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const rawType = searchParams.type;
  const type =
    rawType && VALID_SOLUTION_TYPES.includes(rawType)
      ? (rawType as ShareWithStats["solution_type"])
      : undefined;
  const tags = searchParams.tags?.split(",").filter(Boolean);
  const parsedLimit = Number.parseInt(searchParams.limit ?? "20", 10);
  const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 50);

  let results: Awaited<ReturnType<typeof searchShares>> | null = null;

  if (q.trim()) {
    results = await searchShares(q, { type, tags, limit });

    // Increment view counters after response (non-blocking)
    const shares = results.shares;
    after(() =>
      Promise.all(shares.map((s) => incrementViews(s.owner, s.repo, s.slug)))
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <SearchBar defaultValue={q} />
      </div>

      {results ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {results.total} result{results.total !== 1 ? "s" : ""} for &ldquo;
            {q}&rdquo;
          </p>
          {results.shares.length > 0 ? (
            <div className="space-y-3">
              {results.shares.map((share) => (
                <ShareCard
                  key={`${share.owner}/${share.repo}/${share.slug}`}
                  share={share}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No shares found. Be the first to share a solution!
              </p>
              <code className="mt-4 inline-block rounded-lg border bg-muted px-4 py-2 font-mono text-sm">
                npx shareful-ai create
              </code>
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Enter a search query to find solutions.
          </p>
        </div>
      )}
    </div>
  );
}
