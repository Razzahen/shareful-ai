import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { dim, green, red, text } from "./colors.ts";
import { getSharesRepoPath } from "./config.ts";
import { SHARE_FILE, SHARES_DIR } from "./constants.ts";
import { parseShareMd } from "./share-parser.ts";

export async function runCheck(): Promise<void> {
  const cwd = getSharesRepoPath();
  const sharesDir = join(cwd, SHARES_DIR);

  if (!existsSync(sharesDir)) {
    console.log(
      `${dim("No shares/ directory found. Run")} ${text("npx shareful-ai init")} ${dim("first.")}`
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
    console.log(red("Failed to read shares directory."));
    process.exit(1);
  }

  if (shareDirs.length === 0) {
    console.log(
      `${dim("No shares found. Run")} ${text("npx shareful-ai create")} ${dim("to create one.")}`
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
      console.log(`  ${red("x")} ${dir}/${SHARE_FILE} - ${errorMsg}`);
      errorCount++;
      continue;
    }

    if (result.share.frontmatter.slug !== dir) {
      console.log(
        `  ${red("x")} ${dir}/${SHARE_FILE} - slug "${result.share.frontmatter.slug}" does not match directory "${dir}"`
      );
      errorCount++;
      continue;
    }

    console.log(`  ${green("+")} ${dir}`);
    validCount++;
  }

  console.log();
  console.log(
    `${text(`${validCount} valid`)}${errorCount > 0 ? red(`, ${errorCount} error(s)`) : ""}`
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}
