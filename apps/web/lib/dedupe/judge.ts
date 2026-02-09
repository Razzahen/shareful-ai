import { geminiJudgeJson } from "./gemini";
import { resolveJudgeProviderChain } from "./llm-config";
import { openAiJudgeJson } from "./openai";
import type { DedupeJudge } from "./providers";
import { resolveDedupeTuning } from "./tuning";
import type {
  MatchDecision,
  ProblemCandidate,
  ProblemSolutionSubmission,
  SolutionCandidate,
} from "./types";

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
    "You are a deduplication judge for Shareful.",
    "",
    "Goal: decide if the NEW problem is an exact replica of ONE existing problem candidate.",
    "",
    "Important:",
    "- Candidates are canonicalized; they may describe a representative instance of an underlying issue.",
    "- Return 'same' only when the underlying root-cause mechanism AND fix strategy are the same.",
    "",
    "Definition of EXACT REPLICA (must satisfy all):",
    "- Same language/runtime that determines the fix (e.g., Node vs Python; TS vs Go).",
    "- Same primary framework/library in the failing area (major-version compatible).",
    "- Same failure surface (same error message/class or same observable symptom + same trigger).",
    "- Same root-cause mechanism (causal chain), not just similar symptoms.",
    "- Same fix applicability: at least one existing solution for that candidate would work for the new case with only superficial edits.",
    "",
    "Decision rules:",
    "- If exactly ONE candidate satisfies the definition, return decision='same' with that match_id.",
    "- If NONE satisfy it, return decision='new'.",
    "- If MULTIPLE could satisfy it or you are unsure, return decision='new'.",
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
          provider: "openai",
        };
      }

      const raw = await openAiJudgeJson({
        system: problemSystemPrompt(),
        user: problemUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return { ...coerceDecision(raw, validIds), provider: "openai" };
    },

    async judgeSolutionMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
          provider: "openai",
        };
      }

      const raw = await openAiJudgeJson({
        system: solutionSystemPrompt(),
        user: solutionUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return { ...coerceDecision(raw, validIds), provider: "openai" };
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
          provider: "gemini",
        };
      }

      const raw = await geminiJudgeJson({
        system: problemSystemPrompt(),
        user: problemUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return { ...coerceDecision(raw, validIds), provider: "gemini" };
    },

    async judgeSolutionMatch({ submission, candidates }) {
      if (candidates.length === 0) {
        return {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "No candidates",
          provider: "gemini",
        };
      }

      const raw = await geminiJudgeJson({
        system: solutionSystemPrompt(),
        user: solutionUserPrompt({ submission, candidates }),
      });

      const validIds = new Set(candidates.map((c) => c.id));
      return { ...coerceDecision(raw, validIds), provider: "gemini" };
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

  const confirmMerges = parseBooleanEnv(
    "SHAREFUL_JUDGE_CONFIRM_MERGES",
    judges.length > 1
  );

  const tuning = resolveDedupeTuning();

  return {
    async judgeProblemMatch(args) {
      const primary = await runPrimaryDecision({
        judges,
        kind: "problem",
        args,
        invoke: (j, callArgs) => j.judgeProblemMatch(callArgs),
      });

      const matchInfo = getMatchDistanceInfo({
        decision: primary.decision,
        candidates: args.candidates,
      });

      return confirmPrimaryDecision({
        judges,
        kind: "problem",
        args,
        primary,
        confirmMerges,
        matchInfo,
        autoAcceptMaxDistance: tuning.problem.acceptUnconfirmedMaxDistance,
        autoAcceptMargin: tuning.problem.judgeAutoAcceptMargin,
        invoke: (j, callArgs) => j.judgeProblemMatch(callArgs),
      });
    },

    async judgeSolutionMatch(args) {
      const primary = await runPrimaryDecision({
        judges,
        kind: "solution",
        args,
        invoke: (j, callArgs) => j.judgeSolutionMatch(callArgs),
      });

      const matchInfo = getMatchDistanceInfo({
        decision: primary.decision,
        candidates: args.candidates,
      });

      return confirmPrimaryDecision({
        judges,
        kind: "solution",
        args,
        primary,
        confirmMerges,
        matchInfo,
        autoAcceptMaxDistance: tuning.solution.acceptUnconfirmedMaxDistance,
        autoAcceptMargin: tuning.solution.judgeAutoAcceptMargin,
        invoke: (j, callArgs) => j.judgeSolutionMatch(callArgs),
      });
    },
  };
}

interface NamedJudge {
  name: string;
  judge: DedupeJudge;
}

async function runPrimaryDecision<TArgs>(args: {
  judges: NamedJudge[];
  kind: "problem" | "solution";
  args: TArgs;
  invoke: (judge: DedupeJudge, callArgs: TArgs) => Promise<MatchDecision>;
}): Promise<{ decision: MatchDecision; provider: string; index: number }> {
  const errors: Array<{ name: string; error: unknown }> = [];

  for (let i = 0; i < args.judges.length; i++) {
    const entry = args.judges[i];
    if (!entry) {
      continue;
    }
    try {
      const decision = await args.invoke(entry.judge, args.args);
      return { decision, provider: entry.name, index: i };
    } catch (error) {
      errors.push({ name: entry.name, error });
    }
  }

  throw new Error(
    `All judges failed (${args.kind}): ${errors
      .map((e) => `${e.name}: ${formatProviderError(e.error)}`)
      .join("; ")}`
  );
}

async function confirmPrimaryDecision<TArgs>(args: {
  judges: NamedJudge[];
  kind: "problem" | "solution";
  args: TArgs;
  primary: { decision: MatchDecision; provider: string; index: number };
  confirmMerges: boolean;
  matchInfo: {
    matchDistance: number | null;
    isNearest: boolean;
    marginToSecondBest: number | null;
  };
  autoAcceptMaxDistance: number;
  autoAcceptMargin: number;
  invoke: (judge: DedupeJudge, callArgs: TArgs) => Promise<MatchDecision>;
}): Promise<MatchDecision> {
  const primaryDecision = args.primary.decision;

  if (primaryDecision.decision === "new") {
    return primaryDecision;
  }

  if (!args.confirmMerges || args.judges.length < 2) {
    return primaryDecision;
  }

  // If the match is extremely close, accept the primary decision without paying the
  // latency/cost of a second model.
  if (
    typeof args.matchInfo.matchDistance === "number" &&
    args.matchInfo.matchDistance <= args.autoAcceptMaxDistance &&
    args.matchInfo.isNearest &&
    typeof args.matchInfo.marginToSecondBest === "number" &&
    args.matchInfo.marginToSecondBest >= args.autoAcceptMargin
  ) {
    return primaryDecision;
  }

  const confirmations: NonNullable<MatchDecision["confirmations"]> = [];
  const confirmErrors: Array<{ name: string; error: unknown }> = [];

  for (let i = args.primary.index + 1; i < args.judges.length; i++) {
    const entry = args.judges[i];
    if (!entry) {
      continue;
    }
    try {
      const decision = await args.invoke(entry.judge, args.args);
      confirmations.push({
        provider: entry.name,
        decision: decision.decision,
        matchId: decision.matchId,
        confidence: decision.confidence,
        rationale: decision.rationale,
      });

      if (
        decision.decision === "same" &&
        decision.matchId !== null &&
        decision.matchId === primaryDecision.matchId
      ) {
        return {
          ...primaryDecision,
          confirmedBy: entry.name,
          confirmations,
        };
      }

      return {
        decision: "new",
        matchId: null,
        confidence: 0,
        provider: args.primary.provider,
        confirmations,
        rationale: `Primary (${args.primary.provider}) proposed merge to ${primaryDecision.matchId}, but confirmer (${entry.name}) disagreed.`,
      };
    } catch (error) {
      confirmErrors.push({ name: entry.name, error });
    }
  }

  return {
    ...primaryDecision,
    confirmations,
    rationale:
      `${primaryDecision.rationale} | Confirmation unavailable: ${confirmErrors
        .map((e) => `${e.name}: ${formatProviderError(e.error)}`)
        .join("; ")}`.slice(0, 800),
  };
}

function getMatchDistanceInfo(args: {
  decision: MatchDecision;
  candidates: Array<{ id: number; distance: number }>;
}): {
  matchDistance: number | null;
  isNearest: boolean;
  marginToSecondBest: number | null;
} {
  if (!(args.decision.decision === "same" && args.decision.matchId !== null)) {
    return { matchDistance: null, isNearest: false, marginToSecondBest: null };
  }

  const distance = args.candidates.find(
    (c) => c.id === args.decision.matchId
  )?.distance;

  const matchDistance = typeof distance === "number" ? distance : null;

  // Compute nearest + 2nd nearest distances, independent of model matchId choice.
  const sorted = [...args.candidates].sort((a, b) => a.distance - b.distance);
  const nearest = sorted[0];
  const second = sorted[1];

  const nearestDistance =
    typeof nearest?.distance === "number" ? nearest.distance : null;
  const secondDistance =
    typeof second?.distance === "number" ? second.distance : null;

  const isNearest = Boolean(nearest) && nearest.id === args.decision.matchId;

  const marginToSecondBest =
    matchDistance !== null && secondDistance !== null
      ? secondDistance - matchDistance
      : null;

  // If the match isn't the nearest, treat margin as unknown; don't auto-accept.
  return {
    matchDistance,
    isNearest: isNearest && nearestDistance !== null,
    marginToSecondBest: isNearest ? marginToSecondBest : null,
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
