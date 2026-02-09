import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import { dim, text as textColor } from "./colors.ts";
import { getSharesRepoPath } from "./config.ts";
import { SHARE_FILE, SHARES_DIR } from "./constants.ts";
import { getGitRemoteRepo, registerWithApi } from "./register.ts";
import { generateSlug } from "./share-parser.ts";
import { track } from "./telemetry.ts";
import type { SolutionType } from "./types.ts";
import { VALID_SOLUTION_TYPES } from "./types.ts";

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

interface ShareOptions {
  title?: string;
  tags?: string;
  type?: SolutionType;
  problem?: string;
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

interface ShareResult {
  title: string;
  problem: string;
  solutionType: SolutionType;
  tags: string[];
}

function validateNonInteractive(options: ShareOptions): ShareResult | null {
  const title = options.title ?? "";
  if (title.length > 128) {
    console.log(dim("Title must be at most 128 characters."));
    return null;
  }

  const problem = options.problem ?? "";
  if (!problem) {
    console.log(
      `${dim("Problem is required. Use")} ${textColor('--problem "..."')} ${dim("to provide it.")}`
    );
    return null;
  }
  if (problem.length > 256) {
    console.log(dim("Problem must be at most 256 characters."));
    return null;
  }

  const type = options.type;
  if (!(type && VALID_SOLUTION_TYPES.includes(type))) {
    console.log(
      `${dim("Invalid solution type:")} ${textColor(options.type ?? "")}`
    );
    console.log(dim(`Must be one of: ${VALID_SOLUTION_TYPES.join(", ")}`));
    return null;
  }

  const tags =
    options.tags
      ?.split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (tags.length < 1 || tags.length > 10) {
    console.log(dim("Tags must have 1-10 items."));
    return null;
  }
  if (tags.some((t) => t.length > 32)) {
    console.log(dim("Each tag must be at most 32 characters."));
    return null;
  }

  return { title, problem, solutionType: type, tags };
}

async function promptForShare(
  options: ShareOptions
): Promise<ShareResult | null> {
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

export async function runCreate(options: ShareOptions): Promise<void> {
  const cwd = getSharesRepoPath();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(
      `${dim("No shares/ directory found. Run")} ${textColor("npx shareful-ai init")} ${dim("first.")}`
    );
    return;
  }

  const isNonInteractive = options.title && options.tags && options.type;
  const result = isNonInteractive
    ? validateNonInteractive(options)
    : await promptForShare(options);

  if (!result) {
    return;
  }

  const { title, problem, solutionType, tags } = result;
  const slug = generateSlug(title);
  const shareDir = join(sharesDir, slug);
  const sharePath = join(shareDir, SHARE_FILE);

  if (existsSync(sharePath)) {
    console.log(
      `${textColor("Share already exists at")} ${dim(`${SHARES_DIR}/${slug}/${SHARE_FILE}`)}`
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

  const remote = getGitRemoteRepo();
  if (remote) {
    registerWithApi(remote.owner, remote.repo);
    track({
      event: "share",
      slug,
      shareCount: "1",
      owner: remote.owner,
      repo: remote.repo,
    });
  } else {
    track({ event: "share", slug, shareCount: "1" });
  }

  if (isNonInteractive) {
    console.log(
      `${textColor("Created share:")} ${dim(`${SHARES_DIR}/${slug}/${SHARE_FILE}`)}`
    );
  } else {
    outro(`Created ${SHARES_DIR}/${slug}/${SHARE_FILE}`);
  }

  console.log();
  console.log(dim("Next steps:"));
  console.log(
    `  1. Edit ${textColor(`${SHARES_DIR}/${slug}/${SHARE_FILE}`)} with your solution`
  );
  console.log(`  2. ${textColor("git push")} to publish`);
  console.log();
}
