import { and, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  problemSolutions,
  problems,
  solutionSubmissions,
  solutions,
} from "@/lib/schema";
import { EMBEDDING_DIMENSION } from "./constants";
import type { DedupeStore } from "./providers";
import type {
  ProblemCandidate,
  RankedProblemSolution,
  SolutionCandidate,
} from "./types";

function toVectorLiteral(embedding: number[]): string {
  // Postgres pgvector accepts a string literal like "[0.1,0.2,...]".
  // Keep values finite to avoid runtime errors.
  const safe = embedding.map((v) => (Number.isFinite(v) ? v : 0));
  return `[${safe.join(",")}]`;
}

function requireEmbeddingDimension(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected embedding dimension ${EMBEDDING_DIMENSION}, got ${embedding.length}`
    );
  }
}

export function createDrizzleDedupeStore(): DedupeStore {
  return {
    async findSimilarProblems({
      embedding,
      limit,
      language,
      framework,
    }): Promise<ProblemCandidate[]> {
      requireEmbeddingDimension(embedding);
      const vec = toVectorLiteral(embedding);
      const distanceExpr = sql<number>`(${problems.problemEmbedding} <=> ${vec}::vector)`;

      const filters: SQL[] = [];

      if (language) {
        const filter = or(
          eq(problems.language, language),
          isNull(problems.language)
        );
        if (filter) {
          filters.push(filter);
        }
      }

      if (framework) {
        const filter = or(
          eq(problems.framework, framework),
          isNull(problems.framework)
        );
        if (filter) {
          filters.push(filter);
        }
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const base = db
        .select({
          id: problems.id,
          canonicalProblem: problems.canonicalProblem,
          language: problems.language,
          framework: problems.framework,
          errorSignature: problems.errorSignature,
          metadata: problems.metadata,
          distance: distanceExpr,
        })
        .from(problems);

      const rows = await (whereClause ? base.where(whereClause) : base)
        .orderBy(distanceExpr)
        .limit(limit);

      return rows;
    },

    async createProblem(args): Promise<{ id: number }> {
      requireEmbeddingDimension(args.embedding);
      const [row] = await db
        .insert(problems)
        .values({
          canonicalProblem: args.canonicalProblem,
          language: args.language,
          framework: args.framework,
          errorSignature: args.errorSignature,
          metadata: args.metadata,
          problemEmbedding: args.embedding,
        })
        .returning({ id: problems.id });
      // biome-ignore lint/style/noNonNullAssertion: insert returning always yields a row
      return { id: row!.id };
    },

    async findSolutionByHash({ solutionHash }): Promise<{ id: number } | null> {
      const [row] = await db
        .select({ id: solutions.id })
        .from(solutions)
        .where(eq(solutions.solutionHash, solutionHash))
        .limit(1);
      return row ?? null;
    },

    async findSimilarSolutions({
      problemId,
      embedding,
      limit,
    }): Promise<SolutionCandidate[]> {
      requireEmbeddingDimension(embedding);
      const vec = toVectorLiteral(embedding);
      const distanceExpr = sql<number>`(${solutions.solutionEmbedding} <=> ${vec}::vector)`;

      const rows = await db
        .select({
          id: solutions.id,
          canonicalSolution: solutions.canonicalSolution,
          solutionHash: solutions.solutionHash,
          metadata: solutions.metadata,
          distance: distanceExpr,
        })
        .from(problemSolutions)
        .innerJoin(solutions, eq(problemSolutions.solutionId, solutions.id))
        .where(eq(problemSolutions.problemId, problemId))
        .orderBy(distanceExpr)
        .limit(limit);

      return rows;
    },

    async createSolution(args): Promise<{ id: number }> {
      requireEmbeddingDimension(args.embedding);
      const [row] = await db
        .insert(solutions)
        .values({
          canonicalSolution: args.canonicalSolution,
          solutionHash: args.solutionHash,
          metadata: args.metadata,
          solutionEmbedding: args.embedding,
        })
        // Handle concurrent inserts for the same hash without crashing the ingest pipeline.
        // We intentionally do not overwrite the canonical solution/embedding on conflict.
        .onConflictDoUpdate({
          target: solutions.solutionHash,
          set: { updatedAt: new Date() },
        })
        .returning({ id: solutions.id });
      // biome-ignore lint/style/noNonNullAssertion: insert returning always yields a row
      return { id: row!.id };
    },

    async upsertProblemSolutionLink({
      problemId,
      solutionId,
    }): Promise<{ action: "created" | "incremented"; seenCount: number }> {
      const [row] = await db
        .insert(problemSolutions)
        .values({
          problemId,
          solutionId,
          seenCount: 1,
          successCount: 0,
          failureCount: 0,
          verificationCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [problemSolutions.problemId, problemSolutions.solutionId],
          set: {
            seenCount: sql`${problemSolutions.seenCount} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ seenCount: problemSolutions.seenCount });

      const seenCount = row?.seenCount ?? 1;
      return {
        action: seenCount === 1 ? "created" : "incremented",
        seenCount,
      };
    },

    async listSolutionsForProblem({
      problemId,
      limit,
    }): Promise<RankedProblemSolution[]> {
      const scoreExpr = sql<number>`
        (
          ${problemSolutions.seenCount} * 2
          + ${problemSolutions.verificationCount} * 5
          + ${problemSolutions.successCount} * 3
          - ${problemSolutions.failureCount} * 4
        )
      `;

      const rows = await db
        .select({
          id: solutions.id,
          canonicalSolution: solutions.canonicalSolution,
          solutionHash: solutions.solutionHash,
          metadata: solutions.metadata,
          seenCount: problemSolutions.seenCount,
          successCount: problemSolutions.successCount,
          failureCount: problemSolutions.failureCount,
          verificationCount: problemSolutions.verificationCount,
          score: scoreExpr,
        })
        .from(problemSolutions)
        .innerJoin(solutions, eq(problemSolutions.solutionId, solutions.id))
        .where(eq(problemSolutions.problemId, problemId))
        .orderBy(
          sql`${scoreExpr} DESC`,
          sql`${problemSolutions.seenCount} DESC`,
          sql`${problemSolutions.verificationCount} DESC`,
          sql`${problemSolutions.successCount} DESC`,
          sql`${problemSolutions.failureCount} ASC`,
          sql`${solutions.id} ASC`
        )
        .limit(limit);

      return rows;
    },

    async recordSubmission(args): Promise<{ id: number }> {
      const [row] = await db
        .insert(solutionSubmissions)
        .values({
          source: args.source,
          problemId: args.problemId,
          solutionId: args.solutionId,
          rawProblem: args.rawProblem,
          rawSolution: args.rawSolution,
          metadata: args.metadata,
          judgeResult: args.judgeResult,
        })
        .returning({ id: solutionSubmissions.id });
      // biome-ignore lint/style/noNonNullAssertion: insert returning always yields a row
      return { id: row!.id };
    },
  };
}
