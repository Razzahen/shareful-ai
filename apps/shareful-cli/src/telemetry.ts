const TELEMETRY_URL = 'https://shareful.ai/api/telemetry';

interface CreateTelemetryData {
  event: 'create';
  slug: string;
  solutionType: string;
}

interface PublishTelemetryData {
  event: 'publish';
  shareCount: string;
}

interface InitTelemetryData {
  event: 'init';
  repoName: string;
}

type TelemetryData = CreateTelemetryData | PublishTelemetryData | InitTelemetryData;

let cliVersion: string | null = null;

function isEnabled(): boolean {
  return !process.env.DISABLE_TELEMETRY && !process.env.DO_NOT_TRACK;
}

export function setVersion(version: string): void {
  cliVersion = version;
}

export function track(data: TelemetryData): void {
  if (!isEnabled()) return;

  try {
    const params = new URLSearchParams();

    if (cliVersion) {
      params.set('v', cliVersion);
    }

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }

    fetch(`${TELEMETRY_URL}?${params.toString()}`).catch(() => {});
  } catch {
    // Silently fail
  }
}
