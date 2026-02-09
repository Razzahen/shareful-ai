import { NextResponse } from "next/server";
import { createConfiguredEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { searchProblemSolutions } from "@/lib/dedupe/problem-search";
import { createDrizzleDedupeStore } from "@/lib/dedupe/store";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const MAX_LIMIT = 50;
const MAX_SOLUTIONS_PER_PROBLEM = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_STRICT_MAX = 8;

function parseBoolean(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const strict = parseBoolean(searchParams.get("strict"));

  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(
    Number.isNaN(parsedLimit) ? 10 : parsedLimit,
    MAX_LIMIT
  );

  const parsedSolutions = Number.parseInt(
    searchParams.get("solutions") ?? "5",
    10
  );
  const solutionsPerProblem = Math.min(
    Number.isNaN(parsedSolutions) ? 5 : parsedSolutions,
    MAX_SOLUTIONS_PER_PROBLEM
  );

  const language = searchParams.get("language") ?? undefined;
  const framework = searchParams.get("framework") ?? undefined;
  const errorSignature = searchParams.get("errorSignature") ?? undefined;

  try {
    const ip = getClientIp(request);
    const namespace = strict ? "problem-search-strict" : "problem-search";
    const maxRequests = strict ? RATE_LIMIT_STRICT_MAX : RATE_LIMIT_MAX;
    if (isRateLimited(ip, namespace, maxRequests, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const store = createDrizzleDedupeStore();
    const embeddings = createConfiguredEmbeddingProvider();
    const judge = strict ? createConfiguredJudge() : undefined;

    const result = await searchProblemSolutions({
      query: {
        problem: q,
        language,
        framework,
        errorSignature,
      },
      store,
      embeddings,
      judge,
      strict,
      limits: {
        relatedProblems: limit,
        solutionsPerProblem,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (
      message.includes("OPENAI_API_KEY") ||
      message.includes("GEMINI_API_KEY")
    ) {
      return NextResponse.json(
        { error: "LLM not configured" },
        { status: 503 }
      );
    }

    console.error("Problem search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
