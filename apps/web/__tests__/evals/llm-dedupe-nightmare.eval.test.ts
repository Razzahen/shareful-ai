import { describe, expect, it } from "vitest";
import {
  createConfiguredEmbeddingProvider,
  createHashEmbeddingProvider,
} from "@/lib/dedupe/embeddings";
import { createInMemoryDedupeStore } from "@/lib/dedupe/in-memory-store";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { dedupeNightmareDataset } from "../fixtures/dedupe-dataset-nightmare";

const run = process.env.RUN_LLM_EVAL === "1";
const limitRaw = process.env.LLM_EVAL_LIMIT;
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 64;
const useHashEmbeddings = process.env.LLM_EVAL_EMBED === "hash";

(run ? describe : describe.skip)("LLM dedupe eval (nightmare dataset)", () => {
  it(
    "clusters exact-replica problems without over-merging",
    { timeout: 1000 * 60 * 20 },
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

      const rows = roundRobinSample(dedupeNightmareDataset, limit);

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
          source: "eval-nightmare",
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
      console.log(
        JSON.stringify({ dataset: "nightmare", ...metrics }, null, 2)
      );

      // Hard requirement for Shareful: false merges are extremely costly.
      const minPrecision = useHashEmbeddings ? 0.78 : 0.95;
      if (
        process.env.LLM_EVAL_DEBUG === "1" ||
        metrics.pairwisePrecision < minPrecision
      ) {
        const clusters = summarizeClusters(results)
          .filter((c) => c.truthGroups.length > 1)
          .slice(0, 12);
        if (clusters.length > 0) {
          console.log(
            JSON.stringify(
              { dataset: "nightmare", mergedClusters: clusters },
              null,
              2
            )
          );
        }
      }
      expect(metrics.pairwisePrecision).toBeGreaterThan(minPrecision);

      // Recall can be lower (conservative judge), but should not be catastrophic.
      const minRecall = useHashEmbeddings ? 0.45 : 0.55;
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

function summarizeClusters(
  rows: Array<{ truthGroup: string; predictedProblemId: number }>
): Array<{
  predictedProblemId: number;
  truthGroups: Array<{ group: string; count: number }>;
}> {
  const byPred = new Map<number, Map<string, number>>();

  for (const row of rows) {
    const existing =
      byPred.get(row.predictedProblemId) ?? new Map<string, number>();
    existing.set(row.truthGroup, (existing.get(row.truthGroup) ?? 0) + 1);
    byPred.set(row.predictedProblemId, existing);
  }

  const clusters: Array<{
    predictedProblemId: number;
    truthGroups: Array<{ group: string; count: number }>;
  }> = [];

  for (const [predictedProblemId, counts] of byPred.entries()) {
    const truthGroups = [...counts.entries()]
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count);
    clusters.push({ predictedProblemId, truthGroups });
  }

  clusters.sort((a, b) => b.truthGroups.length - a.truthGroups.length);
  return clusters;
}
