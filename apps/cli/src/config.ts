import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR, CONFIG_FILE } from "./constants.ts";

interface SharefulConfig {
  sharesRepo?: string;
}

function getConfigPath(): string {
  return join(homedir(), CONFIG_DIR, CONFIG_FILE);
}

function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR);
}

export function loadConfig(): SharefulConfig {
  const configPath = getConfigPath();
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

export function saveConfig(config: SharefulConfig): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(getConfigPath(), `${JSON.stringify(config, null, 2)}\n`);
}

export function getSharesRepoPath(): string {
  const config = loadConfig();
  return config.sharesRepo ?? process.cwd();
}
