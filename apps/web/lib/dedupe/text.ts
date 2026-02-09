import { createHash } from "node:crypto";
import type { ProblemSearchQuery, ProblemSolutionSubmission } from "./types";

export function normalizeForHash(input: string): string {
  return input
    .trim()
    .replaceAll("\r\n", "\n")
    .replaceAll(/[ \t]+/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .toLowerCase();
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function solutionHash(solution: string): string {
  return sha256Hex(normalizeForHash(solution));
}

function field(label: string, value: string | undefined): string {
  return value ? `${label}: ${value}` : `${label}: (unknown)`;
}

export function buildProblemEmbeddingText(
  submission: ProblemSearchQuery | ProblemSolutionSubmission
): string {
  // Include structured context first to help embeddings + matching.
  const parts: string[] = [
    field("Language", submission.language),
    field("Framework", submission.framework),
    field("Error", submission.errorSignature),
    "",
    "Problem:",
    submission.problem.trim(),
  ];
  return parts.join("\n").trim();
}

export function buildSolutionEmbeddingText(
  submission: ProblemSolutionSubmission
): string {
  const parts: string[] = [
    field("Language", submission.language),
    field("Framework", submission.framework),
    field("Error", submission.errorSignature),
    "",
    "Problem:",
    submission.problem.trim(),
    "",
    "Solution:",
    submission.solution.trim(),
  ];
  return parts.join("\n").trim();
}
