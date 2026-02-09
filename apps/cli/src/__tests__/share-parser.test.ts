import { describe, expect, it, vi } from "vitest";
import {
  generateSlug,
  validateBody,
  validateFrontmatter,
} from "../share-parser.ts";

function validFrontmatter() {
  return {
    title: "Fix Next.js hydration error",
    slug: "fix-nextjs-hydration-error",
    tags: ["nextjs", "react", "hydration"],
    problem: "Component using window throws hydration mismatch error",
    solution_type: "fix",
  };
}

const VALID_BODY = `## Problem

Some problem description.

## Solution

\`\`\`typescript
const x = 1;
\`\`\`

## Why It Works

Explanation here.

## Context

- Node 18+
`;

describe("generateSlug", () => {
  it("converts a normal title to kebab-case", () => {
    expect(generateSlug("Fix Next.js hydration error")).toBe(
      "fix-nextjs-hydration-error"
    );
  });

  it("strips special characters", () => {
    expect(generateSlug("Fix Docker build (v2)")).toBe("fix-docker-build-v2");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("hello world")).toBe("hello-world");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("-hello-")).toBe("hello");
  });

  it("truncates to 64 characters", () => {
    const longTitle = "a".repeat(100);
    expect(generateSlug(longTitle).length).toBeLessThanOrEqual(64);
  });

  it('returns "untitled-share" for empty string', () => {
    expect(generateSlug("")).toBe("untitled-share");
  });

  it('returns "untitled-share" for all-special-chars', () => {
    expect(generateSlug("!!!@@@###")).toBe("untitled-share");
  });

  it("lowercases uppercase letters", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });
});

describe("validateFrontmatter", () => {
  it("returns no errors for valid data", () => {
    expect(validateFrontmatter(validFrontmatter())).toEqual([]);
  });

  it("requires title", () => {
    const data = validFrontmatter();
    delete (data as Record<string, unknown>).title;
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("rejects title that is not a string", () => {
    const data = { ...validFrontmatter(), title: 123 };
    const errors = validateFrontmatter(data as Record<string, unknown>);
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("rejects title longer than 128 characters", () => {
    const data = { ...validFrontmatter(), title: "a".repeat(129) };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("accepts title at exactly 128 characters", () => {
    const data = { ...validFrontmatter(), title: "a".repeat(128) };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "title")).toBe(false);
  });

  it("requires slug", () => {
    const data = validFrontmatter();
    delete (data as Record<string, unknown>).slug;
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects slug longer than 64 characters", () => {
    const data = { ...validFrontmatter(), slug: "a".repeat(65) };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects slug with uppercase letters", () => {
    const data = { ...validFrontmatter(), slug: "Fix-Something" };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("rejects slug with underscores", () => {
    const data = { ...validFrontmatter(), slug: "fix_something" };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "slug")).toBe(true);
  });

  it("requires tags", () => {
    const data = validFrontmatter();
    delete (data as Record<string, unknown>).tags;
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects tags that are not an array", () => {
    const data = { ...validFrontmatter(), tags: "not-array" };
    const errors = validateFrontmatter(data as Record<string, unknown>);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects empty tags array", () => {
    const data = { ...validFrontmatter(), tags: [] };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects more than 10 tags", () => {
    const data = {
      ...validFrontmatter(),
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects tag longer than 32 characters", () => {
    const data = { ...validFrontmatter(), tags: ["a".repeat(33)] };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects tag with uppercase", () => {
    const data = { ...validFrontmatter(), tags: ["React"] };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("rejects tag that is not a string", () => {
    const data = { ...validFrontmatter(), tags: [123] };
    const errors = validateFrontmatter(data as Record<string, unknown>);
    expect(errors.some((e) => e.field === "tags")).toBe(true);
  });

  it("requires problem", () => {
    const data = validFrontmatter();
    delete (data as Record<string, unknown>).problem;
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "problem")).toBe(true);
  });

  it("rejects problem longer than 256 characters", () => {
    const data = { ...validFrontmatter(), problem: "a".repeat(257) };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "problem")).toBe(true);
  });

  it("requires solution_type", () => {
    const data = validFrontmatter();
    delete (data as Record<string, unknown>).solution_type;
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "solution_type")).toBe(true);
  });

  it("rejects invalid solution_type", () => {
    const data = { ...validFrontmatter(), solution_type: "invalid" };
    const errors = validateFrontmatter(data);
    expect(errors.some((e) => e.field === "solution_type")).toBe(true);
  });

  it("accepts all valid solution types", () => {
    for (const type of [
      "fix",
      "workaround",
      "pattern",
      "reference",
      "config",
    ]) {
      const data = { ...validFrontmatter(), solution_type: type };
      const errors = validateFrontmatter(data);
      expect(errors.some((e) => e.field === "solution_type")).toBe(false);
    }
  });
});

describe("validateBody", () => {
  it("returns no errors for valid body", () => {
    expect(validateBody(VALID_BODY)).toEqual([]);
  });

  it("reports missing ## Problem section", () => {
    const body = VALID_BODY.replace("## Problem", "## Issues");
    const errors = validateBody(body);
    expect(errors.some((e) => e.message.includes("## Problem"))).toBe(true);
  });

  it("reports missing ## Solution section", () => {
    const body = VALID_BODY.replace("## Solution", "## Fix");
    const errors = validateBody(body);
    expect(errors.some((e) => e.message.includes("## Solution"))).toBe(true);
  });

  it("reports missing ## Why It Works section", () => {
    const body = VALID_BODY.replace("## Why It Works", "## Explanation");
    const errors = validateBody(body);
    expect(errors.some((e) => e.message.includes("## Why It Works"))).toBe(
      true
    );
  });

  it("reports missing ## Context section", () => {
    const body = VALID_BODY.replace("## Context", "## Details");
    const errors = validateBody(body);
    expect(errors.some((e) => e.message.includes("## Context"))).toBe(true);
  });

  it("reports body exceeding 300 lines", () => {
    const body = `${VALID_BODY}\n${"line\n".repeat(300)}`;
    const errors = validateBody(body);
    expect(
      errors.some((e) => e.field === "body" && e.message.includes("300"))
    ).toBe(true);
  });

  it("reports multiple missing sections", () => {
    const errors = validateBody("No sections here");
    expect(errors.length).toBe(4);
  });
});

describe("parseShareMd", () => {
  it("parses a valid SHARE.md file", async () => {
    const validContent = `---
title: "Fix hydration error"
slug: fix-hydration-error
tags: [nextjs, react]
problem: "Hydration mismatch"
solution_type: fix
created: 2026-01-01
---

## Problem

Description.

## Solution

\`\`\`typescript
const x = 1;
\`\`\`

## Why It Works

Explanation.

## Context

- Node 18+
`;

    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue(validContent),
    }));

    const { parseShareMd: parse } = await import("../share-parser.ts");
    const result = await parse("/fake/path/SHARE.md");
    expect(result).not.toBeNull();
    expect(result?.frontmatter.title).toBe("Fix hydration error");
    expect(result?.frontmatter.slug).toBe("fix-hydration-error");

    vi.restoreAllMocks();
  });

  it("returns errors for invalid frontmatter with returnErrors=true", async () => {
    const invalidContent = `---
title: ""
slug: INVALID
tags: []
problem: ""
solution_type: invalid
---

## Problem

## Solution

## Why It Works

## Context
`;

    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue(invalidContent),
    }));

    const { parseShareMd: parse } = await import("../share-parser.ts");
    const result = await parse("/fake/path/SHARE.md", true);
    expect(result.share).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });
});
