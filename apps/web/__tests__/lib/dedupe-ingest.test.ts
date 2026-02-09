import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHashEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { createInMemoryDedupeStore } from "@/lib/dedupe/in-memory-store";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
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

describe("dedupe ingest (in-memory)", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    const keys = [
      "SHAREFUL_DEDUPE_PROBLEM_JUDGE_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_SOLUTION_JUDGE_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_PROBLEM_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
      "SHAREFUL_DEDUPE_SOLUTION_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
      "SHAREFUL_JUDGE_CONFIRM_MERGES",
    ] as const;

    for (const k of keys) {
      prevEnv[k] = process.env[k];
    }

    // Disable distance-based safety gating for deterministic in-memory tests.
    process.env.SHAREFUL_DEDUPE_PROBLEM_JUDGE_MAX_DISTANCE = "2";
    process.env.SHAREFUL_DEDUPE_SOLUTION_JUDGE_MAX_DISTANCE = "2";
    process.env.SHAREFUL_DEDUPE_PROBLEM_ACCEPT_UNCONFIRMED_MAX_DISTANCE = "2";
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

  it("creates one canonical problem per problemGroup and increments seenCount per (problem, solution) pair", async () => {
    const store = createInMemoryDedupeStore();
    const embeddings = createHashEmbeddingProvider(128);
    const judge = createDatasetJudge();

    const results: Awaited<ReturnType<typeof ingestProblemSolution>>[] = [];
    for (const row of dedupeDataset) {
      results.push(
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
        })
      );
    }

    // 1) Problem grouping should be stable.
    const groups = new Set(dedupeDataset.map((d) => d.problemGroup));
    const dump = store.dump();
    expect(dump.problems).toHaveLength(groups.size);

    const problemGroupById = new Map<number, string>();
    for (const p of dump.problems) {
      const g = p.metadata?.problemGroup;
      expect(typeof g).toBe("string");
      problemGroupById.set(p.id, g as string);
    }

    // 2) Each dataset item should map to its group problem id.
    const expectedProblemIdByGroup = new Map<string, number>();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const row = dedupeDataset[i];
      if (!row) {
        continue;
      }

      const group = problemGroupById.get(r.problem.id);
      expect(group).toBe(row.problemGroup);
      if (!group) {
        continue;
      }
      const existing = expectedProblemIdByGroup.get(group);
      if (existing) {
        expect(r.problem.id).toBe(existing);
      } else {
        expectedProblemIdByGroup.set(group, r.problem.id);
      }
    }

    // 3) Link seenCount should equal number of ingests for each (problemGroup, solutionGroup) pair.
    const expectedCounts = new Map<string, number>();
    for (const row of dedupeDataset) {
      const key = `${row.problemGroup}::${row.solutionGroup}`;
      expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
    }

    const solutionGroupById = new Map<number, string>();
    for (const s of dump.solutions) {
      const g = s.metadata?.solutionGroup;
      expect(typeof g).toBe("string");
      solutionGroupById.set(s.id, g as string);
    }

    const actualCounts = new Map<string, number>();
    for (const link of dump.links) {
      const pg = problemGroupById.get(link.problemId);
      const sg = solutionGroupById.get(link.solutionId);
      expect(pg).toBeDefined();
      expect(sg).toBeDefined();
      if (!(pg && sg)) {
        continue;
      }
      actualCounts.set(`${pg}::${sg}`, link.seenCount);
    }

    for (const [key, expected] of expectedCounts.entries()) {
      expect(actualCounts.get(key)).toBe(expected);
    }
  });
});
