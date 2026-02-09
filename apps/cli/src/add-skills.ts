import { spawn } from "node:child_process";
import { track } from "./telemetry.ts";

export function runSkills(args: string[]): Promise<void> {
  track({ event: "skills", args: args.join(" ") });

  const skillsArgs =
    args.length > 0 ? args : ["add", "shareful-ai/skills", "--all", "-g"];

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "skills@latest", ...skillsArgs], {
      stdio: "inherit",
      shell: true,
    });

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
