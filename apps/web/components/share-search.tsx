"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { SolutionTypeBadge } from "@/components/solution-type-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShareWithStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 50;
const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_TIMEOUT_MS = 10_000;
const INVALID_QUERY_CHARACTERS = /[^a-zA-Z0-9@._/\s-]+/g;
const QUERY_SPLIT_REGEX = /\s+/;
const NORMALIZE_SPACES_REGEX = /\s+/g;
const LIST_SKELETON_KEYS = Array.from(
  { length: 5 },
  (_, index) => `list-skeleton-${index}`
);

type SearchErrorKind = "invalid" | "meta" | "network" | "server" | "timeout";

interface SearchErrorState {
  kind: SearchErrorKind;
  title: string;
  message: string;
  actionLabel?: string;
}

function formatViews(views: number): string {
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

function highlightMatches(value: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return value;
  }

  const tokens = normalizedQuery
    .split(QUERY_SPLIT_REGEX)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return value;
  }

  const lowerValue = value.toLowerCase();
  const ranges: [number, number][] = [];

  for (const token of tokens) {
    let startIndex = 0;
    while (startIndex < lowerValue.length) {
      const matchIndex = lowerValue.indexOf(token, startIndex);
      if (matchIndex === -1) {
        break;
      }
      ranges.push([matchIndex, matchIndex + token.length - 1]);
      startIndex = matchIndex + token.length;
    }
  }

  if (ranges.length === 0) {
    return value;
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (!last || start > last[1] + 1) {
      merged.push([start, end]);
    } else {
      last[1] = Math.max(last[1], end);
    }
  }

  const nodes: Array<string | React.JSX.Element> = [];
  let lastIndex = 0;

  for (const [start, end] of merged) {
    if (start > lastIndex) {
      nodes.push(value.slice(lastIndex, start));
    }
    nodes.push(
      <span className="font-semibold text-foreground" key={`${start}-${end}`}>
        {value.slice(start, end + 1)}
      </span>
    );
    lastIndex = end + 1;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function stripInvalidQueryCharacters(value: string) {
  return value.replace(INVALID_QUERY_CHARACTERS, "");
}

function normalizeSearchQuery(value: string) {
  return stripInvalidQueryCharacters(value)
    .replace(NORMALIZE_SPACES_REGEX, " ")
    .trim();
}

function getSearchErrorForStatus(status: number): SearchErrorState {
  if (status === 400) {
    return {
      kind: "invalid",
      title: "Search needs a cleaner query",
      message: "Some characters cannot be matched yet. Try removing symbols.",
    };
  }

  if (status === 429) {
    return {
      kind: "server",
      title: "Too many searches at once",
      message: "Give it a moment and try again.",
      actionLabel: "Retry",
    };
  }

  if (status >= 500) {
    return {
      kind: "server",
      title: "Search is unavailable",
      message: "We could not reach the search service right now.",
      actionLabel: "Retry",
    };
  }

  return {
    kind: "server",
    title: "Search failed",
    message: "We could not complete that search.",
    actionLabel: "Retry",
  };
}

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error
    ? (error as { name?: string }).name === "AbortError"
    : false;
}

function isSearchErrorState(error: unknown): error is SearchErrorState {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    "title" in error &&
    "message" in error
  );
}

function buildNetworkSearchError(error: unknown): SearchErrorState {
  return {
    kind: "network",
    title: "Search failed",
    message:
      error instanceof Error ? error.message : "Failed to search shares.",
    actionLabel: "Retry",
  };
}

function resolveSearchError(error: unknown, didTimeout: boolean) {
  if (isAbortError(error)) {
    return didTimeout
      ? {
          kind: "timeout" as const,
          title: "Search timed out",
          message: "We could not fetch results fast enough.",
          actionLabel: "Retry",
        }
      : null;
  }

  if (isSearchErrorState(error)) {
    return error;
  }

  return buildNetworkSearchError(error);
}

function useShareSearchResults(query: string) {
  const [results, setResults] = useState<ShareWithStats[]>([]);
  const [searchError, setSearchError] = useState<SearchErrorState | null>(null);
  const [_retryToken, setRetryToken] = useState(0);
  const [isSearching, setIsSearching] = useState(
    () => normalizeSearchQuery(query).trim().length > 0
  );
  const currentRequestIdRef = useRef(0);

  const sanitizedQuery = useMemo(() => normalizeSearchQuery(query), [query]);
  const trimmedQuery = sanitizedQuery.trim();
  const hasInvalidCharacters = stripInvalidQueryCharacters(query) !== query;

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = currentRequestIdRef.current + 1;
    currentRequestIdRef.current = requestId;
    const controller = new AbortController();
    let didTimeout = false;
    setIsSearching(true);
    setSearchError(null);

    const fetchTimeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, SEARCH_TIMEOUT_MS);

    const scheduleId = window.setTimeout(() => {
      fetch(
        `/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${MAX_RESULTS}`,
        { signal: controller.signal }
      )
        .then((response) => {
          if (!response.ok) {
            throw getSearchErrorForStatus(response.status);
          }
          return response.json();
        })
        .then((data: { shares?: ShareWithStats[]; total?: number }) => {
          if (currentRequestIdRef.current !== requestId) {
            return;
          }
          const incoming = Array.isArray(data.shares) ? data.shares : [];
          setResults(incoming);
        })
        .catch((err: unknown) => {
          if (currentRequestIdRef.current !== requestId) {
            return;
          }

          const resolvedError = resolveSearchError(err, didTimeout);
          if (resolvedError) {
            setSearchError(resolvedError);
          }
        })
        .finally(() => {
          if (currentRequestIdRef.current === requestId) {
            setIsSearching(false);
          }
          window.clearTimeout(fetchTimeoutId);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(scheduleId);
      window.clearTimeout(fetchTimeoutId);
    };
  }, [trimmedQuery]);

  return {
    results,
    isSearching,
    searchError,
    hasInvalidCharacters,
    trimmedQuery,
    retry: () => setRetryToken((value) => value + 1),
  };
}

