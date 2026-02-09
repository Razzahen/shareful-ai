import { describe, expect, it } from "vitest";
import { parseShareMd } from "@/lib/share-parser";

function validShare() {
  return `---
title: "Fix Next.js hydration error"
slug: fix-nextjs-hydration-error
tags: [nextjs, react, hydration]
problem: "Component using window throws hydration mismatch error"
solution_type: fix
---

## Problem

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
}

function _withFrontmatter(overrides: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    title: "Fix Next.js hydration error",
    slug: "fix-nextjs-hydration-error",
    tags: "[nextjs, react]",
    problem: "Hydration mismatch",
    solution_type: "fix",
    ...overrides,
  };

  const lines = Object.entries(base).map(([key, value]) => {
    if (typeof value === "string" && !value.startsWith("[")) {
      return `${key}: "${value}"`;
    }
    return `${key}: ${value}`;
  });

  return `---
${lines.join("\n")}
---

## Problem

Description.

## Solution

Code here.

## Why It Works

Explanation.

## Context

- Node 18+
`;
}

describe("parseShareMd", () => {
  describe("valid input", () => {
    it("parses valid markdown and returns frontmatter + content", () => {
      const result = parseShareMd(validShare());
      expect(result.frontmatter.title).toBe("Fix Next.js hydration error");
      expect(result.frontmatter.slug).toBe("fix-nextjs-hydration-error");
      expect(result.frontmatter.tags).toEqual(["nextjs", "react", "hydration"]);
      expect(result.frontmatter.problem).toBe(
        "Component using window throws hydration mismatch error"
      );
      expect(result.frontmatter.solution_type).toBe("fix");
    });

    it("returns trimmed content without frontmatter", () => {
      const result = parseShareMd(validShare());
      expect(result.content).not.toContain("---");
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content).toBe(result.content.trim());
    });
  });

  describe("frontmatter validation", () => {
    it("throws when title is missing", () => {
      const raw = validShare().replace(
        'title: "Fix Next.js hydration error"\n',
        ""
      );
      expect(() => parseShareMd(raw)).toThrow("title");
    });

    it("throws when title is not a string", () => {
      const raw = validShare().replace(
        'title: "Fix Next.js hydration error"',
        "title: 123"
      );
      expect(() => parseShareMd(raw)).toThrow("title");
    });

    it("throws when slug is missing", () => {
      const raw = validShare().replace(
        "slug: fix-nextjs-hydration-error\n",
        ""
      );
      expect(() => parseShareMd(raw)).toThrow("slug");
    });

    it("throws when slug is not a string", () => {
      const raw = validShare().replace(
        "slug: fix-nextjs-hydration-error",
        "slug: 123"
      );
      expect(() => parseShareMd(raw)).toThrow("slug");
    });

    it("throws when tags is missing", () => {
      const raw = validShare().replace(
        "tags: [nextjs, react, hydration]\n",
        ""
      );
      expect(() => parseShareMd(raw)).toThrow("tags");
    });

    it("throws when tags is empty array", () => {
      const raw = validShare().replace(
        "tags: [nextjs, react, hydration]",
        "tags: []"
      );
      expect(() => parseShareMd(raw)).toThrow("tags");
    });

    it("throws when problem is missing", () => {
      const raw = validShare().replace(
        'problem: "Component using window throws hydration mismatch error"\n',
        ""
      );
      expect(() => parseShareMd(raw)).toThrow("problem");
    });

    it("throws when problem is not a string", () => {
      const raw = validShare().replace(
        'problem: "Component using window throws hydration mismatch error"',
        "problem: 123"
      );
      expect(() => parseShareMd(raw)).toThrow("problem");
    });

    it("throws when solution_type is missing", () => {
      const raw = validShare().replace("solution_type: fix\n", "");
      expect(() => parseShareMd(raw)).toThrow("solution_type");
    });

    it("throws when solution_type is invalid", () => {
      const raw = validShare().replace(
        "solution_type: fix",
        "solution_type: invalid"
      );
      expect(() => parseShareMd(raw)).toThrow("solution_type");
    });
  });

  describe("section validation", () => {
    it("throws when ## Problem is missing", () => {
      const raw = validShare().replace("## Problem", "## Issues");
      expect(() => parseShareMd(raw)).toThrow("## Problem");
    });

    it("throws when ## Solution is missing", () => {
      const raw = validShare().replace("## Solution", "## Fix");
      expect(() => parseShareMd(raw)).toThrow("## Solution");
    });

    it("throws when ## Why It Works is missing", () => {
      const raw = validShare().replace("## Why It Works", "## Explanation");
      expect(() => parseShareMd(raw)).toThrow("## Why It Works");
    });

    it("throws when ## Context is missing", () => {
      const raw = validShare().replace("## Context", "## Details");
      expect(() => parseShareMd(raw)).toThrow("## Context");
    });
  });

  describe("truncation and normalization", () => {
    it("truncates title to 128 chars", () => {
      const raw = validShare().replace(
        'title: "Fix Next.js hydration error"',
        `title: "${"a".repeat(200)}"`
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.title.length).toBe(128);
    });

    it("truncates slug to 64 chars", () => {
      const raw = validShare().replace(
        "slug: fix-nextjs-hydration-error",
        `slug: ${"a".repeat(100)}`
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.slug.length).toBe(64);
    });

    it("limits tags to 10 items", () => {
      const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      const raw = validShare().replace(
        "tags: [nextjs, react, hydration]",
        `tags: [${manyTags.join(", ")}]`
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.tags.length).toBe(10);
    });

    it("lowercases tags", () => {
      const raw = validShare().replace(
        "tags: [nextjs, react, hydration]",
        "tags: [NextJS, REACT]"
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.tags).toEqual(["nextjs", "react"]);
    });

    it("truncates individual tags to 32 chars", () => {
      const longTag = "a".repeat(50);
      const raw = validShare().replace(
        "tags: [nextjs, react, hydration]",
        `tags: [${longTag}]`
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.tags[0].length).toBe(32);
    });

    it("truncates problem to 256 chars", () => {
      const raw = validShare().replace(
        'problem: "Component using window throws hydration mismatch error"',
        `problem: "${"a".repeat(300)}"`
      );
      const result = parseShareMd(raw);
      expect(result.frontmatter.problem.length).toBe(256);
    });
  });

  describe("optional fields", () => {
    it("defaults verified to false when not specified", () => {
      const result = parseShareMd(validShare());
      expect(result.frontmatter.verified).toBe(false);
    });

    it("passes through optional fields", () => {
      const raw = `---
title: "Fix hydration"
slug: fix-hydration
tags: [nextjs]
problem: "Hydration error"
solution_type: fix
verified: true
created: "2025-01-01"
updated: "2025-06-01"
ai_provider: claude
environment:
  language: typescript
  framework: nextjs
  version: "14"
related: [other-fix]
---

## Problem

Description.

## Solution

Code here.

## Why It Works

Explanation.

## Context

- Node 18+
`;
      const result = parseShareMd(raw);
      expect(result.frontmatter.verified).toBe(true);
      expect(result.frontmatter.created).toBe("2025-01-01");
      expect(result.frontmatter.updated).toBe("2025-06-01");
      expect(result.frontmatter.ai_provider).toBe("claude");
      expect(result.frontmatter.environment).toEqual({
        language: "typescript",
        framework: "nextjs",
        version: "14",
      });
      expect(result.frontmatter.related).toEqual(["other-fix"]);
    });
  });

  describe("all valid solution_types", () => {
    for (const type of [
      "fix",
      "workaround",
      "pattern",
      "reference",
      "config",
    ]) {
      it(`accepts ${type}`, () => {
        const raw = validShare().replace(
          "solution_type: fix",
          `solution_type: ${type}`
        );
        const result = parseShareMd(raw);
        expect(result.frontmatter.solution_type).toBe(type);
      });
    }
  });
});
