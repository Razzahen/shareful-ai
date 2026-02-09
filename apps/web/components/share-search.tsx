"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { SolutionTypeBadge } from "@/components/solution-type-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  MatchDecision,
  ProblemCandidate,
  ProblemSearchQuery,
  RankedProblemSolution,
} from "@/lib/dedupe/types";
import type { ShareWithStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHARE_MAX_RESULTS = 50;
const SHARE_SEARCH_DEBOUNCE_MS = 200;
const PROBLEM_MAX_RESULTS = 20;
const PROBLEM_SOLUTIONS_PER_PROBLEM = 5;
const PROBLEM_SEARCH_DEBOUNCE_MS = 500;
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

function normalizeProblemQuery(value: string) {
  return value.replace(NORMALIZE_SPACES_REGEX, " ").trim();
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

  if (status === 503) {
    return {
      kind: "meta",
      title: "AI search is not configured",
      message:
        "This search mode requires a configured LLM provider (GEMINI_API_KEY and/or OPENAI_API_KEY).",
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
    message: error instanceof Error ? error.message : "Failed to search.",
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
  const [retryToken, setRetryToken] = useState(0);
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
        `/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${SHARE_MAX_RESULTS}&rt=${retryToken}`,
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
    }, SHARE_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(scheduleId);
      window.clearTimeout(fetchTimeoutId);
    };
  }, [retryToken, trimmedQuery]);

  return {
    results,
    isSearching,
    searchError,
    hasInvalidCharacters,
    trimmedQuery,
    retry: () => setRetryToken((value) => value + 1),
  };
}

type SearchMode = "shares" | "problems";

interface ProblemSearchHit {
  problem: ProblemCandidate;
  solutions: RankedProblemSolution[];
  judge?: MatchDecision;
}

interface ProblemSearchResponse {
  query: ProblemSearchQuery;
  exact: ProblemSearchHit | null;
  related: ProblemSearchHit[];
}

function useProblemSearchResults(
  query: string,
  options?: { strict?: boolean }
) {
  const strict = options?.strict ?? false;

  const [result, setResult] = useState<ProblemSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<SearchErrorState | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [isSearching, setIsSearching] = useState(
    () => normalizeProblemQuery(query).trim().length > 0
  );
  const currentRequestIdRef = useRef(0);

  const trimmedQuery = useMemo(() => normalizeProblemQuery(query), [query]);

  useEffect(() => {
    if (!trimmedQuery) {
      setResult(null);
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
      const strictParam = strict ? "&strict=1" : "";
      fetch(
        `/api/problem-search?q=${encodeURIComponent(trimmedQuery)}&limit=${PROBLEM_MAX_RESULTS}&solutions=${PROBLEM_SOLUTIONS_PER_PROBLEM}${strictParam}&rt=${retryToken}`,
        { signal: controller.signal }
      )
        .then((response) => {
          if (!response.ok) {
            throw getSearchErrorForStatus(response.status);
          }
          return response.json();
        })
        .then((data: ProblemSearchResponse) => {
          if (currentRequestIdRef.current !== requestId) {
            return;
          }
          setResult(data);
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
    }, PROBLEM_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(scheduleId);
      window.clearTimeout(fetchTimeoutId);
    };
  }, [retryToken, strict, trimmedQuery]);

  return {
    result,
    isSearching,
    searchError,
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

function SearchModeToggle({
  mode,
  onChange,
}: {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/30 p-1">
        <button
          aria-pressed={mode === "shares"}
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-full px-3 text-sm transition-colors",
            mode === "shares"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          )}
          onClick={() => onChange("shares")}
          type="button"
        >
          Shares
        </button>
        <button
          aria-pressed={mode === "problems"}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-2 rounded-full px-3 text-sm transition-colors",
            mode === "problems"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          )}
          onClick={() => onChange("problems")}
          type="button"
        >
          <Sparkles className="size-4" />
          Problems
        </button>
      </div>
      <span className="text-muted-foreground text-xs">
        {mode === "shares"
          ? "Fast keyword search"
          : "Vector search + optional strict match"}
      </span>
    </div>
  );
}

