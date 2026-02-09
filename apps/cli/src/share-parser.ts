import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ParsedShare, ShareFrontmatter, SolutionType } from "./types.ts";

const VALID_SOLUTION_TYPES: SolutionType[] = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];
const MAX_TITLE_LENGTH = 128;
const MAX_SLUG_LENGTH = 64;
const MAX_PROBLEM_LENGTH = 256;
const MAX_TAG_LENGTH = 32;
const MIN_TAGS = 1;
const MAX_TAGS = 10;
const MAX_BODY_LINES = 300;
const SLUG_REGEX = /^[a-z0-9-]+$/;

interface ValidationError {
  field: string;
  message: string;
}

function validateTags(tags: unknown): ValidationError[] {
  if (!Array.isArray(tags)) {
    return [
      { field: "tags", message: "tags is required and must be an array" },
    ];
  }

  const errors: ValidationError[] = [];

  if (tags.length < MIN_TAGS || tags.length > MAX_TAGS) {
    errors.push({
      field: "tags",
      message: `tags must have ${MIN_TAGS}-${MAX_TAGS} items`,
    });
  }

  for (const tag of tags) {
    if (typeof tag !== "string") {
      errors.push({ field: "tags", message: "each tag must be a string" });
      break;
    }
    if (tag.length > MAX_TAG_LENGTH) {
      errors.push({
        field: "tags",
        message: `each tag must be at most ${MAX_TAG_LENGTH} characters`,
      });
      break;
    }
    if (tag !== tag.toLowerCase()) {
      errors.push({ field: "tags", message: "tags must be lowercase" });
      break;
    }
  }

  return errors;
}

function validateFrontmatter(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title || typeof data.title !== "string") {
    errors.push({
      field: "title",
      message: "title is required and must be a string",
    });
  } else if (data.title.length > MAX_TITLE_LENGTH) {
    errors.push({
      field: "title",
      message: `title must be at most ${MAX_TITLE_LENGTH} characters`,
    });
  }

  if (!data.slug || typeof data.slug !== "string") {
    errors.push({
      field: "slug",
      message: "slug is required and must be a string",
    });
  } else {
    if (data.slug.length > MAX_SLUG_LENGTH) {
      errors.push({
        field: "slug",
        message: `slug must be at most ${MAX_SLUG_LENGTH} characters`,
      });
    }
    if (!SLUG_REGEX.test(data.slug)) {
      errors.push({
        field: "slug",
        message:
          "slug must contain only lowercase letters, numbers, and hyphens",
      });
    }
  }

  errors.push(...validateTags(data.tags));

  if (!data.problem || typeof data.problem !== "string") {
    errors.push({
      field: "problem",
      message: "problem is required and must be a string",
    });
  } else if (data.problem.length > MAX_PROBLEM_LENGTH) {
    errors.push({
      field: "problem",
      message: `problem must be at most ${MAX_PROBLEM_LENGTH} characters`,
    });
  }

  if (!data.solution_type || typeof data.solution_type !== "string") {
    errors.push({
      field: "solution_type",
      message: "solution_type is required",
    });
  } else if (
    !VALID_SOLUTION_TYPES.includes(data.solution_type as SolutionType)
  ) {
    errors.push({
      field: "solution_type",
      message: `solution_type must be one of: ${VALID_SOLUTION_TYPES.join(", ")}`,
    });
  }

  return errors;
}

const REQUIRED_SECTIONS = [
  "## Problem",
  "## Solution",
  "## Why It Works",
  "## Context",
];

function validateBody(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  if (lines.length > MAX_BODY_LINES) {
    errors.push({
      field: "body",
      message: `body must be at most ${MAX_BODY_LINES} lines (found ${lines.length})`,
    });
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push({
        field: "body",
        message: `missing required section: ${section}`,
      });
    }
  }

  return errors;
}

interface ParseResult {
  share: ParsedShare | null;
  errors: ValidationError[];
}

export async function parseShareMd(
  filePath: string
): Promise<ParsedShare | null>;
export async function parseShareMd(
  filePath: string,
  returnErrors: true
): Promise<ParseResult>;
export async function parseShareMd(
  filePath: string,
  returnErrors?: boolean
): Promise<ParsedShare | null | ParseResult> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);

    const frontmatterErrors = validateFrontmatter(data);
    const bodyErrors = validateBody(content);
    const allErrors = [...frontmatterErrors, ...bodyErrors];
    if (allErrors.length > 0) {
      return returnErrors ? { share: null, errors: allErrors } : null;
    }

    const frontmatter: ShareFrontmatter = {
      title: data.title as string,
      slug: data.slug as string,
      tags: data.tags as string[],
      problem: data.problem as string,
      solution_type: data.solution_type as SolutionType,
      verified: data.verified as boolean | undefined,
      created: data.created as string | undefined,
      updated: data.updated as string | undefined,
      ai_provider: data.ai_provider as ShareFrontmatter["ai_provider"],
      environment: data.environment as ShareFrontmatter["environment"],
      related: data.related as string[] | undefined,
    };

    const share = {
      frontmatter,
      content: content.trim(),
      filePath,
    };

    return returnErrors ? { share, errors: [] } : share;
  } catch {
    return returnErrors
      ? {
          share: null,
          errors: [{ field: "file", message: "failed to read or parse file" }],
        }
      : null;
  }
}

export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);

  if (!(slug && SLUG_REGEX.test(slug))) {
    return "untitled-share";
  }

  return slug;
}
