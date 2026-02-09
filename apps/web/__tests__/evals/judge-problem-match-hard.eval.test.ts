import { describe, expect, it } from "vitest";
import { createConfiguredEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { buildProblemEmbeddingText } from "@/lib/dedupe/text";
import type {
  ProblemCandidate,
  ProblemSolutionSubmission,
} from "@/lib/dedupe/types";
import { dedupeHardDataset } from "../fixtures/dedupe-dataset-hard";

const run = process.env.RUN_LLM_EVAL === "1";
const limitRaw = process.env.LLM_JUDGE_EVAL_LIMIT;
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 24;
const candidatesRaw = process.env.LLM_JUDGE_EVAL_CANDIDATES;
const candidatesPerQuery = candidatesRaw
  ? Number.parseInt(candidatesRaw, 10)
  : 14;

(run ? describe : describe.skip)("LLM judge eval (hard dataset)", () => {
  it(
    "matches exact replicas when the correct candidate exists",
    { timeout: 1000 * 60 * 10 },
    async () => {
      const judge = createConfiguredJudge();
      const embeddings = createConfiguredEmbeddingProvider();
      const { candidates, canonicalIdByGroup } = buildCanonicalCandidates();
      const queries = sampleQueries(limit);

      const stats = await runMatchEval({
        judge,
        embeddings,
        queries,
        candidates,
        canonicalIdByGroup,
        includeCorrectCandidate: true,
      });

      console.log(
        JSON.stringify({ dataset: "hard", mode: "match", ...stats }, null, 2)
      );
      // Conservative threshold: we care more about false merges than recall.
      expect(stats.falseMergeRate).toBeLessThan(0.05);
      expect(stats.accuracy).toBeGreaterThan(0.75);
    }
  );

  it(
    "refuses to merge when the exact candidate is absent (hard negatives only)",
    { timeout: 1000 * 60 * 10 },
    async () => {
      const judge = createConfiguredJudge();
      const embeddings = createConfiguredEmbeddingProvider();
      const { candidates, canonicalIdByGroup } = buildCanonicalCandidates();
      const queries = sampleQueries(Math.max(12, Math.floor(limit / 2)));

      const stats = await runMatchEval({
        judge,
        embeddings,
        queries,
        candidates,
        canonicalIdByGroup,
        includeCorrectCandidate: false,
      });

      console.log(
        JSON.stringify({ dataset: "hard", mode: "refuse", ...stats }, null, 2)
      );
      // This is the critical metric: never merge when the correct candidate is absent.
      expect(stats.falseMergeRate).toBeLessThan(0.05);
    }
  );
});

function buildCanonicalCandidates(): {
  candidates: ProblemCandidate[];
  canonicalIdByGroup: Map<string, number>;
} {
  const firstByGroup = new Map<string, (typeof dedupeHardDataset)[number]>();
  for (const row of dedupeHardDataset) {
    if (!firstByGroup.has(row.problemGroup)) {
      firstByGroup.set(row.problemGroup, row);
    }
  }

  let nextId = 1;
  const candidates: ProblemCandidate[] = [];
  const canonicalIdByGroup = new Map<string, number>();

  for (const [group, row] of firstByGroup.entries()) {
    const id = nextId++;
    canonicalIdByGroup.set(group, id);
    candidates.push({
      id,
      canonicalProblem: row.problem,
      language: row.language,
      framework: row.framework ?? null,
      errorSignature: row.errorSignature ?? null,
      metadata: { problemGroup: group },
      distance: 0,
    });
  }

  return { candidates, canonicalIdByGroup };
}

function sampleQueries(count: number): (typeof dedupeHardDataset)[number][] {
  const byGroup = new Map<string, (typeof dedupeHardDataset)[number][]>();
  for (const row of dedupeHardDataset) {
    const existing = byGroup.get(row.problemGroup) ?? [];
    existing.push(row);
    byGroup.set(row.problemGroup, existing);
  }

  const groups = [...byGroup.keys()].sort();
  const selected: (typeof dedupeHardDataset)[number][] = [];

  // Round-robin across groups to maximize hard negative exposure.
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

async function runMatchEval(args: {
  judge: ReturnType<typeof createConfiguredJudge>;
  embeddings: ReturnType<typeof createConfiguredEmbeddingProvider>;
  queries: (typeof dedupeHardDataset)[number][];
  candidates: ProblemCandidate[];
  canonicalIdByGroup: Map<string, number>;
  includeCorrectCandidate: boolean;
}): Promise<{
  total: number;
  accuracy: number;
  correct: number;
  wrongMatch: number;
  falseNew: number;
  falseMergeRate: number;
  avgLatencyMs: number;
}> {
  const candidateEmbeddingTexts = args.candidates.map((c) =>
    buildProblemEmbeddingText({
      problem: c.canonicalProblem,
      language: c.language ?? undefined,
      framework: c.framework ?? undefined,
      errorSignature: c.errorSignature ?? undefined,
    })
  );
  const candidateEmbeddings = await args.embeddings.embed(
    candidateEmbeddingTexts
  );
  const candidateEmbeddingById = new Map<number, number[]>();
  for (let i = 0; i < args.candidates.length; i++) {
    const cand = args.candidates[i];
    const emb = candidateEmbeddings[i];
    if (!(cand && emb)) {
      continue;
    }
    candidateEmbeddingById.set(cand.id, emb);
  }

  const queryEmbeddingTexts = args.queries.map((q) =>
    buildProblemEmbeddingText({
      problem: q.problem,
      language: q.language,
      framework: q.framework,
      errorSignature: q.errorSignature,
    })
  );
  const queryEmbeddings = await args.embeddings.embed(queryEmbeddingTexts);

  let correct = 0;
  let wrongMatch = 0;
  let falseNew = 0;
  let falseMerge = 0;
  const latencies: number[] = [];

  for (let idx = 0; idx < args.queries.length; idx++) {
    const q = args.queries[idx];
    const qEmbedding = queryEmbeddings[idx];
    if (!(q && qEmbedding)) {
      continue;
    }

    const expectedId = args.canonicalIdByGroup.get(q.problemGroup);
    if (!expectedId) {
      continue;
    }

    const candidateSet = pickCandidatesByEmbeddingDistance({
      query: q,
      queryEmbedding: qEmbedding,
      allCandidates: args.candidates,
      candidateEmbeddingById,
      expectedId,
      includeCorrectCandidate: args.includeCorrectCandidate,
      limit: candidatesPerQuery,
    });

    const submission: ProblemSolutionSubmission = {
      problem: q.problem,
      solution: "(not provided)",
      language: q.language,
      framework: q.framework,
      errorSignature: q.errorSignature,
      metadata: undefined,
    };

    const started = performance.now();
    const decision = await args.judge.judgeProblemMatch({
      submission,
      candidates: candidateSet,
    });
    latencies.push(performance.now() - started);

    if (args.includeCorrectCandidate) {
      if (decision.decision === "same" && decision.matchId === expectedId) {
        correct++;
        continue;
      }

      if (decision.decision === "same" && decision.matchId !== expectedId) {
        wrongMatch++;
      } else {
        falseNew++;
      }
    } else if (decision.decision === "same") {
      falseMerge++;
    } else {
      correct++;
    }
  }

  const total = correct + wrongMatch + falseNew + falseMerge;
  const accuracy = total > 0 ? correct / total : 0;
  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length
      : 0;

  const falseMergeRate = total > 0 ? falseMerge / total : 0;

  return {
    total,
    accuracy,
    correct,
    wrongMatch,
    falseNew,
    falseMergeRate,
    avgLatencyMs,
  };
}

function pickCandidatesByEmbeddingDistance(args: {
  query: (typeof dedupeHardDataset)[number];
  queryEmbedding: number[];
  allCandidates: ProblemCandidate[];
  candidateEmbeddingById: Map<number, number[]>;
  expectedId: number;
  includeCorrectCandidate: boolean;
  limit: number;
}): ProblemCandidate[] {
  const scored: ProblemCandidate[] = [];

  for (const base of args.allCandidates) {
    // Mimic store filtering (language/framework only).
    const qLang = args.query.language.toLowerCase();
    const cLang = base.language?.toLowerCase() ?? "";
    if (cLang && cLang !== qLang) {
      continue;
    }

    const qFw = (args.query.framework ?? "").toLowerCase();
    const cFw = base.framework?.toLowerCase() ?? "";
    if (qFw && cFw && cFw !== qFw) {
      continue;
    }

    const cEmbedding = args.candidateEmbeddingById.get(base.id);
    if (!cEmbedding) {
      continue;
    }

    const distance = cosineDistance(cEmbedding, args.queryEmbedding);
    scored.push({ ...base, distance });
  }

  scored.sort((a, b) => a.distance - b.distance);

  const selected: ProblemCandidate[] = [];
  const used = new Set<number>();

  for (const cand of scored) {
    if (selected.length >= args.limit) {
      break;
    }
    if (!args.includeCorrectCandidate && cand.id === args.expectedId) {
      continue;
    }
    selected.push(cand);
    used.add(cand.id);
  }

  // Ensure the correct candidate is present for match-mode, even if it wasn't in the top-N.
  if (args.includeCorrectCandidate && !used.has(args.expectedId)) {
    const correct = scored.find((c) => c.id === args.expectedId);
    if (!correct) {
      return selected;
    }

    if (selected.length < args.limit) {
      selected.push(correct);
    } else if (selected.length > 0) {
      // Replace the weakest candidate so match-mode always includes the ground-truth option.
      selected[selected.length - 1] = correct;
    }
    used.add(correct.id);
  }

  return selected;
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 1;
  }
  const len = Math.min(a.length, b.length);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 1;
  }

  const cos = dot / denom;
  return 1 - cos;
}
