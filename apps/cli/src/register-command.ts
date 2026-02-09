import { intro, log, outro } from "@clack/prompts";
import ora from "ora";
import { dim, text } from "./colors.ts";
import { SHAREFUL_API_URL } from "./constants.ts";
import { getGitRemoteRepo } from "./register.ts";

export async function runRegister(ownerRepo?: string): Promise<void> {
  intro("Register repository");

  let owner: string;
  let repo: string;

  if (ownerRepo) {
    const parts = ownerRepo.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      log.error(
        `${dim("Invalid format. Use")} ${text("owner/repo")}${dim(".")}`
      );
      return;
    }
    owner = parts[0];
    repo = parts[1];
  } else {
    const remote = getGitRemoteRepo();
    if (!remote) {
      log.error(
        `${dim("Could not detect git remote. Provide")} ${text("owner/repo")} ${dim("explicitly.")}`
      );
      return;
    }
    owner = remote.owner;
    repo = remote.repo;
  }

  const s = ora(`Registering ${owner}/${repo}`).start();

  try {
    const res = await fetch(`${SHAREFUL_API_URL}/api/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: `${owner}/${repo}` }),
    });

    if (res.ok) {
      s.succeed(`Registered ${owner}/${repo}`);
      outro(
        `${text(`${owner}/${repo}`)} ${dim("queued for indexing on shareful.ai")}`
      );
    } else {
      s.fail("Registration failed");
      log.error(
        `${dim("Server returned")} ${text(`${res.status}`)}${dim(". Try again later.")}`
      );
    }
  } catch {
    s.fail("Registration failed");
    log.error(dim("Could not reach shareful.ai. Check your connection."));
  }
}
