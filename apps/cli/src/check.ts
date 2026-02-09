import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DIM, GREEN, RED, RESET, TEXT } from "./colors.ts";
import { getSharesRepoPath } from "./config.ts";
import { SHARE_FILE, SHARES_DIR } from "./constants.ts";
import { parseShareMd } from "./share-parser.ts";

export async function runCheck(): Promise<void> {
  const cwd = getSharesRepoPath();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(
      `${DIM}No shares/ directory found. Run${RESET} ${TEXT}npx shareful-ai init${RESET} ${DIM}first.${RESET}`
    );
    return;
  }

  let shareDirs: string[];
  try {
    shareDirs = readdirSync(sharesDir).filter((name) => {
      const fullPath = join(sharesDir, name);
      return statSync(fullPath).isDirectory();
    });
  } catch {
    console.log(`${RED}Failed to read shares directory.${RESET}`);
    process.exit(1);
  }

  if (shareDirs.length === 0) {
    console.log(
      `${DIM}No shares found. Run${RESET} ${TEXT}npx shareful-ai create${RESET} ${DIM}to create one.${RESET}`
    );
    return;
  }

  let validCount = 0;
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

    if (result.share.frontmatter.slug !== dir) {
      console.log(
        `  ${RED}x${RESET} ${dir}/${SHARE_FILE} - slug "${result.share.frontmatter.slug}" does not match directory "${dir}"`
      );
      errorCount++;
      continue;
    }

    console.log(`  ${GREEN}+${RESET} ${dir}`);
    validCount++;
  }

  console.log();
  console.log(
    `${TEXT}${validCount} valid${RESET}${errorCount > 0 ? `${RED}, ${errorCount} error(s)${RESET}` : ""}`
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}
