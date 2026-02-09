import { applyUnconfirmedMatchPolicy } from "./policy";
import type { DedupeJudge, DedupeStore, EmbeddingProvider } from "./providers";
import {
  buildProblemEmbeddingText,
  buildSolutionEmbeddingText,
  solutionHash,
} from "./text";
import { resolveDedupeTuning } from "./tuning";
import type {
  IngestResult,
  MatchDecision,
  ProblemCandidate,
  ProblemSolutionSubmission,
  SolutionCandidate,
} from "./types";

const DEFAULT_PROBLEM_CANDIDATES = 50;
const DEFAULT_SOLUTION_CANDIDATES = 20;

function newDecision(rationale: string): MatchDecision {
  return { decision: "new", matchId: null, confidence: 0, rationale };
}

export async function ingestProblemSolution(args: {
  submission: ProblemSolutionSubmission;
  source?: string;
  store: DedupeStore;
  embeddings: EmbeddingProvider;
  judge: DedupeJudge;
  limits?: { problemCandidates?: number; solutionCandidates?: number };
}): Promise<IngestResult> {
  const source = args.source ?? "skill";
  const submission = sanitizeSubmission(args.submission);
  const tuning = resolveDedupeTuning();

  const problemLimit =
    args.limits?.problemCandidates ?? DEFAULT_PROBLEM_CANDIDATES;
  const solutionLimit =
    args.limits?.solutionCandidates ?? DEFAULT_SOLUTION_CANDIDATES;

  const { problemEmbedding, solutionEmbedding } = await embedSubmission({
    embeddings: args.embeddings,
    submission,
  });

  const problem = await resolveProblem({
    submission,
    store: args.store,
    judge: args.judge,
    problemEmbedding,
    solutionEmbedding,
    limit: problemLimit,
    tuning,
  });

  const solution = await resolveSolution({
    submission,
    store: args.store,
    judge: args.judge,
    problemId: problem.id,
    embedding: solutionEmbedding,
    limit: solutionLimit,
    tuning,
  });

  const link = await args.store.upsertProblemSolutionLink({
    problemId: problem.id,
    solutionId: solution.id,
  });

  const submissionRecord = await args.store.recordSubmission({
    source,
    problemId: problem.id,
    solutionId: solution.id,
    rawProblem: submission.problem,
    rawSolution: submission.solution,
    metadata: submission.metadata ?? null,
    judgeResult: {
      problem: problem.judge,
      solution: solution.judge,
      candidates: {
        problems: problem.candidates.all.map((c) => ({
          id: c.id,
          distance: c.distance,
        })),
        problemsJudged: problem.candidates.judged.map((c) => ({
          id: c.id,
          distance: c.distance,
        })),
        solutions: solution.candidates.all.map((c) => ({
          id: c.id,
          distance: c.distance,
        })),
        solutionsJudged: solution.candidates.judged.map((c) => ({
          id: c.id,
          distance: c.distance,
        })),
      },
    },
  });

  return {
    submissionId: submissionRecord.id,
    problem: { id: problem.id, action: problem.action, judge: problem.judge },
    solution: {
      id: solution.id,
      action: solution.action,
      judge: solution.judge,
    },
    link: {
      problemId: problem.id,
      solutionId: solution.id,
      action: link.action,
      seenCount: link.seenCount,
    },
  };
}

async function embedSubmission(args: {
  embeddings: EmbeddingProvider;
  submission: ProblemSolutionSubmission;
}): Promise<{ problemEmbedding: number[]; solutionEmbedding: number[] }> {
  const problemText = buildProblemEmbeddingText(args.submission);
  const solutionText = buildSolutionEmbeddingText(args.submission);

  const [problemEmbedding, solutionEmbedding] = await args.embeddings.embed([
    problemText,
    solutionText,
  ]);

  if (!(problemEmbedding && solutionEmbedding)) {
    throw new Error("Embedding provider returned empty embeddings");
  }

  return { problemEmbedding, solutionEmbedding };
}