function formatProblemContext(problem: ProblemCandidate): string {
  const parts: string[] = [];
  if (problem.language) {
    parts.push(problem.language);
  }
  if (problem.framework) {
    parts.push(problem.framework);
  }
  if (problem.errorSignature) {
    const error = problem.errorSignature.trim();
    parts.push(error.length > 80 ? `${error.slice(0, 80)}...` : error);
  }
  return parts.join(" · ");
}

function extractSolutionPreview(solution: string): string {
  const lines = solution
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // Prefer a human sentence instead of the start of a code fence.
    .filter((line) => !line.startsWith("```"));

  const first = lines[0] ?? solution.trim();
  if (first.length <= 180) {
    return first;
  }
  return `${first.slice(0, 180)}...`;
}

function formatSolutionStats(solution: RankedProblemSolution): string {
  const parts: string[] = [
    `${formatViews(solution.seenCount)} seen`,
    `${solution.verificationCount} verified`,
  ];

  const total = solution.successCount + solution.failureCount;
  if (total > 0) {
    const rate = Math.round((solution.successCount / total) * 100);
    parts.push(`${rate}% success`);
  }

  return parts.join(" · ");
}

function ProblemSearchResultsSection({
  isVisible,
  result,
  trimmedQuery,
  strict,
}: {
  isVisible: boolean;
  result: ProblemSearchResponse | null;
  trimmedQuery: string;
  strict: boolean;
}) {
  if (!(isVisible && result)) {
    return null;
  }

  const exact = strict ? result.exact : null;
  const related = result.related;

  let exactPanel: ReactNode | null = null;
  if (strict) {
    if (exact) {
      exactPanel = (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="font-medium text-sm">
            {highlightMatches(exact.problem.canonicalProblem, trimmedQuery)}
          </p>
          {formatProblemContext(exact.problem) ? (
            <p className="mt-1 line-clamp-1 text-muted-foreground/80 text-xs">
              {formatProblemContext(exact.problem)}
            </p>
          ) : null}
          {exact.solutions.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {exact.solutions.map((solution) => (
                <div
                  className="rounded-md border border-border/60 bg-muted/10 px-3 py-2"
                  key={solution.solutionHash}
                >
                  <p className="line-clamp-2 font-medium text-sm">
                    {highlightMatches(
                      extractSolutionPreview(solution.canonicalSolution),
                      trimmedQuery
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {formatSolutionStats(solution)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-muted-foreground text-sm">
              No solutions have been linked to this problem yet.
            </p>
          )}
        </div>
      );
    } else {
      exactPanel = (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm">
          <div className="font-semibold text-foreground">
            No exact match found
          </div>
          <p className="mt-1 text-muted-foreground">
            Showing the closest canonical problems below.
          </p>
        </div>
      );
    }
  }

  return (
    <section className="flex flex-col gap-4 py-3 md:gap-5">
      {strict ? (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Exact match</h2>
          <span className="text-muted-foreground text-xs">
            {exact?.judge?.confidence != null
              ? `Confidence ${(exact.judge.confidence * 100).toFixed(0)}%`
              : "Strict match enabled"}
          </span>
        </div>
      ) : null}

      {exactPanel}

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          {strict ? "Similar problems" : "Results"}
        </h2>
        <span className="text-muted-foreground text-xs">
          Showing {related.length} results
        </span>
      </div>

      <div className="grid w-full grid-cols-1 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/40">
        {related.map((hit, index) => {
          const topSolution = hit.solutions[0];
          return (
            <div
              className={cn(
                "flex items-start gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/60",
                index === 0 && "rounded-t-lg",
                index === related.length - 1 && "rounded-b-lg"
              )}
              key={hit.problem.id}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {highlightMatches(hit.problem.canonicalProblem, trimmedQuery)}
                </p>
                {formatProblemContext(hit.problem) ? (
                  <p className="line-clamp-1 text-muted-foreground/80 text-xs">
                    {formatProblemContext(hit.problem)}
                  </p>
                ) : null}
                {topSolution ? (
                  <p className="mt-2 line-clamp-2 text-foreground/80 text-xs">
                    Top:{" "}
                    {highlightMatches(
                      extractSolutionPreview(topSolution.canonicalSolution),
                      trimmedQuery
                    )}
                  </p>
                ) : null}
              </div>
              {topSolution ? (
                <div className="ml-auto flex flex-col items-end gap-1 text-muted-foreground text-xs">
                  <span className="font-mono tabular-nums">
                    {formatViews(topSolution.seenCount)}
                  </span>
                  <span>seen</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SharesSearchView({ queryFromParams }: { queryFromParams: string }) {
  const {
    results,
    isSearching,
    searchError,
    hasInvalidCharacters,
    trimmedQuery,
    retry,
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
    <>
      {showSanitizedHint ? (
        <p className="text-muted-foreground text-xs">
          Unsupported characters are ignored in results.
        </p>
      ) : null}
      <ShareSearchErrorNotice error={searchError} onRetry={retry} />
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
    </>
  );
}

function ProblemsSearchView({ queryFromParams }: { queryFromParams: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strictParam = searchParams.get("strict");
  const strict = strictParam === "1" || strictParam === "true";

  const { result, isSearching, searchError, trimmedQuery, retry } =
    useProblemSearchResults(queryFromParams, { strict });

  const resultsLength = (result?.related.length ?? 0) + (result?.exact ? 1 : 0);
  const hasQuery = trimmedQuery.length > 0;
  const hasRawQuery = queryFromParams.trim().length > 0;

  const displayState = computeDisplayState({
    hasRawQuery,
    hasQuery,
    isSearching,
    resultsLength,
    searchError,
  });

  function enableStrictMatch() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("strict", "1");

    const queryString = params.toString();
    const target = queryString ? `/search?${queryString}` : "/search";
    router.replace(target, { scroll: false });
  }

  function disableStrictMatch() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("strict");

    const queryString = params.toString();
    const target = queryString ? `/search?${queryString}` : "/search";
    router.replace(target, { scroll: false });
  }

  return (
    <>
      {hasQuery ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-xs">
            Strict match runs an LLM judge once for this query.
          </div>
          <button
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-full border border-border/70 bg-card px-3 text-foreground text-sm shadow-sm transition-colors hover:bg-muted/50",
              strict && "bg-foreground text-background hover:brightness-95"
            )}
            onClick={strict ? disableStrictMatch : enableStrictMatch}
            type="button"
          >
            {strict ? "Strict match enabled" : "Check exact match"}
          </button>
        </div>
      ) : null}

      <ShareSearchErrorNotice error={searchError} onRetry={retry} />
      <ShareSearchEmptyState
        description={
          <>
            Describe the problem you solved or paste the error message
            <br />
            to find the exact canonical problem.
          </>
        }
        isVisible={displayState.showBeginState}
        title="Search canonical problems"
      />
      <ShareSearchEmptyState
        description="Try including the exact error message or more context."
        isVisible={displayState.showNoResultsState}
        title="No results found"
      />
      <ShareSearchSkeleton isVisible={displayState.showResultsSkeleton} />
      <ProblemSearchResultsSection
        isVisible={displayState.showResults}
        result={result}
        strict={strict}
        trimmedQuery={trimmedQuery}
      />
    </>
  );
}

export function ShareSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromParams = searchParams.get("q") ?? "";
  const modeParam = searchParams.get("mode");
  const mode: SearchMode = modeParam === "problems" ? "problems" : "shares";

  function updateMode(nextMode: SearchMode) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextMode === "shares") {
      params.delete("mode");
      params.delete("strict");
    } else {
      params.set("mode", "problems");
    }

    const queryString = params.toString();
    const target = queryString ? `/search?${queryString}` : "/search";
    router.replace(target, { scroll: false });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <SearchModeToggle mode={mode} onChange={updateMode} />
      {mode === "shares" ? (
        <SharesSearchView queryFromParams={queryFromParams} />
      ) : (
        <ProblemsSearchView queryFromParams={queryFromParams} />
      )}
    </div>
  );
}
