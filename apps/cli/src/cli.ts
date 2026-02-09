#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "./check.ts";
import { runInitRepo } from "./init-repo.ts";
import { runSearch } from "./search.ts";
import { setVersion } from "./telemetry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

const VERSION = getVersion();
setVersion(VERSION);

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[38;5;102m";
const TEXT = "\x1b[38;5;145m";

const LOGO_LINES = [
  "███████╗██╗  ██╗ █████╗ ██████╗ ███████╗███████╗██╗   ██╗██╗     ",
  "██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝██║   ██║██║     ",
  "███████╗███████║███████║██████╔╝█████╗  █████╗  ██║   ██║██║     ",
  "╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  ██╔══╝  ██║   ██║██║     ",
  "███████║██║  ██║██║  ██║██║  ██║███████╗██║     ╚██████╔╝███████╗",
  "╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚══════╝",
];

const GRAYS = [
  "\x1b[38;5;250m",
  "\x1b[38;5;248m",
  "\x1b[38;5;245m",
  "\x1b[38;5;243m",
  "\x1b[38;5;240m",
  "\x1b[38;5;238m",
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
  console.log(`${DIM}Shared solutions for AI agents${RESET}`);
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful-ai init ${DIM}[name]${RESET}     ${DIM}Create a shares repo${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful-ai create${RESET}           ${DIM}Create a new share${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful-ai search ${DIM}<query>${RESET}   ${DIM}Search shareful.ai${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}npx shareful-ai check${RESET}            ${DIM}Validate shares${RESET}`
  );
  console.log();
  console.log(`Discover shares at ${TEXT}https://shareful.ai/${RESET}`);
  console.log();
}

function showHelp(): void {
  console.log(`
${BOLD}Usage:${RESET} shareful-ai <command> [options]

${BOLD}Commands:${RESET}
  init [name]         Create a new shares repository
  create              Create a new SHARE.md interactively
  search <query>      Search shareful.ai for shared solutions
  check               Validate all SHARE.md files

${BOLD}Create Options:${RESET}
  -t, --title <title>       Share title
  -p, --problem <problem>   One-sentence problem description
  --tags <tags>             Comma-separated tags
  --type <type>             Solution type: fix, workaround, pattern, reference, config

${BOLD}Options:${RESET}
  --help, -h        Show this help message
  --version, -v     Show version number

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} shareful-ai init my-shares
  ${DIM}$${RESET} shareful-ai create
  ${DIM}$${RESET} shareful-ai create -t "Fix hydration error" --tags "nextjs,react" --type fix -p "Hydration mismatch"
  ${DIM}$${RESET} shareful-ai search "hydration error"
  ${DIM}$${RESET} shareful-ai check

Discover shares at ${TEXT}https://shareful.ai/${RESET}
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  switch (command) {
    case "init":
    case "init-repo":
      showLogo();
      console.log();
      await runInitRepo(restArgs);
      break;
    case "create":
      showLogo();
      console.log();
      await runCreate(restArgs);
      break;
    case "search":
      showLogo();
      console.log();
      await runSearch(restArgs);
      break;
    case "check":
    case "validate":
      await runCheck();
      break;
    case "--help":
    case "-h":
      showHelp();
      break;
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(`Run ${BOLD}shareful-ai --help${RESET} for usage.`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
