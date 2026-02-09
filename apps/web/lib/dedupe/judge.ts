import { geminiJudgeJson } from "./gemini";
import { resolveJudgeProviderChain } from "./llm-config";
import { openAiJudgeJson } from "./openai";
import type { DedupeJudge } from "./providers";
import type {
  MatchDecision,
  ProblemCandidate,
  ProblemSolutionSubmission,
  SolutionCandidate,
} from "./types";

function coerceDecision(
  raw: Record<string, unknown>,
  validIds: Set<number>
): MatchDecision {
  const decision = raw.decision === "same" ? "same" : "new";
  const confidenceRaw = raw.confidence;
  const confidence =
    typeof confidenceRaw === "number"
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0;
  const rationale = typeof raw.rationale === "string" ? raw.rationale : "";

  const matchIdRaw = raw.match_id ?? raw.matchId;
  const matchId =
    typeof matchIdRaw === "number" && validIds.has(matchIdRaw)
      ? matchIdRaw
      : null;

  if (decision === "same" && matchId === null) {
    return { decision: "new", matchId: null, confidence: 0, rationale };
  }

  return { decision, matchId, confidence, rationale };
}

function formatCandidates(
  candidates: Array<ProblemCandidate | SolutionCandidate>,
  kind: "problem" | "solution"
): string {
  const lines: string[] = [];
  for (const c of candidates) {
    if (kind === "problem") {
      const p = c as ProblemCandidate;
      lines.push(
        JSON.stringify({
          id: p.id,
          language: p.language,
          framework: p.framework,
          errorSignature: p.errorSignature,
          canonicalProblem: p.canonicalProblem,
        })
      );
    } else {
      const s = c as SolutionCandidate;
      lines.push(
        JSON.stringify({
          id: s.id,
          solutionHash: s.solutionHash,
          canonicalSolution: s.canonicalSolution,
        })
      );
    }
  }
  return lines.join("\n");
}

function problemSystemPrompt(): string {
  return [
    "You are an extremely strict deduplication judge for Shareful.",
    "",
    "Goal: decide if the NEW problem is an exact replica of ONE existing problem candidate.",
    "",
    "Definition of EXACT REPLICA (must satisfy all):",
    "- Same language/runtime that determines the fix (e.g., Node vs Python; TS vs Go).",
    "- Same primary framework/library in the failing area (major-version compatible).",
    "- Same failure surface (same error message/class or same observable symptom + same trigger).",
    "- Same root-cause mechanism (causal chain), not just similar symptoms.",
    "- Same fix applicability: at least one existing solution for that candidate would work for the new case with only superficial edits.",
    "",
    "If you are not confident the invariants match, DO NOT merge. Prefer 'new'.",
    "",
    "Output JSON ONLY with shape:",
    '{ "decision": "same" | "new", "match_id": number|null, "confidence": number, "rationale": string }',
  ].join("\n");
}

function solutionSystemPrompt(): string {
  return [
    "You are an extremely strict solution equivalence judge for Shareful.",
    "",
    "Goal: decide if the NEW solution is effectively the same fix as ONE existing solution candidate.",
    "",
    "Only return decision='same' when:",
    "- The steps are the same in substance (same key changes, same requirements).",
    "- Differences are superficial (variable names, paths, formatting, comments).",
    "",
    "If uncertain, return 'new'.",
    "",
    "Output JSON ONLY with shape:",
    '{ "decision": "same" | "new", "match_id": number|null, "confidence": number, "rationale": string }',
  ].join("\n");
}

function problemUserPrompt(args: {
  submission: ProblemSolutionSubmission;
  candidates: ProblemCandidate[];
}): string {
  const { submission, candidates } = args;
  return [
    "NEW_PROBLEM:",
    JSON.stringify({
      language: submission.language ?? null,
      framework: submission.framework ?? null,
      errorSignature: submission.errorSignature ?? null,
      problem: submission.problem,
    }),
    "",
    "CANDIDATES (one JSON per line):",
    formatCandidates(candidates, "problem"),
  ].join("\n");
}

function solutionUserPrompt(args: {
  submission: ProblemSolutionSubmission;
  candidates: SolutionCandidate[];
}): string {
  const { submission, candidates } = args;
  return [
    "NEW_SOLUTION:",
    JSON.stringify({
      language: submission.language ?? null,
      framework: submission.framework ?? null,
      problem: submission.problem,
      solution: submission.solution,
    }),
    "",
    "CANDIDATES (one JSON per line):",
    formatCandidates(candidates, "solution"),
  ].join("\n");
}

export function createOpenAiJudge(): DedupeJudge {
  return {
    async judgeProblemMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
        };
      }

      const raw = await openAiJudgeJson({
        system: problemSystemPrompt(),
        user: problemUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return coerceDecision(raw, validIds);
    },

    async judgeSolutionMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
        };
      }

      const raw = await openAiJudgeJson({
        system: solutionSystemPrompt(),
        user: solutionUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return coerceDecision(raw, validIds);
    },
  };
}

export function createGeminiJudge(): DedupeJudge {
  return {
    async judgeProblemMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
        };
      }

      const raw = await geminiJudgeJson({
        system: problemSystemPrompt(),
        user: problemUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return coerceDecision(raw, validIds);
    },

    async judgeSolutionMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
        };
      }

      const raw = await geminiJudgeJson({
        system: solutionSystemPrompt(),
        user: solutionUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return coerceDecision(raw, validIds);
    },
  };
}

export function createConfiguredJudge(): DedupeJudge {
  const chain = resolveJudgeProviderChain();
  const judges = chain.map((name) => {
    switch (name) {
      case "gemini":
        return { name, judge: createGeminiJudge() };
      case "openai":
        return { name, judge: createOpenAiJudge() };
      default:
        return assertNeverProvider(name);
    }
  });

  return {
    async judgeProblemMatch(args) {
      const errors: Array<{ name: string; error: unknown }> = [];
      for (const { name, judge } of judges) {
        try {
          return await judge.judgeProblemMatch(args);
        } catch (error) {
          errors.push({ name, error });
        }
      }

      throw new Error(
        `All judges failed (problem): ${errors
          .map((e) => `${e.name}: ${formatProviderError(e.error)}`)
          .join("; ")}`
      );
    },

    async judgeSolutionMatch(args) {
      const errors: Array<{ name: string; error: unknown }> = [];
      for (const { name, judge } of judges) {
        try {
          return await judge.judgeSolutionMatch(args);
        } catch (error) {
          errors.push({ name, error });
        }
      }

      throw new Error(
        `All judges failed (solution): ${errors
          .map((e) => `${e.name}: ${formatProviderError(e.error)}`)
          .join("; ")}`
      );
    },
  };
}

function assertNeverProvider(value: never): never {
  throw new Error(`Unsupported judge provider: ${String(value)}`);
}

function formatProviderError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }
  if (typeof error === "string") {
    return error.slice(0, 200);
  }
  try {
    return JSON.stringify(error).slice(0, 200);
  } catch {
    return "Unknown error";
  }
}
