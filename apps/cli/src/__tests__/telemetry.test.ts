import { afterEach, describe, expect, it } from "vitest";
import { isEnabled } from "../telemetry.ts";

describe("isEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true when no env vars are set", () => {
    delete process.env.DISABLE_TELEMETRY;
    delete process.env.DO_NOT_TRACK;
    expect(isEnabled()).toBe(true);
  });

  it("returns false when DISABLE_TELEMETRY is set", () => {
    process.env.DISABLE_TELEMETRY = "1";
    delete process.env.DO_NOT_TRACK;
    expect(isEnabled()).toBe(false);
  });

  it("returns false when DO_NOT_TRACK is set", () => {
    delete process.env.DISABLE_TELEMETRY;
    process.env.DO_NOT_TRACK = "1";
    expect(isEnabled()).toBe(false);
  });

  it("returns false when both are set", () => {
    process.env.DISABLE_TELEMETRY = "1";
    process.env.DO_NOT_TRACK = "1";
    expect(isEnabled()).toBe(false);
  });
});
