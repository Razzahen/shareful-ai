import { describe, expect, it } from "vitest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import type {
  ProblemCandidate,
  ProblemSolutionSubmission,
} from "@/lib/dedupe/types";
import { dedupeDataset } from "../fixtures/dedupe-dataset";

const run = process.env.RUN_LLM_EVAL === "1";
const limitRaw = process.env.LLM_JUDGE_EVAL_LIMIT;
const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
const candidatesRaw = process.env.LLM_JUDGE_EVAL_CANDIDATES;
const candidatesPerQuery = candidatesRaw
  ? Number.parseInt(candidatesRaw, 10)
  : 12;
const seedRaw = process.env.LLM_EVAL_SEED;
const seed = seedRaw ? Number.parseInt(seedRaw, 10) : 1337;

(run ? describe : describe.skip)("LLM judge eval (problem exactness)", () => {
  it(
    "matches exact replicas when the correct candidate exists",
    { timeout: 1000 * 60 * 5 },
    async () => {
      const judge = createConfiguredJudge();
      const { candidates, canonicalIdByGroup } = buildCanonicalCandidates();
      const queries = sampleQueries(limit);

      const stats = await runMatchEval({
        judge,
        queries,
        candidates,
        canonicalIdByGroup,
        includeCorrectCandidate: true,
      });

      console.log(JSON.stringify({ mode: "match", ...stats }, null, 2));
      expect(stats.accuracy).toBeGreaterThan(0.8);
    }
  );

  it(
    "refuses to merge when the exact candidate is absent (hard negatives only)",
    { timeout: 1000 * 60 * 5 },
    async () => {
      const judge = createConfiguredJudge();
      const { candidates, canonicalIdByGroup } = buildCanonicalCandidates();
      const queries = sampleQueries(Math.max(10, Math.floor(limit / 2)));

      const stats = await runMatchEval({
        judge,
        queries,
        candidates,
        canonicalIdByGroup,
        includeCorrectCandidate: false,
      });

      console.log(JSON.stringify({ mode: "refuse", ...stats }, null, 2));
      expect(stats.falseMergeRate).toBeLessThan(0.1);
    }
  );
});

function buildCanonicalCandidates(): {
  candidates: ProblemCandidate[];
  canonicalIdByGroup: Map<string, number>;
} {
  const firstByGroup = new Map<string, (typeof dedupeDataset)[number]>();
  for (const row of dedupeDataset) {
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

function sampleQueries(count: number): (typeof dedupeDataset)[number][] {
  const byGroup = new Map<string, (typeof dedupeDataset)[number][]>();
  for (const row of dedupeDataset) {
    const existing = byGroup.get(row.problemGroup) ?? [];
    existing.push(row);
    byGroup.set(row.problemGroup, existing);
  }

  const groups = [...byGroup.keys()].sort();
  const selected: (typeof dedupeDataset)[number][] = [];

  // Round-robin across groups to keep coverage broad.
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
  queries: (typeof dedupeDataset)[number][];
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
  let correct = 0;
  let wrongMatch = 0;
  let falseNew = 0;
  let falseMerge = 0;
  const latencies: number[] = [];

  for (const q of args.queries) {
    const expectedId = args.canonicalIdByGroup.get(q.problemGroup);
    if (!expectedId) {
      continue;
    }

    const candidateSet = pickCandidates({
      query: q,
      allCandidates: args.candidates,
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

function pickCandidates(args: {
  query: (typeof dedupeDataset)[number];
  allCandidates: ProblemCandidate[];
  expectedId: number;
  includeCorrectCandidate: boolean;
  limit: number;
}): ProblemCandidate[] {
  const hardNegatives = args.allCandidates.filter((c) => {
    if (c.id === args.expectedId) {
      return false;
    }
    const cLang = c.language?.toLowerCase();
    const qLang = args.query.language.toLowerCase();
    if (cLang && cLang !== qLang) {
      return false;
    }
    const cFw = c.framework?.toLowerCase() ?? "";
    const qFw = (args.query.framework ?? "").toLowerCase();
    if (qFw && cFw && cFw !== qFw) {
      return false;
    }
    const cErr = (c.errorSignature ?? "").toLowerCase();
    const qErr = (args.query.errorSignature ?? "").toLowerCase();
    if (qErr && cErr && cErr !== qErr) {
      return false;
    }
    return qFw.length > 0 || qErr.length > 0;
  });

  const selected: ProblemCandidate[] = [];
  const used = new Set<number>();

  if (args.includeCorrectCandidate) {
    const correctCandidate = args.allCandidates.find(
      (c) => c.id === args.expectedId
    );
    if (correctCandidate) {
      selected.push(correctCandidate);
      used.add(correctCandidate.id);
    }
  }

  for (const cand of hardNegatives) {
    if (selected.length >= args.limit) {
      break;
    }
    if (used.has(cand.id)) {
      continue;
    }
    selected.push(cand);
    used.add(cand.id);
  }

  const rng = lcg(hashStringToSeed(`${seed}:${args.query.id}`));
  const shuffled = shuffle([...args.allCandidates], rng);
  for (const cand of shuffled) {
    if (selected.length >= args.limit) {
      break;
    }
    if (used.has(cand.id)) {
      continue;
    }
    if (!args.includeCorrectCandidate && cand.id === args.expectedId) {
      continue;
    }
    selected.push(cand);
    used.add(cand.id);
  }

  return selected.slice(0, args.limit);
}

type Rng = () => number;

function lcg(seedValue: number): Rng {
  let state = seedValue;
  return () => {
    // Deterministic RNG without bitwise ops (LCG / Lehmer-style).
    state = (state * 48_271) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j] as T;
    items[j] = tmp as T;
  }
  return items;
}

function hashStringToSeed(input: string): number {
  let hash = 7;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2_147_483_647;
  }
  return Math.max(1, hash);
}
