import { spawn } from "node:child_process";
import { track } from "./telemetry.ts";

export function runAddSkills(): Promise<void> {
  track({ event: "add-skills" });

  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["-y", "skills", "add", "shareful-ai/skills", "--all", "-g"],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    child.on("error", () => {
      console.error("Could not run npx skills. Make sure npm is available.");
      resolve();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`skills exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}
