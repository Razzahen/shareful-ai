function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

export interface DedupeTuning {
  retrieval: {
    useSolutionDerivedProblemCandidates: boolean;
    solutionDerivedLimitSolutions: number;
    solutionDerivedLimitProblems: number;
  };
  problem: {
    maxCandidatesToJudge: number;
    judgeMaxDistance: number;
    acceptUnconfirmedMaxDistance: number;
    judgeAutoAcceptMargin: number;
  };
  solution: {
    maxCandidatesToJudge: number;
    judgeMaxDistance: number;
    acceptUnconfirmedMaxDistance: number;
    judgeAutoAcceptMargin: number;
    globalCandidates: number;
    localCandidates: number;
  };
}

export function resolveDedupeTuning(): DedupeTuning {
  return {
    retrieval: {
      // Extra recall without increasing judge token load (we still cap candidates passed to the model).
      useSolutionDerivedProblemCandidates: parseBooleanEnv(
        "SHAREFUL_DEDUPE_USE_SOLUTION_DERIVED_PROBLEM_CANDIDATES",
        true
      ),
      solutionDerivedLimitSolutions: parseIntEnv(
        "SHAREFUL_DEDUPE_SOLUTION_DERIVED_LIMIT_SOLUTIONS",
        20
      ),
      solutionDerivedLimitProblems: parseIntEnv(
        "SHAREFUL_DEDUPE_SOLUTION_DERIVED_LIMIT_PROBLEMS",
        25
      ),
    },
    problem: {
      // Keep the judge prompt short and consistent for reliability.
      maxCandidatesToJudge: parseIntEnv(
        "SHAREFUL_DEDUPE_PROBLEM_JUDGE_CANDIDATES",
        12
      ),
      // Skip the judge when the closest candidate is obviously far away.
      judgeMaxDistance: parseNumberEnv(
        "SHAREFUL_DEDUPE_PROBLEM_JUDGE_MAX_DISTANCE",
        0.4
      ),
      // When only a single judge is available (or confirmation disabled), only accept merges
      // for extremely close matches.
      acceptUnconfirmedMaxDistance: parseNumberEnv(
        "SHAREFUL_DEDUPE_PROBLEM_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
        0.3
      ),
      // Even if the top candidate is close, auto-accept is dangerous when multiple candidates
      // are nearly tied. Require a clear margin over the runner-up to avoid false merges.
      judgeAutoAcceptMargin: parseNumberEnv(
        "SHAREFUL_DEDUPE_PROBLEM_JUDGE_AUTO_ACCEPT_MARGIN",
        0.03
      ),
    },
    solution: {
      maxCandidatesToJudge: parseIntEnv(
        "SHAREFUL_DEDUPE_SOLUTION_JUDGE_CANDIDATES",
        12
      ),
      judgeMaxDistance: parseNumberEnv(
        "SHAREFUL_DEDUPE_SOLUTION_JUDGE_MAX_DISTANCE",
        0.45
      ),
      acceptUnconfirmedMaxDistance: parseNumberEnv(
        "SHAREFUL_DEDUPE_SOLUTION_ACCEPT_UNCONFIRMED_MAX_DISTANCE",
        0.3
      ),
      judgeAutoAcceptMargin: parseNumberEnv(
        "SHAREFUL_DEDUPE_SOLUTION_JUDGE_AUTO_ACCEPT_MARGIN",
        0.03
      ),
      globalCandidates: parseIntEnv(
        "SHAREFUL_DEDUPE_SOLUTION_GLOBAL_CANDIDATES",
        12
      ),
      localCandidates: parseIntEnv(
        "SHAREFUL_DEDUPE_SOLUTION_LOCAL_CANDIDATES",
        12
      ),
    },
  };
}
