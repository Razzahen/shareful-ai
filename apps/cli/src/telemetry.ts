const TELEMETRY_URL = "https://shareful.ai/api/telemetry";

interface ShareTelemetryData {
  event: "share";
  slug?: string;
  shareCount: string;
}

interface InitRepoTelemetryData {
  event: "init-repo";
  repoName: string;
}

interface CheckTelemetryData {
  event: "check";
  validCount: string;
  errorCount: string;
}

interface AddSkillsTelemetryData {
  event: "add-skills";
}

type TelemetryData =
  | ShareTelemetryData
  | InitRepoTelemetryData
  | CheckTelemetryData
  | AddSkillsTelemetryData;

let cliVersion: string | null = null;

export function isEnabled(): boolean {
  return !(process.env.DISABLE_TELEMETRY || process.env.DO_NOT_TRACK);
}

export function setVersion(version: string): void {
  cliVersion = version;
}

export function track(data: TelemetryData): void {
  if (!isEnabled()) {
    return;
  }

  try {
    const params = new URLSearchParams();

    if (cliVersion) {
      params.set("v", cliVersion);
    }

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }

    fetch(`${TELEMETRY_URL}?${params.toString()}`).catch(() => {
      // Intentionally swallowed - telemetry must not affect CLI behavior
    });
  } catch {
    // Silently fail
  }
}
