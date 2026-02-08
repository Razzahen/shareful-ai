import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { parseShareMd, validateBody } from './share-parser.ts';
import { writeManifest } from './manifest.ts';
import { SHARES_DIR, SHARE_FILE, SHAREFUL_INDEX_URL, MANIFEST_FILE } from './constants.ts';
import { track } from './telemetry.ts';
import type { ShareManifest, ShareManifestEntry } from './types.ts';

const RESET = '\x1b[0m';
const DIM = '\x1b[38;5;102m';
const TEXT = '\x1b[38;5;145m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';

function getGitRemoteOwnerRepo(): string | null {
  try {
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });

    if (result.status !== 0 || !result.stdout) return null;

    const url = result.stdout.trim();

    // Handle git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:(.+?\/.+?)(?:\.git)?$/);
    if (sshMatch?.[1]) return sshMatch[1];

    // Handle https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/(.+?\/.+?)(?:\.git)?$/);
    if (httpsMatch?.[1]) return httpsMatch[1];

    return null;
  } catch {
    return null;
  }
}

export async function runPublish(): Promise<void> {
  const cwd = process.cwd();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(`${DIM}No shares/ directory found. Run${RESET} ${TEXT}npx shareful init${RESET} ${DIM}first.${RESET}`);
    return;
  }

  console.log(`${TEXT}Publishing shares...${RESET}`);
  console.log();

  // Walk shares/ and parse all SHARE.md files
  const entries: ShareManifestEntry[] = [];
  let errorCount = 0;

  let shareDirs: string[];
  try {
    shareDirs = readdirSync(sharesDir).filter((name) => {
      const fullPath = join(sharesDir, name);
      return statSync(fullPath).isDirectory();
    });
  } catch {
    console.log(`${RED}Failed to read shares directory.${RESET}`);
    return;
  }

  if (shareDirs.length === 0) {
    console.log(`${DIM}No shares found. Run${RESET} ${TEXT}npx shareful create${RESET} ${DIM}to create one.${RESET}`);
    return;
  }

  for (const dir of shareDirs) {
    const sharePath = join(sharesDir, dir, SHARE_FILE);

    if (!existsSync(sharePath)) {
      continue;
    }

    const share = await parseShareMd(sharePath);
    if (!share) {
      console.log(`  ${RED}x${RESET} ${dir}/${SHARE_FILE} - invalid frontmatter`);
      errorCount++;
      continue;
    }

    // Validate body
    const bodyErrors = validateBody(share.content);
    if (bodyErrors.length > 0) {
      console.log(`  ${RED}x${RESET} ${dir}/${SHARE_FILE} - ${bodyErrors[0]?.message}`);
      errorCount++;
      continue;
    }

    // Check slug matches directory name
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

  if (errorCount > 0) {
    console.log();
    console.log(`${RED}${errorCount} share(s) have errors. Fix them before publishing.${RESET}`);
    return;
  }

  if (entries.length === 0) {
    console.log(`${DIM}No valid shares found.${RESET}`);
    return;
  }

  // Get owner from git remote
  const ownerRepo = getGitRemoteOwnerRepo();
  const owner = ownerRepo?.split('/')[0] || 'unknown';

  // Write manifest
  const manifest: ShareManifest = {
    version: 1,
    owner,
    shares: entries,
  };

  writeManifest(cwd, manifest);
  console.log();
  console.log(`${TEXT}Updated ${MANIFEST_FILE}${RESET} ${DIM}(${entries.length} share(s))${RESET}`);

  // Git add, commit, push via gh/git
  console.log();
  console.log(`${TEXT}Pushing to GitHub...${RESET}`);

  const addResult = spawnSync('git', ['add', SHARES_DIR, MANIFEST_FILE], {
    cwd,
    stdio: 'pipe',
  });

  if (addResult.status !== 0) {
    console.log(`${RED}Failed to stage files. Are you in a git repository?${RESET}`);
    return;
  }

  // Check if there are changes to commit
  const diffResult = spawnSync('git', ['diff', '--cached', '--quiet'], {
    cwd,
    stdio: 'pipe',
  });

  if (diffResult.status === 0) {
    console.log(`${DIM}No changes to commit.${RESET}`);
  } else {
    const commitResult = spawnSync(
      'git',
      ['commit', '-m', `shareful: update ${entries.length} share(s)`],
      { cwd, stdio: 'pipe' }
    );

    if (commitResult.status !== 0) {
      console.log(`${RED}Failed to commit changes.${RESET}`);
      return;
    }

    const pushResult = spawnSync('git', ['push'], {
      cwd,
      stdio: 'pipe',
    });

    if (pushResult.status !== 0) {
      console.log(`${RED}Failed to push. Try pushing manually with ${TEXT}git push${RESET}`);
      return;
    }

    console.log(`${GREEN}Pushed to GitHub.${RESET}`);
  }

  // Ping indexer
  if (ownerRepo) {
    console.log();
    console.log(`${TEXT}Notifying shareful.ai indexer...${RESET}`);

    try {
      const response = await fetch(SHAREFUL_INDEX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: ownerRepo }),
      });

      if (response.ok) {
        console.log(`${GREEN}Indexer notified. Your shares will be searchable shortly.${RESET}`);
      } else {
        console.log(`${DIM}Could not reach indexer (${response.status}). Shares are still on GitHub.${RESET}`);
      }
    } catch {
      console.log(`${DIM}Could not reach indexer. Shares are still on GitHub.${RESET}`);
    }
  }

  track({ event: 'publish', shareCount: String(entries.length) });

  console.log();
  console.log(`${TEXT}Published ${entries.length} share(s).${RESET}`);
  if (ownerRepo) {
    console.log(`${DIM}View at: https://shareful.ai/s/${ownerRepo}${RESET}`);
  }
  console.log();
}
