import { spawnSync } from "node:child_process";
import { SHAREFUL_API_URL } from "./constants.ts";

const GITHUB_REMOTE_RE = /github\.com[:/]([^/]+)\/([^/.]+)/;

export function getGitRemoteRepo(): { owner: string; repo: string } | null {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    return null;
  }
  const url = result.stdout.trim();
  const match = url.match(GITHUB_REMOTE_RE);
  if (!(match?.[1] && match[2])) {
    return null;
  }
  return { owner: match[1], repo: match[2] };
}

export function registerWithApi(owner: string, repo: string): void {
  fetch(`${SHAREFUL_API_URL}/api/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo: `${owner}/${repo}` }),
    // biome-ignore lint/suspicious/noEmptyBlockStatements: fire-and-forget
  }).catch(() => {});
}
