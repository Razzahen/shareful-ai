import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MANIFEST_FILE,
  SHARE_FILE,
  SHAREFUL_INDEX_URL,
  SHARES_DIR,
} from "./constants.ts";
import { writeManifest } from "./manifest.ts";
import { parseShareMd } from "./share-parser.ts";
import { track } from "./telemetry.ts";
import type { ShareManifest, ShareManifestEntry } from "./types.ts";

const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;102m";
const TEXT = "\x1b[38;5;145m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";

const SSH_REMOTE_RE = /git@github\.com:(.+?\/.+?)(?:\.git)?$/;
const HTTPS_REMOTE_RE = /github\.com\/(.+?\/.+?)(?:\.git)?$/;

function getGitRemoteOwnerRepo(): string | null {
  try {
    const result = spawnSync("git", ["remote", "get-url", "origin"], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });

    if (result.status !== 0 || !result.stdout) {
      return null;
    }

    const url = result.stdout.trim();

    const sshMatch = url.match(SSH_REMOTE_RE);
    if (sshMatch?.[1]) {
      return sshMatch[1];
    }

    const httpsMatch = url.match(HTTPS_REMOTE_RE);
    if (httpsMatch?.[1]) {
      return httpsMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

async function collectShares(
  sharesDir: string
): Promise<{ entries: ShareManifestEntry[]; errorCount: number } | null> {
  let shareDirs: string[];
  try {
    shareDirs = readdirSync(sharesDir).filter((name) => {
      const fullPath = join(sharesDir, name);
      return statSync(fullPath).isDirectory();
    });
  } catch {
    console.log(`${RED}Failed to read shares directory.${RESET}`);
    return null;
  }

  if (shareDirs.length === 0) {
    console.log(
      `${DIM}No shares found. Run${RESET} ${TEXT}npx shareful create${RESET} ${DIM}to create one.${RESET}`
    );
    return null;
  }

  const entries: ShareManifestEntry[] = [];
  let errorCount = 0;

  for (const dir of shareDirs) {
    const sharePath = join(sharesDir, dir, SHARE_FILE);

    if (!existsSync(sharePath)) {
      continue;
    }

    const result = await parseShareMd(sharePath, true);
    if (!result.share) {
      const errorMsg = result.errors[0]?.message ?? "invalid SHARE.md";
      console.log(`  ${RED}x${RESET} ${dir}/${SHARE_FILE} - ${errorMsg}`);
      errorCount++;
      continue;
    }
    const share = result.share;

    if (share.frontmatter.slug !== dir) {
      console.log(
        `  ${RED}x${RESET} ${dir}/${SHARE_FILE} - slug "${share.frontmatter.slug}" does not match directory "${dir}"`
      );
      errorCount++;
      continue;
    }

    entries.push({
      slug: share.frontmatter.slug,
      title: share.frontmatter.title,
      tags: share.frontmatter.tags,
      problem: share.frontmatter.problem,
      solution_type: share.frontmatter.solution_type,
    });

    console.log(`  ${GREEN}+${RESET} ${dir}`);
  }

  return { entries, errorCount };
}

function gitCommitAndPush(cwd: string, entryCount: number): boolean {
  const addResult = spawnSync("git", ["add", SHARES_DIR, MANIFEST_FILE], {
    cwd,
    stdio: "pipe",
  });

  if (addResult.status !== 0) {
    console.log(
      `${RED}Failed to stage files. Are you in a git repository?${RESET}`
    );
    return false;
  }

  const diffResult = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    stdio: "pipe",
  });

  if (diffResult.status === 0) {
    console.log(`${DIM}No changes to commit.${RESET}`);
    return true;
  }

  const commitResult = spawnSync(
    "git",
    ["commit", "-m", `shareful: update ${entryCount} share(s)`],
    { cwd, stdio: "pipe" }
  );

  if (commitResult.status !== 0) {
    console.log(`${RED}Failed to commit changes.${RESET}`);
    return false;
  }

  const pushResult = spawnSync("git", ["push"], {
    cwd,
    stdio: "pipe",
  });

  if (pushResult.status !== 0) {
    console.log(
      `${RED}Failed to push. Try: ${TEXT}git push -u origin $(git branch --show-current)${RESET}`
    );
    return false;
  }

  console.log(`${GREEN}Pushed to GitHub.${RESET}`);
  return true;
}

export async function runPublish(): Promise<void> {
  const cwd = process.cwd();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(
      `${DIM}No shares/ directory found. Run${RESET} ${TEXT}npx shareful init${RESET} ${DIM}first.${RESET}`
    );
    return;
  }

  console.log(`${TEXT}Publishing shares...${RESET}`);
  console.log();

  const collected = await collectShares(sharesDir);
  if (!collected) {
    return;
  }

  const { entries, errorCount } = collected;

  if (errorCount > 0) {
    console.log();
    console.log(
      `${RED}${errorCount} share(s) have errors. Fix them before publishing.${RESET}`
    );
    return;
  }

  if (entries.length === 0) {
    console.log(`${DIM}No valid shares found.${RESET}`);
    return;
  }

  const ownerRepo = getGitRemoteOwnerRepo();
  const owner = ownerRepo?.split("/")[0] || "unknown";

  const manifest: ShareManifest = {
    version: 1,
    owner,
    shares: entries,
  };

  writeManifest(cwd, manifest);
  console.log();
  console.log(
    `${TEXT}Updated ${MANIFEST_FILE}${RESET} ${DIM}(${entries.length} share(s))${RESET}`
  );

  console.log();
  console.log(`${TEXT}Pushing to GitHub...${RESET}`);

  if (!gitCommitAndPush(cwd, entries.length)) {
    return;
  }

  if (ownerRepo) {
    console.log();
    console.log(`${TEXT}Notifying shareful.ai indexer...${RESET}`);

    try {
      const response = await fetch(SHAREFUL_INDEX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: ownerRepo }),
      });

      if (response.ok) {
        console.log(
          `${GREEN}Indexer notified. Your shares will be searchable shortly.${RESET}`
        );
      } else {
        console.log(
          `${DIM}Could not reach indexer (${response.status}). Shares are still on GitHub.${RESET}`
        );
      }
    } catch {
      console.log(
        `${DIM}Could not reach indexer. Shares are still on GitHub.${RESET}`
      );
    }
  }

  track({ event: "publish", shareCount: String(entries.length) });

  console.log();
  console.log(`${TEXT}Published ${entries.length} share(s).${RESET}`);
  if (ownerRepo) {
    console.log(`${DIM}View at: https://shareful.ai/s/${ownerRepo}${RESET}`);
  }
  console.log();
}
