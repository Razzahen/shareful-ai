import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import { SHARE_FILE, SHARES_DIR } from "./constants.ts";
import { generateSlug } from "./share-parser.ts";
import { track } from "./telemetry.ts";
import type { SolutionType } from "./types.ts";

const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;102m";
const TEXT = "\x1b[38;5;145m";

const VALID_SOLUTION_TYPES: SolutionType[] = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];

const SOLUTION_TYPES: { value: SolutionType; label: string; hint: string }[] = [
  { value: "fix", label: "Fix", hint: "A direct fix for a bug or error" },
  {
    value: "workaround",
    label: "Workaround",
    hint: "A temporary workaround for a known issue",
  },
  { value: "pattern", label: "Pattern", hint: "A reusable coding pattern" },
  {
    value: "reference",
    label: "Reference",
    hint: "A reference guide or cheat sheet",
  },
  { value: "config", label: "Config", hint: "A configuration solution" },
];

interface CreateOptions {
  title?: string;
  tags?: string;
  type?: SolutionType;
  problem?: string;
}

export function parseCreateOptions(args: string[]): CreateOptions {
  const options: CreateOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "--title" || arg === "-t") && next) {
      options.title = next;
      i++;
    } else if (arg === "--tags" && next) {
      options.tags = next;
      i++;
    } else if (arg === "--type" && next) {
      options.type = next as SolutionType;
      i++;
    } else if ((arg === "--problem" || arg === "-p") && next) {
      options.problem = next;
      i++;
    }
  }

  return options;
}

function getToday(): string {
  const [date] = new Date().toISOString().split("T");
  return date ?? "";
}

function generateShareTemplate(
  title: string,
  slug: string,
  tags: string[],
  problem: string,
  solutionType: SolutionType
): string {
  return `---
title: "${title}"
slug: ${slug}
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
problem: "${problem}"
solution_type: ${solutionType}
created: ${getToday()}
---

## Problem

${problem}

## Solution

<!-- Describe your solution here with code blocks -->

\`\`\`
# Add your code here
\`\`\`

## Why It Works

<!-- Explain why this solution works -->

## Context

<!-- Environment details: versions, OS, constraints -->
`;
}

interface CreateResult {
  title: string;
  problem: string;
  solutionType: SolutionType;
  tags: string[];
}

function parseNonInteractive(options: CreateOptions): CreateResult | null {
  const title = options.title ?? "";
  if (title.length > 128) {
    console.log(`${DIM}Title must be at most 128 characters.${RESET}`);
    return null;
  }

  const problem = options.problem ?? "";
  if (!problem) {
    console.log(
      `${DIM}Problem is required. Use ${RESET}${TEXT}--problem "..."${RESET}${DIM} to provide it.${RESET}`
    );
    return null;
  }
  if (problem.length > 256) {
    console.log(`${DIM}Problem must be at most 256 characters.${RESET}`);
    return null;
  }

  const type = options.type;
  if (!(type && VALID_SOLUTION_TYPES.includes(type))) {
    console.log(
      `${DIM}Invalid solution type: ${RESET}${TEXT}${options.type}${RESET}`
    );
    console.log(
      `${DIM}Must be one of: ${VALID_SOLUTION_TYPES.join(", ")}${RESET}`
    );
    return null;
  }

  const tags =
    options.tags
      ?.split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (tags.length < 1 || tags.length > 10) {
    console.log(`${DIM}Tags must have 1-10 items.${RESET}`);
    return null;
  }
  if (tags.some((t) => t.length > 32)) {
    console.log(`${DIM}Each tag must be at most 32 characters.${RESET}`);
    return null;
  }

  return { title, problem, solutionType: type, tags };
}

async function promptInteractive(
  options: CreateOptions
): Promise<CreateResult | null> {
  intro("Create a new share");

  const titleResult = await text({
    message: "Title",
    placeholder: "Fix Next.js hydration error with dynamic imports",
    initialValue: options.title,
    validate: (value) => {
      if (!value) {
        return "Title is required";
      }
      if (value.length > 128) {
        return "Title must be at most 128 characters";
      }
    },
  });

  if (isCancel(titleResult)) {
    cancel("Cancelled");
    return null;
  }

  const problemResult = await text({
    message: "Problem (one sentence)",
    placeholder: "Component using window throws hydration mismatch error",
    initialValue: options.problem,
    validate: (value) => {
      if (!value) {
        return "Problem description is required";
      }
      if (value.length > 256) {
        return "Problem must be at most 256 characters";
      }
    },
  });

  if (isCancel(problemResult)) {
    cancel("Cancelled");
    return null;
  }

  const typeResult = await select({
    message: "Solution type",
    options: SOLUTION_TYPES,
    initialValue: options.type,
  });

  if (isCancel(typeResult)) {
    cancel("Cancelled");
    return null;
  }

  const tagsResult = await text({
    message: "Tags (comma-separated)",
    placeholder: "nextjs, react, hydration, ssr",
    initialValue: options.tags,
    validate: (value) => {
      if (!value) {
        return "At least one tag is required";
      }
      const parsed = value.split(",").map((t) => t.trim());
      if (parsed.length > 10) {
        return "Maximum 10 tags";
      }
    },
  });

  if (isCancel(tagsResult)) {
    cancel("Cancelled");
    return null;
  }

  return {
    title: titleResult,
    problem: problemResult,
    solutionType: typeResult,
    tags: tagsResult.split(",").map((t) => t.trim().toLowerCase()),
  };
}

export async function runCreate(args: string[]): Promise<void> {
  const options = parseCreateOptions(args);
  const cwd = process.cwd();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(
      `${DIM}No shares/ directory found. Run${RESET} ${TEXT}npx shareful init${RESET} ${DIM}first.${RESET}`
    );
    return;
  }

  const isNonInteractive = options.title && options.tags && options.type;
  const result = isNonInteractive
    ? parseNonInteractive(options)
    : await promptInteractive(options);

  if (!result) {
    return;
  }

  const { title, problem, solutionType, tags } = result;
  const slug = generateSlug(title);
  const shareDir = join(sharesDir, slug);
  const sharePath = join(shareDir, SHARE_FILE);

  if (existsSync(sharePath)) {
    console.log(
      `${TEXT}Share already exists at ${DIM}${SHARES_DIR}/${slug}/${SHARE_FILE}${RESET}`
    );
    return;
  }

  mkdirSync(shareDir, { recursive: true });

  const content = generateShareTemplate(
    title,
    slug,
    tags,
    problem,
    solutionType
  );
  writeFileSync(sharePath, content);

  track({ event: "create", slug, solutionType });

  if (isNonInteractive) {
    console.log(
      `${TEXT}Created share: ${DIM}${SHARES_DIR}/${slug}/${SHARE_FILE}${RESET}`
    );
  } else {
    outro(`Created ${SHARES_DIR}/${slug}/${SHARE_FILE}`);
  }

  console.log();
  console.log(`${DIM}Next steps:${RESET}`);
  console.log(
    `  1. Edit ${TEXT}${SHARES_DIR}/${slug}/${SHARE_FILE}${RESET} with your solution`
  );
  console.log(`  2. Run ${TEXT}npx shareful publish${RESET} to share it`);
  console.log();
}
