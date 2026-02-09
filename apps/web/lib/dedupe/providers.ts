import type {
  MatchDecision,
  ProblemCandidate,
  ProblemSolutionSubmission,
  RankedProblemSolution,
  SolutionCandidate,
} from "./types";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface DedupeJudge {
  judgeProblemMatch(args: {
    submission: ProblemSolutionSubmission;
    candidates: ProblemCandidate[];
  }): Promise<MatchDecision>;

  judgeSolutionMatch(args: {
    submission: ProblemSolutionSubmission;
    candidates: SolutionCandidate[];
  }): Promise<MatchDecision>;
}

export interface DedupeStore {
  findSimilarProblems(args: {
    embedding: number[];
    limit: number;
    language?: string;
    framework?: string;
  }): Promise<ProblemCandidate[]>;

  createProblem(args: {
    canonicalProblem: string;
    language: string | null;
    framework: string | null;
    errorSignature: string | null;
    metadata: Record<string, unknown> | null;
    embedding: number[];
  }): Promise<{ id: number }>;

  findSolutionByHash(args: {
    solutionHash: string;
  }): Promise<{ id: number } | null>;

  findSimilarSolutions(args: {
    problemId: number;
    embedding: number[];
    limit: number;
  }): Promise<SolutionCandidate[]>;

  createSolution(args: {
    canonicalSolution: string;
    solutionHash: string;
    metadata: Record<string, unknown> | null;
    embedding: number[];
  }): Promise<{ id: number }>;

  upsertProblemSolutionLink(args: {
    problemId: number;
    solutionId: number;
  }): Promise<{ action: "created" | "incremented"; seenCount: number }>;

  listSolutionsForProblem(args: {
    problemId: number;
    limit: number;
  }): Promise<RankedProblemSolution[]>;

  recordSubmission(args: {
    source: string;
    problemId: number;
    solutionId: number;
    rawProblem: string;
    rawSolution: string;
    metadata: Record<string, unknown> | null;
    judgeResult: Record<string, unknown>;
  }): Promise<{ id: number }>;
}
