import { NextResponse } from "next/server";
import { createConfiguredEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { createDrizzleDedupeStore } from "@/lib/dedupe/store";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function unauthorized(): Response {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notConfigured(): Response {
  return NextResponse.json({ error: "Ingest not configured" }, { status: 503 });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.SUBMIT_SECRET;
  if (!secret) {
    return false;
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ") && auth.slice("Bearer ".length) === secret) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.SUBMIT_SECRET;
    if (!secret) {
      return notConfigured();
    }

    if (!isAuthorized(request)) {
      return unauthorized();
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip, "ingest", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const problem = typeof body.problem === "string" ? body.problem : "";
    const solution = typeof body.solution === "string" ? body.solution : "";
    const language =
      typeof body.language === "string" ? body.language : undefined;
    const framework =
      typeof body.framework === "string" ? body.framework : undefined;
    const errorSignature =
      typeof body.errorSignature === "string" ? body.errorSignature : undefined;
    const metadata =
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : undefined;

    if (!problem.trim()) {
      return NextResponse.json(
        { error: "Missing required field: problem" },
        { status: 400 }
      );
    }
    if (!solution.trim()) {
      return NextResponse.json(
        { error: "Missing required field: solution" },
        { status: 400 }
      );
    }

    const store = createDrizzleDedupeStore();
    const embeddings = createConfiguredEmbeddingProvider();
    const judge = createConfiguredJudge();

    const result = await ingestProblemSolution({
      submission: {
        problem,
        solution,
        language,
        framework,
        errorSignature,
        metadata,
      },
      source: "skill",
      store,
      embeddings,
      judge,
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

    console.error("Ingest error:", error);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
