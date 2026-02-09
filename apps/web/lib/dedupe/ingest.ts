import type { DedupeJudge, DedupeStore, EmbeddingProvider } from "./providers";
import {
  buildProblemEmbeddingText,
  buildSolutionEmbeddingText,
  solutionHash,
} from "./text";
import type {
  IngestResult,
  MatchDecision,
  ProblemSolutionSubmission,
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
    embedding: problemEmbedding,
    limit: problemLimit,
  });

  const solution = await resolveSolution({
    submission,
    store: args.store,
    judge: args.judge,
    problemId: problem.id,
    embedding: solutionEmbedding,
    limit: solutionLimit,
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
        problems: problem.candidates.map((c) => ({
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
  embedding: number[];
  limit: number;
}): Promise<{
  id: number;
  action: "created" | "matched";
  judge: MatchDecision;
  candidates: Awaited<ReturnType<DedupeStore["findSimilarProblems"]>>;
}> {
  const candidates = await args.store.findSimilarProblems({
    embedding: args.embedding,
    limit: args.limit,
  });

  const judge =
    candidates.length > 0
      ? await args.judge.judgeProblemMatch({
          submission: args.submission,
          candidates,
        })
      : newDecision("No candidates");

  if (judge.decision === "same" && judge.matchId !== null) {
    return { id: judge.matchId, action: "matched", judge, candidates };
  }

  const created = await args.store.createProblem({
    canonicalProblem: args.submission.problem,
    language: args.submission.language ?? null,
    framework: args.submission.framework ?? null,
    errorSignature: args.submission.errorSignature ?? null,
    metadata: args.submission.metadata ?? null,
    embedding: args.embedding,
  });

  return { id: created.id, action: "created", judge, candidates };
}

async function resolveSolution(args: {
  submission: ProblemSolutionSubmission;
  store: DedupeStore;
  judge: DedupeJudge;
  problemId: number;
  embedding: number[];
  limit: number;
}): Promise<{
  id: number;
  action: "created" | "matched";
  judge: MatchDecision;
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
    };
  }

  const candidates = await args.store.findSimilarSolutions({
    problemId: args.problemId,
    embedding: args.embedding,
    limit: args.limit,
  });

  const judge =
    candidates.length > 0
      ? await args.judge.judgeSolutionMatch({
          submission: args.submission,
          candidates,
        })
      : newDecision("No candidates");

  if (judge.decision === "same" && judge.matchId !== null) {
    return { id: judge.matchId, action: "matched", judge };
  }

  const created = await args.store.createSolution({
    canonicalSolution: args.submission.solution,
    solutionHash: sHash,
    metadata: args.submission.metadata ?? null,
    embedding: args.embedding,
  });

  return { id: created.id, action: "created", judge };
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
