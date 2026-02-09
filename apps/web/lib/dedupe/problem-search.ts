import { applyUnconfirmedMatchPolicy } from "./policy";
import type { DedupeJudge, DedupeStore, EmbeddingProvider } from "./providers";
import { buildProblemEmbeddingText } from "./text";
import { resolveDedupeTuning } from "./tuning";
import type {
  MatchDecision,
  ProblemCandidate,
  ProblemSearchQuery,
  ProblemSolutionSubmission,
  RankedProblemSolution,
} from "./types";

const DEFAULT_PROBLEM_CANDIDATES = 50;
const DEFAULT_RELATED_PROBLEMS = 10;
const DEFAULT_SOLUTIONS_PER_PROBLEM = 5;

export interface ProblemSearchHit {
  problem: ProblemCandidate;
  solutions: RankedProblemSolution[];
  judge?: MatchDecision;
}

export interface ProblemSearchResult {
  query: ProblemSearchQuery;
  exact: ProblemSearchHit | null;
  related: ProblemSearchHit[];
}

export async function searchProblemSolutions(args: {
  query: ProblemSearchQuery;
  store: DedupeStore;
  embeddings: EmbeddingProvider;
  judge?: DedupeJudge;
  strict?: boolean;
  limits?: {
    problemCandidates?: number;
    relatedProblems?: number;
    solutionsPerProblem?: number;
  };
}): Promise<ProblemSearchResult> {
  const strict = args.strict ?? false;
  const query = sanitizeQuery(args.query);
  const tuning = resolveDedupeTuning();

  const problemCandidates =
    args.limits?.problemCandidates ?? DEFAULT_PROBLEM_CANDIDATES;
  const relatedProblems =
    args.limits?.relatedProblems ?? DEFAULT_RELATED_PROBLEMS;
  const solutionsPerProblem =
    args.limits?.solutionsPerProblem ?? DEFAULT_SOLUTIONS_PER_PROBLEM;

  const embeddingText = buildProblemEmbeddingText(query);
  const [embedding] = await args.embeddings.embed([embeddingText]);
  if (!embedding) {
    throw new Error("Embedding provider returned empty embeddings");
  }

  const candidates = await args.store.findSimilarProblems({
    embedding,
    limit: problemCandidates,
    language: query.language,
    framework: query.framework,
  });

  let exactCandidate: ProblemCandidate | null = null;
  let exactJudge: MatchDecision | undefined;

  if (strict && args.judge && candidates.length > 0) {
    const judgedCandidates = selectCandidatesForJudge({
      candidates,
      maxDistance: tuning.problem.judgeMaxDistance,
      maxCandidates: tuning.problem.maxCandidatesToJudge,
    });

    const submission: ProblemSolutionSubmission = {
      problem: query.problem,
      solution: "(not provided)",
      language: query.language,
      framework: query.framework,
      errorSignature: query.errorSignature,
      metadata: query.metadata,
    };

    const judgeDecision = await args.judge.judgeProblemMatch({
      submission,
      candidates: judgedCandidates,
    });
    const effectiveDecision = applyUnconfirmedMatchPolicy({
      judge: judgeDecision,
      candidates,
      acceptUnconfirmedMaxDistance: tuning.problem.acceptUnconfirmedMaxDistance,
    });

    exactJudge = effectiveDecision;

    if (
      effectiveDecision.decision === "same" &&
      effectiveDecision.matchId !== null
    ) {
      exactCandidate =
        candidates.find((c) => c.id === effectiveDecision.matchId) ?? null;
    }
  }

  const relatedCandidates = candidates
    .filter((c) => c.id !== exactCandidate?.id)
    .slice(0, relatedProblems);

  const exact =
    exactCandidate === null
      ? null
      : {
          problem: exactCandidate,
          solutions: await args.store.listSolutionsForProblem({
            problemId: exactCandidate.id,
            limit: solutionsPerProblem,
          }),
          judge: exactJudge,
        };

  const related = await Promise.all(
    relatedCandidates.map(async (problem) => ({
      problem,
      solutions: await args.store.listSolutionsForProblem({
        problemId: problem.id,
        limit: solutionsPerProblem,
      }),
    }))
  );

  return { query, exact, related };
}

function sanitizeQuery(query: ProblemSearchQuery): ProblemSearchQuery {
  const problem = query.problem?.trim() ?? "";

  if (!problem) {
    throw new Error("Missing problem");
  }

  return {
    problem,
    language: query.language?.trim() || undefined,
    framework: query.framework?.trim() || undefined,
    errorSignature: query.errorSignature?.trim() || undefined,
    metadata: query.metadata ?? undefined,
  };
}

function selectCandidatesForJudge<T extends { distance: number }>(args: {
  candidates: T[];
  maxDistance: number;
  maxCandidates: number;
}): T[] {
  const within = args.candidates.filter((c) => c.distance <= args.maxDistance);
  return within.slice(0, args.maxCandidates);
}
