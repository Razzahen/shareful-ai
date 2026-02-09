import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { createHashEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { searchProblemSolutions } from "@/lib/dedupe/problem-search";
import type { DedupeJudge } from "@/lib/dedupe/providers";
import { createDrizzleDedupeStore } from "@/lib/dedupe/store";

const run = process.env.RUN_DB_SMOKE === "1";
const NEWLINE_SPLIT_REGEX = /\r?\n/;

(run ? describe : describe.skip)("canonical dedupe DB smoke", () => {
  it(
    "ingests, increments seenCount, and can search via pgvector",
    { timeout: 1000 * 60 * 2 },
    async () => {
      // Load Vercel-pulled env vars without committing secrets.
      loadDotEnvLikeFile(`${process.cwd()}/.env.development.local`);

      const dbUrl =
        process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
      expect(dbUrl.length).toBeGreaterThan(0);

      const testRunId = `db-smoke-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

      // Make sure the strings are unique so we never collide with real data.
      const problemText = `DB smoke test (${testRunId}): Node throws ReferenceError: require is not defined in ES module scope after setting type=module.`;
      const solutionText = `DB smoke test (${testRunId}): Rename the script to .cjs or remove type=module.`;

      const store = createDrizzleDedupeStore();
      const embeddings = createHashEmbeddingProvider(1536);
      const judge = createMetadataJudge();

      const sql = neon(dbUrl);

      try {
        const first = await ingestProblemSolution({
          submission: {
            problem: problemText,
            solution: solutionText,
            language: "javascript",
            framework: "node",
            errorSignature:
              "ReferenceError: require is not defined in ES module scope",
            metadata: { testRunId, problemGroup: "p1", solutionGroup: "s1" },
          },
          source: "db-smoke",
          store,
          embeddings,
          judge,
        });

        expect(first.problem.action).toBe("created");
        expect(first.solution.action).toBe("created");
        expect(first.link.action).toBe("created");
        expect(first.link.seenCount).toBe(1);

        const second = await ingestProblemSolution({
          submission: {
            problem: problemText,
            solution: solutionText,
            language: "javascript",
            framework: "node",
            errorSignature:
              "ReferenceError: require is not defined in ES module scope",
            metadata: { testRunId, problemGroup: "p1", solutionGroup: "s1" },
          },
          source: "db-smoke",
          store,
          embeddings,
          judge,
        });

        expect(second.problem.action).toBe("matched");
        expect(second.problem.id).toBe(first.problem.id);
        expect(second.solution.action).toBe("matched");
        expect(second.solution.id).toBe(first.solution.id);
        expect(second.link.action).toBe("incremented");
        expect(second.link.seenCount).toBe(2);

        const search = await searchProblemSolutions({
          query: {
            problem: problemText,
            language: "javascript",
            framework: "node",
            errorSignature:
              "ReferenceError: require is not defined in ES module scope",
            metadata: { testRunId, problemGroup: "p1" },
          },
          store,
          embeddings,
          judge,
          strict: true,
          limits: {
            problemCandidates: 20,
            relatedProblems: 5,
            solutionsPerProblem: 5,
          },
        });

        expect(search.exact).not.toBeNull();
        expect(search.exact?.problem.id).toBe(first.problem.id);
        expect(search.exact?.solutions[0]?.seenCount).toBe(2);
      } finally {
        // Cleanup: remove everything we created (best-effort).
        // We include testRunId in metadata so this won't delete unrelated rows.
        await sql`DELETE FROM solution_submissions WHERE metadata->>'testRunId' = ${testRunId}`;
        await sql`DELETE FROM problems WHERE metadata->>'testRunId' = ${testRunId}`;
        await sql`DELETE FROM solutions WHERE metadata->>'testRunId' = ${testRunId}`;
      }
    }
  );
});

function createMetadataJudge(): DedupeJudge {
  return {
    judgeProblemMatch({ submission, candidates }) {
      const group =
        (submission.metadata?.problemGroup as string | undefined) ?? "";
      const match = candidates.find(
        (c) => (c.metadata?.problemGroup as string | undefined) === group
      );
      return Promise.resolve(
        match
          ? {
              decision: "same",
              matchId: match.id,
              confidence: 1,
              rationale: "db-smoke metadata match",
            }
          : {
              decision: "new",
              matchId: null,
              confidence: 0,
              rationale: "db-smoke no match",
            }
      );
    },
    judgeSolutionMatch({ submission, candidates }) {
      const group =
        (submission.metadata?.solutionGroup as string | undefined) ?? "";
      const match = candidates.find(
        (c) => (c.metadata?.solutionGroup as string | undefined) === group
      );
      return Promise.resolve(
        match
          ? {
              decision: "same",
              matchId: match.id,
              confidence: 1,
              rationale: "db-smoke metadata match",
            }
          : {
              decision: "new",
              matchId: null,
              confidence: 0,
              rationale: "db-smoke no match",
            }
      );
    },
  };
}

function loadDotEnvLikeFile(path: string): void {
  if (!fs.existsSync(path)) {
    return;
  }

  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(NEWLINE_SPLIT_REGEX)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx === -1) {
      continue;
    }

    const key = trimmed.slice(0, idx);
    let value = trimmed.slice(idx + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Don't override env vars explicitly set by the runner.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
