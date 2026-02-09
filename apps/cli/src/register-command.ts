import { intro, log, outro, spinner } from "@clack/prompts";
import { DIM, RESET, TEXT } from "./colors.ts";
import { SHAREFUL_API_URL } from "./constants.ts";
import { getGitRemoteRepo } from "./register.ts";

export async function runRegister(args: string[]): Promise<void> {
  intro("Register repository");

  let owner: string;
  let repo: string;

  const explicit = args[0];
  if (explicit) {
    const parts = explicit.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      log.error(
        `${DIM}Invalid format. Use ${RESET}${TEXT}owner/repo${RESET}${DIM}.${RESET}`
      );
      return;
    }
    owner = parts[0];
    repo = parts[1];
  } else {
    const remote = getGitRemoteRepo();
    if (!remote) {
      log.error(
        `${DIM}Could not detect git remote. Provide ${RESET}${TEXT}owner/repo${RESET}${DIM} explicitly.${RESET}`
      );
      return;
    }
    owner = remote.owner;
    repo = remote.repo;
  }

  const s = spinner();
  s.start(`Registering ${owner}/${repo}`);

  try {
    const res = await fetch(`${SHAREFUL_API_URL}/api/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: `${owner}/${repo}` }),
    });

    if (res.ok) {
      s.stop(`Registered ${owner}/${repo}`);
      outro(
        `${TEXT}${owner}/${repo}${RESET}${DIM} queued for indexing on shareful.ai${RESET}`
      );
    } else {
      s.stop("Registration failed");
      log.error(
        `${DIM}Server returned ${RESET}${TEXT}${res.status}${RESET}${DIM}. Try again later.${RESET}`
      );
    }
  } catch {
    s.stop("Registration failed");
    log.error(
      `${DIM}Could not reach shareful.ai. Check your connection.${RESET}`
    );
  }
}
