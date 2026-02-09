import matter from "gray-matter";
import type { ShareFrontmatter, SolutionType } from "./types";

const VALID_SOLUTION_TYPES: SolutionType[] = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];

export function parseShareMd(raw: string): {
  frontmatter: ShareFrontmatter;
  content: string;
} {
  const { data, content } = matter(raw);

  if (!data.title || typeof data.title !== "string") {
    throw new Error("Missing or invalid 'title' in frontmatter");
  }
  if (!data.slug || typeof data.slug !== "string") {
    throw new Error("Missing or invalid 'slug' in frontmatter");
  }
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    throw new Error("Missing or invalid 'tags' in frontmatter");
  }
  if (!data.problem || typeof data.problem !== "string") {
    throw new Error("Missing or invalid 'problem' in frontmatter");
  }
  if (!VALID_SOLUTION_TYPES.includes(data.solution_type)) {
    throw new Error(
      `Invalid 'solution_type': ${data.solution_type}. Must be one of: ${VALID_SOLUTION_TYPES.join(", ")}`
    );
  }

  const REQUIRED_SECTIONS = [
    "## Problem",
    "## Solution",
    "## Why It Works",
    "## Context",
  ];

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      throw new Error(`Missing required section: ${section}`);
    }
  }

  const frontmatter: ShareFrontmatter = {
    title: data.title.slice(0, 128),
    slug: data.slug.slice(0, 64),
    tags: data.tags
      .slice(0, 10)
      .map((t: string) => t.toLowerCase().slice(0, 32)),
    problem: data.problem.slice(0, 256),
    solution_type: data.solution_type,
    verified: data.verified ?? false,
    created: data.created,
    updated: data.updated,
    ai_provider: data.ai_provider,
    environment: data.environment,
    related: data.related,
  };

  return { frontmatter, content: content.trim() };
}
