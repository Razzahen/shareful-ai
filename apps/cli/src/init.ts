import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
} from "@clack/prompts";
import { dim, text } from "./colors.ts";
import { SHARES_DIR } from "./constants.ts";
import { track } from "./telemetry.ts";

const PROJECT_NAME_RE = /^[a-z0-9._-]+$/i;
const MAX_NAME_LENGTH = 128;

function getToday(): string {
  const [date] = new Date().toISOString().split("T");
  return date ?? "";
}

function validateProjectName(value: string): string | undefined {
  if (!value) {
    return "Project name is required";
  }
  if (value.length > MAX_NAME_LENGTH) {
    return `Project name must be at most ${MAX_NAME_LENGTH} characters`;
  }
  if (!PROJECT_NAME_RE.test(value)) {
    return "Project name can only contain letters, numbers, dots, hyphens, and underscores";
  }
}

function isDirEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return true;
  }
  const entries = readdirSync(dirPath);
  return entries.length === 0;
}

function generateGitignore(): string {
  return `# OS
.DS_Store

# Logs
*.log

# Temporary files
*.tmp
*.swp
*.swo

# Node (if used locally)
node_modules/

# Env
.env
.env.*
`;
}

function generateAgentsMd(): string {
  return `# Shares Repository

This is a shareful.ai shares repository containing coding solutions as SHARE.md files.

## Structure

- Each share lives in \`shares/{slug}/SHARE.md\`
- Slugs are kebab-case, prefixed by solution type: \`fix-\`, \`workaround-\`, \`pattern-\`, \`reference-\`, \`config-\`
- The \`shares/\` directory is the only content directory

## SHARE.md format

Every SHARE.md must have:

1. YAML frontmatter with: \`title\`, \`slug\`, \`tags\`, \`problem\`, \`solution_type\`, \`created\`
2. Four required markdown sections: \`## Problem\`, \`## Solution\`, \`## Why It Works\`, \`## Context\`

### Frontmatter constraints

- \`title\`: max 128 characters
- \`slug\`: max 64 characters, lowercase, hyphens and numbers only (\`[a-z0-9-]\`)
- \`tags\`: 1-10 tags, each lowercase, max 32 characters
- \`problem\`: max 256 characters, one sentence
- \`solution_type\`: one of \`fix\`, \`workaround\`, \`pattern\`, \`reference\`, \`config\`
- \`created\`: ISO date string (YYYY-MM-DD)

### Valid solution types

- **fix** -- direct resolution for a bug or error
- **workaround** -- temporary bypass for a known issue
- **pattern** -- reusable approach or best practice
- **reference** -- guide, cheat sheet, or comparison
- **config** -- configuration template

## Commands

\`\`\`bash
npx shareful-ai create          # Create, validate, commit, push, and index
npx shareful-ai search <query> # Search shareful.ai for solutions
\`\`\`

## Code style

- Markdown content uses standard GitHub-flavored markdown
- Code blocks must specify a language for syntax highlighting
- Keep solutions focused and actionable
`;
}

function generateReadme(repoName: string): string {
  return `# ${repoName}

A [shareful.ai](https://shareful.ai) shares repository. Use this template to start sharing AI coding solutions.

## Quick start

\`\`\`bash
# Clone this template
gh repo create ${repoName} --template shareful-ai/shares --public --clone
cd ${repoName}

# Create and publish a share
npx shareful-ai create
\`\`\`

## Structure

\`\`\`
shares/
  fix-example-issue/
    SHARE.md
  pattern-example-approach/
    SHARE.md
\`\`\`

Each \`SHARE.md\` contains a solution with YAML frontmatter and four required sections:

- **Problem** -- what went wrong
- **Solution** -- how to fix it (with code)
- **Why It Works** -- the explanation
- **Context** -- versions, frameworks, constraints

## Solution types

| Type | Use when |
|------|----------|
| \`fix\` | Direct resolution for a bug or error |
| \`workaround\` | Temporary bypass for a known issue |
| \`pattern\` | Reusable approach or best practice |
| \`reference\` | Guide, cheat sheet, or comparison |
| \`config\` | Configuration template |

## Slug conventions

Name share directories with the solution type as prefix:

\`\`\`
fix-nextjs-hydration-error
workaround-notion-api-export
pattern-docs-as-code-workflow
reference-docs-platform-comparison
config-docusaurus-full-setup
\`\`\`

## Learn more

- [shareful.ai](https://shareful.ai) -- search all shared solutions
- \`npx shareful-ai --help\` -- CLI reference
`;
}

function generateExampleShare(today: string): string {
  return `---
title: "Example: Fix a common issue"
slug: example-share
tags: [example]
problem: "Describe the problem you solved"
solution_type: fix
created: ${today}
---

## Problem

Describe the issue you encountered, including any error messages.

## Solution

\`\`\`typescript
// Your solution code here
\`\`\`

## Why It Works

Explain why this solution resolves the problem.

## Context

- Language: TypeScript
- Framework: (your framework)
- Version: (relevant versions)
`;
}

function writeProjectFile(
  targetDir: string,
  relativePath: string,
  content: string
): void {
  const fullPath = join(targetDir, relativePath);
  writeFileSync(fullPath, content);
  log.step(`Created ${relativePath}`);
}

function initGitRepo(targetDir: string): void {
  const result = spawnSync("git", ["init"], {
    cwd: targetDir,
    stdio: "pipe",
  });

  if (result.status === 0) {
    log.step("Initialized git repository");
  } else {
    log.info(
      `${dim("Could not initialize git repository. You can run")} ${text("git init")} ${dim("manually.")}`
    );
  }
}

export async function runInitRepo(name?: string): Promise<void> {
  intro("Create a new shares repository");

  const nameArg = name ?? "shares";

  const error = validateProjectName(nameArg);
  if (error) {
    cancel(error);
    return;
  }

  const projectName = nameArg;

  const targetDir = resolve(process.cwd(), projectName);

  if (!isDirEmpty(targetDir)) {
    const overwrite = await confirm({
      message: `Directory ${projectName} is not empty. Continue anyway?`,
    });

    if (isCancel(overwrite)) {
      cancel("Cancelled");
      return;
    }

    if (!overwrite) {
      cancel("Cancelled");
      return;
    }
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, SHARES_DIR, "example-share"), { recursive: true });

  const today = getToday();

  writeProjectFile(targetDir, ".gitignore", generateGitignore());
  writeProjectFile(targetDir, "AGENTS.md", generateAgentsMd());
  writeProjectFile(targetDir, "README.md", generateReadme(projectName));
  writeProjectFile(
    targetDir,
    join(SHARES_DIR, "example-share", "SHARE.md"),
    generateExampleShare(today)
  );

  initGitRepo(targetDir);

  track({ event: "init", repoName: projectName });

  note(`  cd ${projectName}\n  npx shareful-ai create`, "Next steps");

  outro("Done! Happy sharing.");
}
