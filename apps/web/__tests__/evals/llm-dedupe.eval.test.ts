import { describe, expect, it } from "vitest";
import {
  createConfiguredEmbeddingProvider,
  createHashEmbeddingProvider,
} from "@/lib/dedupe/embeddings";
import { createInMemoryDedupeStore } from "@/lib/dedupe/in-memory-store";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { dedupeDataset } from "../fixtures/dedupe-dataset";

const run = process.env.RUN_LLM_EVAL === "1";
const limitRaw = process.env.LLM_EVAL_LIMIT;
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 0;
const useHashEmbeddings = process.env.LLM_EVAL_EMBED === "hash";

(run ? describe : describe.skip)("LLM dedupe eval (optional)", () => {
  it(
    "clusters exact-replica problems without over-merging",
    { timeout: 1000 * 60 * 10 },
    async () => {
      const store = createInMemoryDedupeStore();
      const embeddings = useHashEmbeddings
        ? createHashEmbeddingProvider(256)
        : createConfiguredEmbeddingProvider();
      const judge = createConfiguredJudge();

      const results: Array<{ truthGroup: string; predictedProblemId: number }> =
        [];

      const rows = limit > 0 ? dedupeDataset.slice(0, limit) : dedupeDataset;

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
          source: "eval",
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
      // No hard thresholds by default; print summary for manual inspection.
      // Add your own thresholds once calibrated for cost/accuracy.
      console.log(JSON.stringify(metrics, null, 2));

      // Sanity check: should not be catastrophically wrong.
      const min = useHashEmbeddings ? 0.5 : 0.7;
      expect(metrics.pairwisePrecision).toBeGreaterThan(min);
      expect(metrics.pairwiseRecall).toBeGreaterThan(min);
    }
  );
});

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
