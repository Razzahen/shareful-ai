import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHashEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { createInMemoryDedupeStore } from "@/lib/dedupe/in-memory-store";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { searchProblemSolutions } from "@/lib/dedupe/problem-search";
import type { DedupeJudge } from "@/lib/dedupe/providers";
import { dedupeDataset } from "../fixtures/dedupe-dataset";

function createDatasetJudge(): DedupeJudge {
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
              rationale: "dataset",
            }
          : {
              decision: "new",
              matchId: null,
              confidence: 0,
              rationale: "dataset",
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
              rationale: "dataset",
            }
          : {
              decision: "new",
              matchId: null,
              confidence: 0,
              rationale: "dataset",
            }
      );
    },
  };
}

describe("problem search (in-memory)", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    const keys = [
      "SHAREFUL_DEDUPE_PROBLEM_JUDGE_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_PROBLEM_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_SOLUTION_JUDGE_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_SOLUTION_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
      "SHAREFUL_JUDGE_CONFIRM_MERGES",
    ] as const;

    for (const k of keys) {
      prevEnv[k] = process.env[k];
    }

    // Disable distance-based safety gating for deterministic in-memory tests.
    process.env.SHAREFUL_DEDUPE_PROBLEM_JUDGE_MAX_DISTANCE = "2";
    process.env.SHAREFUL_DEDUPE_PROBLEM_ACCEPT_UNCONFIRMED_MAX_DISTANCE = "2";
    process.env.SHAREFUL_DEDUPE_SOLUTION_JUDGE_MAX_DISTANCE = "2";
    process.env.SHAREFUL_DEDUPE_SOLUTION_ACCEPT_UNCONFIRMED_MAX_DISTANCE = "2";
    process.env.SHAREFUL_JUDGE_CONFIRM_MERGES = "0";
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("returns an exact match (via judge) and ranks solutions by seenCount/score", async () => {
    const store = createInMemoryDedupeStore();
    const embeddings = createHashEmbeddingProvider(128);
    const judge = createDatasetJudge();

    for (const row of dedupeDataset) {
      await ingestProblemSolution({
        submission: {
          problem: row.problem,
          solution: row.solution,
          language: row.language,
          framework: row.framework,
          errorSignature: row.errorSignature,
          metadata: {
            problemGroup: row.problemGroup,
            solutionGroup: row.solutionGroup,
          },
        },
        source: "test",
        store,
        embeddings,
        judge,
      });
    }

    const targetGroup = "nextjs_hydration_window";
    const target = dedupeDataset.find((d) => d.problemGroup === targetGroup);
    expect(target).toBeDefined();
    if (!target) {
      return;
    }

    const expectedBySolutionGroup = new Map<string, number>();
    for (const row of dedupeDataset) {
      if (row.problemGroup !== targetGroup) {
        continue;
      }
      expectedBySolutionGroup.set(
        row.solutionGroup,
        (expectedBySolutionGroup.get(row.solutionGroup) ?? 0) + 1
      );
    }

    let expectedTopGroup: string | null = null;
    let expectedTopCount = -1;
    for (const [solutionGroup, count] of expectedBySolutionGroup.entries()) {
      if (count > expectedTopCount) {
        expectedTopGroup = solutionGroup;
        expectedTopCount = count;
      }
    }

    expect(typeof expectedTopGroup).toBe("string");
    expect(expectedTopCount).toBeGreaterThan(0);

    const result = await searchProblemSolutions({
      query: {
        problem: target.problem,
        language: target.language,
        framework: target.framework,
        errorSignature: target.errorSignature,
        metadata: { problemGroup: targetGroup },
      },
      store,
      embeddings,
      judge,
      strict: true,
      limits: {
        problemCandidates: 50,
        relatedProblems: 10,
        solutionsPerProblem: 10,
      },
    });

    expect(result.exact).not.toBeNull();
    if (!result.exact) {
      return;
    }

    expect(result.exact.problem.metadata?.problemGroup).toBe(targetGroup);
    expect(
      result.related.some((r) => r.problem.id === result.exact?.problem.id)
    ).toBe(false);

    const top = result.exact.solutions[0];
    expect(top).toBeDefined();
    if (!top) {
      return;
    }

    expect(top.metadata?.solutionGroup).toBe(expectedTopGroup);
    expect(top.seenCount).toBe(expectedTopCount);

    // Ensure sorted by score DESC (ties fall back to deterministic ordering).
    for (let i = 1; i < result.exact.solutions.length; i++) {
      const prev = result.exact.solutions[i - 1];
      const cur = result.exact.solutions[i];
      if (!(prev && cur)) {
        continue;
      }
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
    }
  });
});
