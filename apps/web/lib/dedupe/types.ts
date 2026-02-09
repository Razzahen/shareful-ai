export interface ProblemSolutionSubmission {
  problem: string;
  solution: string;
  language?: string;
  framework?: string;
  errorSignature?: string;
  metadata?: Record<string, unknown>;
}

export interface ProblemSearchQuery {
  problem: string;
  language?: string;
  framework?: string;
  errorSignature?: string;
  metadata?: Record<string, unknown>;
}

export interface ProblemCandidate {
  id: number;
  canonicalProblem: string;
  language: string | null;
  framework: string | null;
  errorSignature: string | null;
  metadata: Record<string, unknown> | null;
  distance: number;
}

export interface SolutionCandidate {
  id: number;
  canonicalSolution: string;
  solutionHash: string;
  metadata: Record<string, unknown> | null;
  distance: number;
}

export interface RankedProblemSolution {
  id: number;
  canonicalSolution: string;
  solutionHash: string;
  metadata: Record<string, unknown> | null;
  seenCount: number;
  successCount: number;
  failureCount: number;
  verificationCount: number;
  score: number;
}

export interface MatchDecision {
  decision: "same" | "new";
  matchId: number | null;
  confidence: number;
  rationale: string;
}

export interface IngestResult {
  submissionId: number;
  problem: {
    id: number;
    action: "created" | "matched";
    judge: MatchDecision;
  };
  solution: {
    id: number;
    action: "created" | "matched";
    judge: MatchDecision;
  };
  link: {
    problemId: number;
    solutionId: number;
    action: "created" | "incremented";
    seenCount: number;
  };
}