async function resolveProblem(args: {
  submission: ProblemSolutionSubmission;
  store: DedupeStore;
  judge: DedupeJudge;
  problemEmbedding: number[];
  solutionEmbedding: number[];
  limit: number;
  tuning: ReturnType<typeof resolveDedupeTuning>;
}): Promise<{
  id: number;
  action: "created" | "matched";
  judge: MatchDecision;
  candidates: { all: ProblemCandidate[]; judged: ProblemCandidate[] };
}> {
  const baseCandidates = await args.store.findSimilarProblems({
    embedding: args.problemEmbedding,
    limit: args.limit,
    language: args.submission.language,
    framework: args.submission.framework,
  });

  const derivedCandidates = args.tuning.retrieval
    .useSolutionDerivedProblemCandidates
    ? await args.store.findSimilarProblemsViaSolutions({
        problemEmbedding: args.problemEmbedding,
        solutionEmbedding: args.solutionEmbedding,
        limitSolutions: args.tuning.retrieval.solutionDerivedLimitSolutions,
        limitProblems: args.tuning.retrieval.solutionDerivedLimitProblems,
        language: args.submission.language,
        framework: args.submission.framework,
      })
    : [];

  const mergedCandidates = mergeCandidatesById([
    ...baseCandidates,
    ...derivedCandidates,
  ])
    .sort((a, b) => a.distance - b.distance)
    .slice(0, args.limit);

  const judgedCandidates = selectCandidatesForJudge({
    candidates: mergedCandidates,
    maxDistance: args.tuning.problem.judgeMaxDistance,
    maxCandidates: args.tuning.problem.maxCandidatesToJudge,
  });

  const judge = await safeJudgeProblem({
    judge: args.judge,
    submission: args.submission,
    candidates: judgedCandidates,
  });

  const effectiveJudge = applyUnconfirmedMatchPolicy({
    judge,
    candidates: mergedCandidates,
    acceptUnconfirmedMaxDistance:
      args.tuning.problem.acceptUnconfirmedMaxDistance,
  });

  if (effectiveJudge.decision === "same" && effectiveJudge.matchId !== null) {
    return {
      id: effectiveJudge.matchId,
      action: "matched",
      judge: effectiveJudge,
      candidates: { all: mergedCandidates, judged: judgedCandidates },
    };
  }

  const created = await args.store.createProblem({
    canonicalProblem: args.submission.problem,
    language: args.submission.language ?? null,
    framework: args.submission.framework ?? null,
    errorSignature: args.submission.errorSignature ?? null,
    metadata: args.submission.metadata ?? null,
    embedding: args.problemEmbedding,
  });

  return {
    id: created.id,
    action: "created",
    judge: effectiveJudge,
    candidates: { all: mergedCandidates, judged: judgedCandidates },
  };
}

