import { describe, expect, it } from "vitest";
import { parseCreateOptions } from "../create.ts";

describe("parseCreateOptions", () => {
  it("returns empty object for no args", () => {
    expect(parseCreateOptions([])).toEqual({});
  });

  it("parses --title flag", () => {
    expect(parseCreateOptions(["--title", "My Title"])).toEqual({
      title: "My Title",
    });
  });

  it("parses -t shorthand", () => {
    expect(parseCreateOptions(["-t", "My Title"])).toEqual({
      title: "My Title",
    });
  });

  it("parses --problem flag", () => {
    expect(parseCreateOptions(["--problem", "A problem"])).toEqual({
      problem: "A problem",
    });
  });

  it("parses -p shorthand", () => {
    expect(parseCreateOptions(["-p", "A problem"])).toEqual({
      problem: "A problem",
    });
  });

  it("parses --tags flag", () => {
    expect(parseCreateOptions(["--tags", "nextjs,react"])).toEqual({
      tags: "nextjs,react",
    });
  });

  it("parses --type flag", () => {
    expect(parseCreateOptions(["--type", "fix"])).toEqual({ type: "fix" });
  });

  it("parses all flags combined", () => {
    const result = parseCreateOptions([
      "--title",
      "My Title",
      "--problem",
      "A problem",
      "--tags",
      "a,b",
      "--type",
      "fix",
    ]);
    expect(result).toEqual({
      title: "My Title",
      problem: "A problem",
      tags: "a,b",
      type: "fix",
    });
  });

  it("ignores flag without value", () => {
    expect(parseCreateOptions(["--title"])).toEqual({});
  });

  it("ignores unknown flags", () => {
    expect(parseCreateOptions(["--unknown", "value"])).toEqual({});
  });
});