function computeDisplayState({
  hasRawQuery,
  hasQuery,
  isSearching,
  resultsLength,
  searchError,
}: {
  hasRawQuery: boolean;
  hasQuery: boolean;
  isSearching: boolean;
  resultsLength: number;
  searchError: SearchErrorState | null;
}) {
  const showBeginState = !hasRawQuery;
  const showSanitizedState = hasRawQuery && !hasQuery;
  const showNoResultsState =
    hasQuery && !isSearching && resultsLength === 0 && !searchError;
  const showResults = hasQuery && resultsLength > 0;
  const showResultsSkeleton =
    hasQuery && isSearching && resultsLength === 0 && !searchError;

  return {
    showBeginState,
    showSanitizedState,
    showNoResultsState,
    showResults,
    showResultsSkeleton,
  };
}

function ShareSearchErrorNotice({
  error,
  onRetry,
}: {
  error: SearchErrorState | null;
  onRetry: () => void;
}) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <div className="font-semibold text-destructive">{error.title}</div>
      <p className="mt-1 text-destructive/90">{error.message}</p>
      {error.actionLabel ? (
        <button
          className="mt-3 inline-flex items-center gap-2 text-destructive underline-offset-4 hover:underline"
          onClick={onRetry}
          type="button"
        >
          {error.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ShareSearchEmptyState({
  isVisible,
  title,
  description,
}: {
  isVisible: boolean;
  title: string;
  description: ReactNode;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex size-full flex-col items-center justify-center py-3">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-muted/30">
          <Search className="size-4 text-muted-foreground" />
        </div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-foreground/80 text-sm">{description}</p>
      </div>
    </div>
  );
}

function ShareSearchSkeleton({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 py-3 md:gap-3">
      <div className="flex flex-row items-center justify-between gap-2 md:gap-0">
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/40">
        {LIST_SKELETON_KEYS.map((key, index) => (
          <div
            className={cn(
              "flex h-[60px] items-center gap-3 rounded-none bg-card px-4 py-3",
              index === 0 && "rounded-t-lg",
              index === LIST_SKELETON_KEYS.length - 1 && "rounded-b-lg"
            )}
            key={key}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShareSearchResultsSection({
  isVisible,
  results,
  trimmedQuery,
}: {
  isVisible: boolean;
  results: ShareWithStats[];
  trimmedQuery: string;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2 py-3 md:gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Results</h2>
        <span className="text-muted-foreground text-xs">
          Showing {results.length} results
        </span>
      </div>
      <div className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/40">
        {results.map((share, index) => (
          <Link
            className={cn(
              "flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/60",
              index === 0 && "rounded-t-lg",
              index === results.length - 1 && "rounded-b-lg"
            )}
            href={`/s/${share.owner}/${share.repo}/${share.slug}`}
            key={`${share.owner}/${share.repo}/${share.slug}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {highlightMatches(share.title, trimmedQuery)}
              </p>
              {share.problem && (
                <p className="line-clamp-1 text-muted-foreground/80 text-xs">
                  {highlightMatches(share.problem, trimmedQuery)}
                </p>
              )}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SolutionTypeBadge type={share.solution_type} />
              <span className="text-muted-foreground text-xs">
                {share.owner}/{share.repo}
              </span>
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                {formatViews(share.views)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ShareSearch() {
  const searchParams = useSearchParams();
  const queryFromParams = searchParams.get("q") ?? "";

  const {
    results,
    isSearching,
    searchError,
    hasInvalidCharacters,
    trimmedQuery,
    retry: retrySearch,
  } = useShareSearchResults(queryFromParams);

  const hasQuery = trimmedQuery.length > 0;
  const hasRawQuery = queryFromParams.trim().length > 0;
  const showSanitizedHint = hasInvalidCharacters && queryFromParams.length > 0;

  const displayState = computeDisplayState({
    hasRawQuery,
    hasQuery,
    isSearching,
    resultsLength: results.length,
    searchError,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      {showSanitizedHint ? (
        <p className="text-muted-foreground text-xs">
          Unsupported characters are ignored in results.
        </p>
      ) : null}
      <ShareSearchErrorNotice error={searchError} onRetry={retrySearch} />
      <ShareSearchEmptyState
        description={
          <>
            Enter a keyword, error message, or topic
            <br />
            to see results instantly.
          </>
        }
        isVisible={displayState.showBeginState}
        title="Begin your search"
      />
      <ShareSearchEmptyState
        description="Try letters, numbers, or a simpler query."
        isVisible={displayState.showSanitizedState}
        title="We filtered unsupported characters"
      />
      <ShareSearchEmptyState
        description="Try a broader keyword or different search terms."
        isVisible={displayState.showNoResultsState}
        title="No results found"
      />
      <ShareSearchSkeleton isVisible={displayState.showResultsSkeleton} />
      <ShareSearchResultsSection
        isVisible={displayState.showResults}
        results={results}
        trimmedQuery={trimmedQuery}
      />
    </div>
  );
}