async function resolveSolution(args: {
  submission: ProblemSolutionSubmission;
  store: DedupeStore;
  judge: DedupeJudge;
  problemId: number;
  embedding: number[];
  limit: number;
  tuning: ReturnType<typeof resolveDedupeTuning>;
}): Promise<{
  id: number;
  action: "created" | "matched";
  judge: MatchDecision;
  candidates: { all: SolutionCandidate[]; judged: SolutionCandidate[] };
}> {
  const sHash = solutionHash(args.submission.solution);

  const existingByHash = await args.store.findSolutionByHash({
    solutionHash: sHash,
  });

  if (existingByHash) {
    return {
      id: existingByHash.id,
      action: "matched",
      judge: {
        decision: "same",
        matchId: existingByHash.id,
        confidence: 1,
        rationale: "Exact hash match",
      },
      candidates: { all: [], judged: [] },
    };
  }

  const local = await args.store.findSimilarSolutions({
    problemId: args.problemId,
    embedding: args.embedding,
    limit: Math.min(args.limit, args.tuning.solution.localCandidates),
  });

  const global = await args.store.findSimilarSolutionsGlobal({
    embedding: args.embedding,
    limit: Math.min(args.limit, args.tuning.solution.globalCandidates),
  });

  const mergedCandidates = mergeSolutionCandidatesById([...local, ...global])
    .sort((a, b) => a.distance - b.distance)
    .slice(0, args.limit);

  const judgedCandidates = selectCandidatesForJudge({
    candidates: mergedCandidates,
    maxDistance: args.tuning.solution.judgeMaxDistance,
    maxCandidates: args.tuning.solution.maxCandidatesToJudge,
  });

  const judge = await safeJudgeSolution({
    judge: args.judge,
    submission: args.submission,
    candidates: judgedCandidates,
  });

  const effectiveJudge = applyUnconfirmedMatchPolicy({
    judge,
    candidates: mergedCandidates,
    acceptUnconfirmedMaxDistance:
      args.tuning.solution.acceptUnconfirmedMaxDistance,
  });

  if (effectiveJudge.decision === "same" && effectiveJudge.matchId !== null) {
    return {
      id: effectiveJudge.matchId,
      action: "matched",
      judge: effectiveJudge,
      candidates: { all: mergedCandidates, judged: judgedCandidates },
    };
  }

  const created = await args.store.createSolution({
    canonicalSolution: args.submission.solution,
    solutionHash: sHash,
    metadata: args.submission.metadata ?? null,
    embedding: args.embedding,
  });

  return {
    id: created.id,
    action: "created",
    judge: effectiveJudge,
    candidates: { all: mergedCandidates, judged: judgedCandidates },
  };
}

function sanitizeSubmission(
  submission: ProblemSolutionSubmission
): ProblemSolutionSubmission {
  const problem = submission.problem?.trim() ?? "";
  const solution = submission.solution?.trim() ?? "";

  if (!problem) {
    throw new Error("Missing problem");
  }
  if (!solution) {
    throw new Error("Missing solution");
  }

  return {
    problem,
    solution,
    language: submission.language?.trim() || undefined,
    framework: submission.framework?.trim() || undefined,
    errorSignature: submission.errorSignature?.trim() || undefined,
    metadata: submission.metadata ?? undefined,
  };
}

function mergeCandidatesById(
  candidates: ProblemCandidate[]
): ProblemCandidate[] {
  const byId = new Map<number, ProblemCandidate>();
  for (const cand of candidates) {
    const existing = byId.get(cand.id);
    if (!existing || cand.distance < existing.distance) {
      byId.set(cand.id, cand);
    }
  }
  return [...byId.values()];
}

function mergeSolutionCandidatesById(
  candidates: SolutionCandidate[]
): SolutionCandidate[] {
  const byId = new Map<number, SolutionCandidate>();
  for (const cand of candidates) {
    const existing = byId.get(cand.id);
    if (!existing || cand.distance < existing.distance) {
      byId.set(cand.id, cand);
    }
  }
  return [...byId.values()];
}

function selectCandidatesForJudge<T extends { distance: number }>(args: {
  candidates: T[];
  maxDistance: number;
  maxCandidates: number;
}): T[] {
  const within = args.candidates.filter((c) => c.distance <= args.maxDistance);
  return within.slice(0, args.maxCandidates);
}

async function safeJudgeProblem(args: {
  judge: DedupeJudge;
  submission: ProblemSolutionSubmission;
  candidates: ProblemCandidate[];
}): Promise<MatchDecision> {
  if (args.candidates.length === 0) {
    return newDecision("No candidates within distance threshold");
  }

  try {
    return await args.judge.judgeProblemMatch({
      submission: args.submission,
      candidates: args.candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return newDecision(`Judge failed (problem): ${message.slice(0, 200)}`);
  }
}

async function safeJudgeSolution(args: {
  judge: DedupeJudge;
  submission: ProblemSolutionSubmission;
  candidates: SolutionCandidate[];
}): Promise<MatchDecision> {
  if (args.candidates.length === 0) {
    return newDecision("No candidates within distance threshold");
  }

  try {
    return await args.judge.judgeSolutionMatch({
      submission: args.submission,
      candidates: args.candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return newDecision(`Judge failed (solution): ${message.slice(0, 200)}`);
  }
}
