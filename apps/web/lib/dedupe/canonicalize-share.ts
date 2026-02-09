import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { shares } from "@/lib/schema";
import { createConfiguredEmbeddingProvider } from "./embeddings";
import { ingestProblemSolution } from "./ingest";
import { createConfiguredJudge } from "./judge";
import { createDrizzleDedupeStore } from "./store";

function extractBetween(
  content: string,
  startHeading: string,
  endHeading: string
): string | null {
  const start = content.indexOf(startHeading);
  if (start === -1) {
    return null;
  }
  const afterStart = content.slice(start + startHeading.length);
  const end = afterStart.indexOf(endHeading);
  const section = end === -1 ? afterStart : afterStart.slice(0, end);
  return section.trim();
}

export function extractShareProblemSolution(content: string): {
  problem: string;
  solution: string;
} {
  // `parseShareMd` enforces these sections exist.
  const problemSection =
    extractBetween(content, "## Problem", "## Solution") ?? "";
  const solutionSection =
    extractBetween(content, "## Solution", "## Why It Works") ??
    extractBetween(content, "## Solution", "## Context") ??
    "";

  const problem = problemSection.trim();
  const solution = solutionSection.trim();

  return {
    problem: problem.length > 0 ? problem : content.trim(),
    solution: solution.length > 0 ? solution : content.trim(),
  };
}

export async function canonicalizeShare(args: {
  shareId: number;
  owner: string;
  repo: string;
  slug: string;
  frontmatterProblem: string;
  content: string;
  environment?: {
    language?: string;
    framework?: string;
    version?: string;
  } | null;
}): Promise<
  | {
      action: "updated";
      submissionId: number;
      problemId: number;
      solutionId: number;
    }
  | { action: "noop"; problemId: number; solutionId: number }
  | null
> {
  const existing = await db
    .select({
      canonicalProblemId: shares.canonicalProblemId,
      canonicalSolutionId: shares.canonicalSolutionId,
    })
    .from(shares)
    .where(eq(shares.id, args.shareId))
    .limit(1);

  const row = existing[0];
  if (!row) {
    return null;
  }

  // Skip work if already linked.
  if (row.canonicalProblemId && row.canonicalSolutionId) {
    return {
      problemId: row.canonicalProblemId,
      solutionId: row.canonicalSolutionId,
      action: "noop",
    };
  }

  const extracted = extractShareProblemSolution(args.content);
  const problem = extracted.problem.trim() || args.frontmatterProblem.trim();
  const solution = extracted.solution.trim();

  if (!(problem && solution)) {
    return null;
  }

  const store = createDrizzleDedupeStore();
  const embeddings = createConfiguredEmbeddingProvider();
  const judge = createConfiguredJudge();

  const result = await ingestProblemSolution({
    submission: {
      problem,
      solution,
      language: args.environment?.language,
      framework: args.environment?.framework,
      metadata: {
        share: {
          owner: args.owner,
          repo: args.repo,
          slug: args.slug,
          shareId: args.shareId,
        },
      },
    },
    source: "share-index",
    store,
    embeddings,
    judge,
  });

  await db
    .update(shares)
    .set({
      canonicalProblemId: result.problem.id,
      canonicalSolutionId: result.solution.id,
    })
    .where(
      and(
        eq(shares.id, args.shareId),
        or(
          isNull(shares.canonicalProblemId),
          isNull(shares.canonicalSolutionId)
        )
      )
    );

  return {
    submissionId: result.submissionId,
    problemId: result.problem.id,
    solutionId: result.solution.id,
    action: "updated",
  };
}
