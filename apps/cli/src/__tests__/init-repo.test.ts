import { describe, expect, it } from "vitest";

// Test the validation logic directly since runInitRepo is async/interactive
const PROJECT_NAME_RE = /^[a-z0-9._-]+$/i;
const MAX_NAME_LENGTH = 128;

function validateProjectName(value: string): string | undefined {
  if (!value) {
    return "Project name is required";
  }
  if (value.length > MAX_NAME_LENGTH) {
    return `Project name must be at most ${MAX_NAME_LENGTH} characters`;
  }
  if (!PROJECT_NAME_RE.test(value)) {
    return "Project name can only contain letters, numbers, dots, hyphens, and underscores";
  }
}

describe("validateProjectName", () => {
  it("accepts valid names", () => {
    expect(validateProjectName("my-shares")).toBeUndefined();
    expect(validateProjectName("my_shares")).toBeUndefined();
    expect(validateProjectName("my.shares")).toBeUndefined();
    expect(validateProjectName("MyShares")).toBeUndefined();
    expect(validateProjectName("shares123")).toBeUndefined();
  });

  it("rejects empty name", () => {
    expect(validateProjectName("")).toBe("Project name is required");
  });

  it("rejects names with spaces", () => {
    expect(validateProjectName("my shares")).toBe(
      "Project name can only contain letters, numbers, dots, hyphens, and underscores"
    );
  });

  it("rejects names with slashes", () => {
    expect(validateProjectName("my/shares")).toBe(
      "Project name can only contain letters, numbers, dots, hyphens, and underscores"
    );
  });

  it("rejects names with special characters", () => {
    expect(validateProjectName("my@shares")).toBeDefined();
    expect(validateProjectName("my#shares")).toBeDefined();
  });

  it("rejects names exceeding max length", () => {
    const longName = "a".repeat(MAX_NAME_LENGTH + 1);
    expect(validateProjectName(longName)).toBe(
      `Project name must be at most ${MAX_NAME_LENGTH} characters`
    );
  });

  it("accepts names at max length", () => {
    const maxName = "a".repeat(MAX_NAME_LENGTH);
    expect(validateProjectName(maxName)).toBeUndefined();
  });
});
