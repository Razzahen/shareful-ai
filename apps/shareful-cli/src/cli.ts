#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runCreate } from './create.ts';
import { runPublish } from './publish.ts';
import { parseShareMd } from './share-parser.ts';
import { track, setVersion } from './telemetry.ts';
import { SHARES_DIR, SHARE_FILE, MANIFEST_FILE } from './constants.ts';
import type { ShareManifest } from './types.ts';
import { writeManifest } from './manifest.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();
setVersion(VERSION);

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[38;5;102m';
const TEXT = '\x1b[38;5;145m';
const CYAN = '\x1b[36m';

const LOGO_LINES = [
  '███████╗██╗  ██╗ █████╗ ██████╗ ███████╗███████╗██╗   ██╗██╗     ',
  '██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝██║   ██║██║     ',
  '███████╗███████║███████║██████╔╝█████╗  █████╗  ██║   ██║██║     ',
  '╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  ██╔══╝  ██║   ██║██║     ',
  '███████║██║  ██║██║  ██║██║  ██║███████╗██║     ╚██████╔╝███████╗',
  '╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚══════╝',
];

const GRAYS = [
  '\x1b[38;5;250m',
  '\x1b[38;5;248m',
  '\x1b[38;5;245m',
  '\x1b[38;5;243m',
  '\x1b[38;5;240m',
  '\x1b[38;5;238m',
];

function showLogo(): void {
  console.log();
  LOGO_LINES.forEach((line, i) => {
    console.log(`${GRAYS[i]}${line}${RESET}`);
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(`${DIM}Share AI coding solutions with the world${RESET}`);
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful init ${DIM}[name]${RESET}     ${DIM}Create a shares repo${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful create${RESET}           ${DIM}Create a new share${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful publish${RESET}          ${DIM}Publish shares to GitHub${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful list${RESET}             ${DIM}List shares in this repo${RESET}`
  );
  console.log();
  console.log(`Discover shares at ${TEXT}https://shareful.ai/${RESET}`);
  console.log();
}

function showHelp(): void {
  console.log(`
${BOLD}Usage:${RESET} shareful <command> [options]

${BOLD}Commands:${RESET}
  init [name]       Create a new shares repository
  create            Create a new SHARE.md interactively
  publish           Validate, commit, push, and index shares
  list, ls          List shares in current repo

${BOLD}Create Options:${RESET}
  -t, --title <title>       Share title
  -p, --problem <problem>   One-sentence problem description
  --tags <tags>             Comma-separated tags
  --type <type>             Solution type: fix, workaround, pattern, reference, config

${BOLD}Options:${RESET}
  --help, -h        Show this help message
  --version, -v     Show version number

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} shareful init my-shares
  ${DIM}$${RESET} shareful create
  ${DIM}$${RESET} shareful create --title "Fix hydration error" --tags "nextjs,react" --type fix
  ${DIM}$${RESET} shareful publish
  ${DIM}$${RESET} shareful list

Discover shares at ${TEXT}https://shareful.ai/${RESET}
`);
}

function runInit(args: string[]): void {
  const cwd = process.cwd();
  const repoName = args[0] || basename(cwd);
  const hasName = args[0] !== undefined;

  const repoDir = hasName ? join(cwd, repoName) : cwd;
  const sharesDir = join(repoDir, SHARES_DIR);
  const manifestPath = join(repoDir, MANIFEST_FILE);

  if (existsSync(manifestPath)) {
    console.log(`${TEXT}Shareful repo already initialized at ${DIM}${hasName ? repoName : '.'}${RESET}`);
    return;
  }

  // Create directory structure
  if (hasName) {
    mkdirSync(repoDir, { recursive: true });
  }
  mkdirSync(sharesDir, { recursive: true });

  // Create sample SHARE.md
  const sampleSlug = 'example-share';
  const sampleDir = join(sharesDir, sampleSlug);
  mkdirSync(sampleDir, { recursive: true });

  const today = new Date().toISOString().split('T')[0];
  const sampleShare = `---
title: "Example: Fix a common issue"
slug: ${sampleSlug}
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

  writeFileSync(join(sampleDir, SHARE_FILE), sampleShare);

  // Create shareful.json manifest
  const manifest: ShareManifest = {
    version: 1,
    owner: '',
    shares: [
      {
        slug: sampleSlug,
        title: 'Example: Fix a common issue',
        tags: ['example'],
        problem: 'Describe the problem you solved',
        solution_type: 'fix',
      },
    ],
  };

  writeManifest(repoDir, manifest);

  // Create .gitignore
  const gitignorePath = join(repoDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, 'node_modules/\n.DS_Store\n');
  }

  track({ event: 'init', repoName });

  const displayName = hasName ? repoName : '.';
  console.log(`${TEXT}Initialized shareful repo: ${DIM}${displayName}${RESET}`);
  console.log();
  console.log(`${DIM}Created:${RESET}`);
  console.log(`  ${SHARES_DIR}/${sampleSlug}/${SHARE_FILE}  ${DIM}(sample share)${RESET}`);
  console.log(`  ${MANIFEST_FILE}`);
  if (!existsSync(join(repoDir, '.git'))) {
    console.log(`  .gitignore`);
  }
  console.log();
  console.log(`${DIM}Next steps:${RESET}`);
  if (hasName) {
    console.log(`  1. ${TEXT}cd ${repoName}${RESET}`);
    console.log(`  2. ${TEXT}git init && gh repo create ${repoName} --public --source .${RESET}`);
    console.log(`  3. Edit ${TEXT}${SHARES_DIR}/${sampleSlug}/${SHARE_FILE}${RESET} or create a new share`);
    console.log(`  4. ${TEXT}npx shareful create${RESET} to add more shares`);
    console.log(`  5. ${TEXT}npx shareful publish${RESET} to publish`);
  } else {
    console.log(`  1. Edit ${TEXT}${SHARES_DIR}/${sampleSlug}/${SHARE_FILE}${RESET} or create a new share`);
    console.log(`  2. ${TEXT}npx shareful create${RESET} to add more shares`);
    console.log(`  3. ${TEXT}npx shareful publish${RESET} to publish`);
  }
  console.log();
}

async function runList(): Promise<void> {
  const cwd = process.cwd();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(`${DIM}No shares/ directory found. Run${RESET} ${TEXT}npx shareful init${RESET} ${DIM}first.${RESET}`);
    return;
  }

  let dirs: string[];
  try {
    dirs = readdirSync(sharesDir).filter((name) => {
      const fullPath = join(sharesDir, name);
      return statSync(fullPath).isDirectory() && existsSync(join(fullPath, SHARE_FILE));
    });
  } catch {
    console.log(`${DIM}Failed to read shares directory.${RESET}`);
    return;
  }

  if (dirs.length === 0) {
    console.log(`${DIM}No shares found. Run${RESET} ${TEXT}npx shareful create${RESET} ${DIM}to create one.${RESET}`);
    return;
  }

  console.log(`${BOLD}Shares${RESET} ${DIM}(${dirs.length})${RESET}`);
  console.log();

  for (const dir of dirs) {
    const sharePath = join(sharesDir, dir, SHARE_FILE);
    const share = await parseShareMd(sharePath);

    if (share) {
      const tags = share.frontmatter.tags.join(', ');
      console.log(`  ${CYAN}${share.frontmatter.slug}${RESET} ${DIM}[${share.frontmatter.solution_type}]${RESET}`);
      console.log(`    ${TEXT}${share.frontmatter.title}${RESET}`);
      console.log(`    ${DIM}${tags}${RESET}`);
    } else {
      console.log(`  ${DIM}${dir}${RESET} ${DIM}(invalid)${RESET}`);
    }
  }

  console.log();
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  switch (command) {
    case 'init':
      showLogo();
      console.log();
      runInit(restArgs);
      break;
    case 'create':
    case 'new':
      showLogo();
      console.log();
      await runCreate(restArgs);
      break;
    case 'publish':
    case 'push':
      showLogo();
      console.log();
      await runPublish();
      break;
    case 'list':
    case 'ls':
      await runList();
      break;
    case '--help':
    case '-h':
      showHelp();
      break;
    case '--version':
    case '-v':
      console.log(VERSION);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(`Run ${BOLD}shareful --help${RESET} for usage.`);
  }
}

main();
