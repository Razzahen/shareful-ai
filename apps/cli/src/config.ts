import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR, CONFIG_FILE } from "./constants.ts";

interface SharefulConfig {
  sharesRepo?: string;
}

function loadConfig(): SharefulConfig {
  const configPath = join(homedir(), CONFIG_DIR, CONFIG_FILE);
  try {
    if (!existsSync(configPath)) {
      return {};
    }
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as SharefulConfig;
  } catch {
    return {};
  }
}

export function getSharesRepoPath(): string {
  const config = loadConfig();
  return config.sharesRepo ?? process.cwd();
}
