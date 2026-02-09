import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn().mockReturnValue("/home/testuser"),
}));

import { existsSync, readFileSync } from "node:fs";
import { getSharesRepoPath, loadConfig } from "../config.ts";

describe("loadConfig", () => {
  it("returns parsed config when file exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ sharesRepo: "/my/repo" })
    );

    const config = loadConfig();
    expect(config).toEqual({ sharesRepo: "/my/repo" });
  });

  it("returns empty object when file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = loadConfig();
    expect(config).toEqual({});
  });

  it("returns empty object when JSON is invalid", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("not json");

    const config = loadConfig();
    expect(config).toEqual({});
  });
});

describe("getSharesRepoPath", () => {
  it("returns configured sharesRepo when set", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ sharesRepo: "/my/repo" })
    );

    expect(getSharesRepoPath()).toBe("/my/repo");
  });

  it("returns process.cwd() when config is empty", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = getSharesRepoPath();
    expect(result).toBe(process.cwd());
  });
});
