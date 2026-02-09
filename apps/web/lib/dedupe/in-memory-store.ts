import type { DedupeStore } from "./providers";
import type {
  ProblemCandidate,
  RankedProblemSolution,
  SolutionCandidate,
} from "./types";

interface StoredProblem {
  id: number;
  canonicalProblem: string;
  language: string | null;
  framework: string | null;
  errorSignature: string | null;
  metadata: Record<string, unknown> | null;
  embedding: number[];
}

interface StoredSolution {
  id: number;
  canonicalSolution: string;
  solutionHash: string;
  metadata: Record<string, unknown> | null;
  embedding: number[];
}

interface StoredSubmission {
  id: number;
  source: string;
  problemId: number;
  solutionId: number;
  rawProblem: string;
  rawSolution: string;
  metadata: Record<string, unknown> | null;
  judgeResult: Record<string, unknown>;
}

export function createInMemoryDedupeStore(): DedupeStore & {
  dump(): {
    problems: StoredProblem[];
    solutions: StoredSolution[];
    links: Array<{
      problemId: number;
      solutionId: number;
      seenCount: number;
      successCount: number;
      failureCount: number;
      verificationCount: number;
    }>;
    submissions: StoredSubmission[];
  };
} {
  let nextProblemId = 1;
  let nextSolutionId = 1;
  let nextSubmissionId = 1;

  const problems: StoredProblem[] = [];
  const solutions: StoredSolution[] = [];
  const links = new Map<
    string,
    {
      problemId: number;
      solutionId: number;
      seenCount: number;
      successCount: number;
      failureCount: number;
      verificationCount: number;
    }
  >();
  const submissions: StoredSubmission[] = [];

  return {
    findSimilarProblems({
      embedding,
      limit,
      language,
      framework,
    }): Promise<ProblemCandidate[]> {
      return Promise.resolve(
        problems
          .filter((p) => {
            if (language && p.language && p.language !== language) {
              return false;
            }
            if (framework && p.framework && p.framework !== framework) {
              return false;
            }
            return true;
          })
          .map((p) => ({
            id: p.id,
            canonicalProblem: p.canonicalProblem,
            language: p.language,
            framework: p.framework,
            errorSignature: p.errorSignature,
            metadata: p.metadata,
            distance: cosineDistance(p.embedding, embedding),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, limit)
      );
    },

    createProblem(args): Promise<{ id: number }> {
      const id = nextProblemId++;
      problems.push({
        id,
        canonicalProblem: args.canonicalProblem,
        language: args.language,
        framework: args.framework,
        errorSignature: args.errorSignature,
        metadata: args.metadata,
        embedding: args.embedding,
      });
      return Promise.resolve({ id });
    },

    findSolutionByHash({ solutionHash }): Promise<{ id: number } | null> {
      const found = solutions.find((s) => s.solutionHash === solutionHash);
      return Promise.resolve(found ? { id: found.id } : null);
    },

    findSimilarSolutions({
      problemId,
      embedding,
      limit,
    }): Promise<SolutionCandidate[]> {
      const candidates: SolutionCandidate[] = [];
      for (const link of links.values()) {
        if (link.problemId !== problemId) {
          continue;
        }
        const sol = solutions.find((s) => s.id === link.solutionId);
        if (!sol) {
          continue;
        }
        candidates.push({
          id: sol.id,
          canonicalSolution: sol.canonicalSolution,
          solutionHash: sol.solutionHash,
          metadata: sol.metadata,
          distance: cosineDistance(sol.embedding, embedding),
        });
      }
      return Promise.resolve(
        candidates.sort((a, b) => a.distance - b.distance).slice(0, limit)
      );
    },

    createSolution(args): Promise<{ id: number }> {
      const id = nextSolutionId++;
      solutions.push({
        id,
        canonicalSolution: args.canonicalSolution,
        solutionHash: args.solutionHash,
        metadata: args.metadata,
        embedding: args.embedding,
      });
      return Promise.resolve({ id });
    },

    upsertProblemSolutionLink({ problemId, solutionId }) {
      const key = `${problemId}:${solutionId}`;
      const existing = links.get(key);
      if (existing) {
        existing.seenCount++;
        links.set(key, existing);
        return Promise.resolve({
          action: "incremented" as const,
          seenCount: existing.seenCount,
        });
      }
      links.set(key, {
        problemId,
        solutionId,
        seenCount: 1,
        successCount: 0,
        failureCount: 0,
        verificationCount: 0,
      });
      return Promise.resolve({ action: "created" as const, seenCount: 1 });
    },

    listSolutionsForProblem({
      problemId,
      limit,
    }): Promise<RankedProblemSolution[]> {
      const rows: RankedProblemSolution[] = [];

      for (const link of links.values()) {
        if (link.problemId !== problemId) {
          continue;
        }

        const sol = solutions.find((s) => s.id === link.solutionId);
        if (!sol) {
          continue;
        }

        const score = computeSolutionScore(link);

        rows.push({
          id: sol.id,
          canonicalSolution: sol.canonicalSolution,
          solutionHash: sol.solutionHash,
          metadata: sol.metadata,
          seenCount: link.seenCount,
          successCount: link.successCount,
          failureCount: link.failureCount,
          verificationCount: link.verificationCount,
          score,
        });
      }

      return Promise.resolve(
        rows.sort((a, b) => compareRankedSolutions(a, b)).slice(0, limit)
      );
    },

    recordSubmission(args): Promise<{ id: number }> {
      const id = nextSubmissionId++;
      submissions.push({
        id,
        source: args.source,
        problemId: args.problemId,
        solutionId: args.solutionId,
        rawProblem: args.rawProblem,
        rawSolution: args.rawSolution,
        metadata: args.metadata,
        judgeResult: args.judgeResult,
      });
      return Promise.resolve({ id });
    },

    dump() {
      return {
        problems: [...problems],
        solutions: [...solutions],
        links: [...links.values()],
        submissions: [...submissions],
      };
    },
  };
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
  // Convert similarity [-1..1] to distance [0..2].
  return 1 - cos;
}

function computeSolutionScore(link: {
  seenCount: number;
  successCount: number;
  failureCount: number;
  verificationCount: number;
}): number {
  return (
    link.seenCount * 2 +
    link.verificationCount * 5 +
    link.successCount * 3 -
    link.failureCount * 4
  );
}

function compareRankedSolutions(
  a: RankedProblemSolution,
  b: RankedProblemSolution
): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.seenCount !== b.seenCount) {
    return b.seenCount - a.seenCount;
  }
  if (a.verificationCount !== b.verificationCount) {
    return b.verificationCount - a.verificationCount;
  }
  if (a.successCount !== b.successCount) {
    return b.successCount - a.successCount;
  }
  if (a.failureCount !== b.failureCount) {
    return a.failureCount - b.failureCount;
  }
  return a.id - b.id;
}
