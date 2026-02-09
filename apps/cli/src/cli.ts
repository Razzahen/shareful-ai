#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { runSkills } from "./add-skills.ts";
import { runCheck } from "./check.ts";
import { runConfirm } from "./confirm.ts";
import { runCreate } from "./create.ts";
import { runInitRepo } from "./init.ts";
import { runRegister } from "./register-command.ts";
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

const program = new Command();

program
  .name("shareful-ai")
  .description("Shared solutions for AI agents")
  .version(VERSION, "-v, --version")
  .addHelpText("after", "\nDiscover shares at https://shareful.ai/");

program
  .command("init [name]")
  .alias("init-repo")
  .description("Create a new shares repository")
  .action(async (name?: string) => {
    await runInitRepo(name);
  });

program
  .command("create")
  .description("Create a new SHARE.md interactively")
  .option("-t, --title <title>", "Share title")
  .option("-p, --problem <problem>", "One-sentence problem description")
  .option("--tags <tags>", "Comma-separated tags")
  .option(
    "--type <type>",
    "Solution type: fix, workaround, pattern, reference, config"
  )
  .action(async (options) => {
    await runCreate(options);
  });

program
  .command("search <query...>")
  .description("Search shareful.ai for shared solutions")
  .option("--type <type>", "Filter by solution type")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("--limit <n>", "Max results (default: 5)")
  .action(async (queryParts: string[], options) => {
    await runSearch(queryParts.join(" "), options);
  });

program
  .command("confirm <share_path>")
  .description("Report whether a share worked (success/failure)")
  .option("--failed", "Report that the share did not work")
  .action(async (sharePath: string, options: { failed?: boolean }) => {
    await runConfirm(sharePath, options);
  });

program
  .command("register [owner-repo]")
  .description("Register a repo for indexing on shareful.ai")
  .action(async (ownerRepo?: string) => {
    await runRegister(ownerRepo);
  });

program
  .command("check")
  .alias("validate")
  .description("Validate all SHARE.md files")
  .action(async () => {
    await runCheck();
  });

program
  .command("skills [command...]")
  .description("Manage agent skills (add, remove, list, find, check, update)")
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (args: string[]) => {
    await runSkills(args);
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message || err);
  process.exit(1);
});
