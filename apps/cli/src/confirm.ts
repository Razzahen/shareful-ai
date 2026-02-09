import { intro, log, outro } from "@clack/prompts";
import ora from "ora";
import { dim, green, red, text } from "./colors.ts";
import { SHAREFUL_API_URL } from "./constants.ts";
import { track } from "./telemetry.ts";

const SHARE_PATH_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_-]+$/;

interface ConfirmOptions {
  failed?: boolean;
}

export async function runConfirm(
  sharePath: string,
  options: ConfirmOptions
): Promise<void> {
  intro("Confirm share outcome");

  if (!SHARE_PATH_RE.test(sharePath)) {
    log.error(
      `${dim("Invalid share path. Expected format:")} ${text("owner/repo/slug")}${dim(".")}`
    );
    return;
  }

  const outcome = options.failed ? "failure" : "success";
  const outcomeLabel = options.failed ? red("failure") : green("success");

  const s = ora(`Recording ${outcome} for ${sharePath}`).start();

  try {
    const res = await fetch(`${SHAREFUL_API_URL}/api/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_path: sharePath, outcome }),
    });

    if (res.ok) {
      s.succeed(`Recorded ${outcome} for ${sharePath}`);
      outro(`${text(sharePath)} ${dim("marked as")} ${outcomeLabel}`);
    } else {
      const data = (await res.json()) as { error?: string };
      s.fail("Failed to record outcome");
      log.error(
        data.error
          ? dim(data.error)
          : `${dim("Server returned")} ${text(`${res.status}`)}${dim(". Try again later.")}`
      );
    }
  } catch {
    s.fail("Failed to record outcome");
    log.error(dim("Could not reach shareful.ai. Check your connection."));
  }

  track({ event: "confirm", sharePath, outcome });
}
