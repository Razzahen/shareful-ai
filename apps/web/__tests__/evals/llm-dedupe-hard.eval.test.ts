import { describe, expect, it } from "vitest";
import {
  createConfiguredEmbeddingProvider,
  createHashEmbeddingProvider,
} from "@/lib/dedupe/embeddings";
import { createInMemoryDedupeStore } from "@/lib/dedupe/in-memory-store";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { dedupeHardDataset } from "../fixtures/dedupe-dataset-hard";

const run = process.env.RUN_LLM_EVAL === "1";
const limitRaw = process.env.LLM_EVAL_LIMIT;
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 40;
const useHashEmbeddings = process.env.LLM_EVAL_EMBED === "hash";

(run ? describe : describe.skip)("LLM dedupe eval (hard dataset)", () => {
  it(
    "clusters exact-replica problems without over-merging",
    { timeout: 1000 * 60 * 15 },
    async () => {
      const store = createInMemoryDedupeStore();
      const embeddings = useHashEmbeddings
        ? createHashEmbeddingProvider(256)
        : createConfiguredEmbeddingProvider();
      const judge = createConfiguredJudge();

      const results: Array<{
        truthGroup: string;
        predictedProblemId: number;
      }> = [];

      const rows = roundRobinSample(dedupeHardDataset, limit);

      for (const row of rows) {
        const r = await ingestProblemSolution({
          submission: {
            problem: row.problem,
            solution: row.solution,
            language: row.language,
            framework: row.framework,
            errorSignature: row.errorSignature,
            // Do NOT pass ground-truth group ids to the model.
            metadata: undefined,
          },
          source: "eval-hard",
          store,
          embeddings,
          judge,
        });

        results.push({
          truthGroup: row.problemGroup,
          predictedProblemId: r.problem.id,
        });
      }

      const metrics = pairwiseMetrics(results);
      console.log(JSON.stringify({ dataset: "hard", ...metrics }, null, 2));

      // Hard requirement for Shareful: false merges are extremely costly.
      const minPrecision = useHashEmbeddings ? 0.8 : 0.95;
      expect(metrics.pairwisePrecision).toBeGreaterThan(minPrecision);

      // Recall can be lower (conservative judge), but should not be catastrophic.
      const minRecall = useHashEmbeddings ? 0.5 : 0.6;
      expect(metrics.pairwiseRecall).toBeGreaterThan(minRecall);
    }
  );
});

function roundRobinSample<T extends { problemGroup: string }>(
  dataset: T[],
  count: number
): T[] {
  const byGroup = new Map<string, T[]>();
  for (const row of dataset) {
    const existing = byGroup.get(row.problemGroup) ?? [];
    existing.push(row);
    byGroup.set(row.problemGroup, existing);
  }

  const groups = [...byGroup.keys()].sort();
  const selected: T[] = [];

  while (selected.length < count && groups.length > 0) {
    for (const g of groups) {
      const rows = byGroup.get(g) ?? [];
      const item = rows[selected.length % rows.length];
      if (!item) {
        continue;
      }
      selected.push(item);
      if (selected.length >= count) {
        break;
      }
    }
  }

  return selected.slice(0, count);
}

function pairwiseMetrics(
  rows: Array<{ truthGroup: string; predictedProblemId: number }>
) {
  let trueSame = 0;
  let predSame = 0;
  let correctSame = 0;

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (!(a && b)) {
        continue;
      }
      const truth = a.truthGroup === b.truthGroup;
      const pred = a.predictedProblemId === b.predictedProblemId;
      if (truth) {
        trueSame++;
      }
      if (pred) {
        predSame++;
      }
      if (truth && pred) {
        correctSame++;
      }
    }
  }

  const pairwisePrecision = predSame > 0 ? correctSame / predSame : 0;
  const pairwiseRecall = trueSame > 0 ? correctSame / trueSame : 0;
  const f1 =
    pairwisePrecision + pairwiseRecall > 0
      ? (2 * pairwisePrecision * pairwiseRecall) /
        (pairwisePrecision + pairwiseRecall)
      : 0;

  return {
    pairwisePrecision,
    pairwiseRecall,
    f1,
    trueSame,
    predSame,
    correctSame,
  };
}
