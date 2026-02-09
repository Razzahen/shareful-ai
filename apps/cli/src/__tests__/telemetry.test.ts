import { afterEach, describe, expect, it } from "vitest";
import { isEnabled } from "../telemetry.ts";

describe("isEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true when no env vars are set", () => {
    process.env.DISABLE_TELEMETRY = undefined;
    process.env.DO_NOT_TRACK = undefined;
    expect(isEnabled()).toBe(true);
  });

  it("returns false when DISABLE_TELEMETRY is set", () => {
    process.env.DISABLE_TELEMETRY = "1";
    process.env.DO_NOT_TRACK = undefined;
    expect(isEnabled()).toBe(false);
  });

  it("returns false when DO_NOT_TRACK is set", () => {
    process.env.DISABLE_TELEMETRY = undefined;
    process.env.DO_NOT_TRACK = "1";
    expect(isEnabled()).toBe(false);
  });

  it("returns false when both are set", () => {
    process.env.DISABLE_TELEMETRY = "1";
    process.env.DO_NOT_TRACK = "1";
    expect(isEnabled()).toBe(false);
  });
});
