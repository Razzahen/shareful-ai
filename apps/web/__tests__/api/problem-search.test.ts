import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "../helpers";

vi.mock("@/lib/dedupe/embeddings", () => ({
  createConfiguredEmbeddingProvider: vi.fn(),
}));
vi.mock("@/lib/dedupe/judge", () => ({
  createConfiguredJudge: vi.fn(),
}));
vi.mock("@/lib/dedupe/problem-search", () => ({
  searchProblemSolutions: vi.fn(),
}));
vi.mock("@/lib/dedupe/store", () => ({
  createDrizzleDedupeStore: vi.fn(),
}));

import { GET } from "@/app/api/problem-search/route";
import { createConfiguredEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { searchProblemSolutions } from "@/lib/dedupe/problem-search";
import { createDrizzleDedupeStore } from "@/lib/dedupe/store";

const mockSearch = vi.mocked(searchProblemSolutions);
const URL = "http://localhost/api/problem-search";

describe("GET /api/problem-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when q is missing", async () => {
    const { status, body } = await parseResponse(await GET(new Request(URL)));
    expect(status).toBe(400);
    expect(body.error).toContain("q");
  });

  it("returns 503 when OPENAI is not configured", async () => {
    mockSearch.mockRejectedValue(new Error("Missing OPENAI_API_KEY"));
    const { status, body } = await parseResponse(
      await GET(new Request(`${URL}?q=test`))
    );
    expect(status).toBe(503);
    expect(body.error).toBe("LLM not configured");
  });

  it("passes query through and returns result", async () => {
    vi.mocked(createDrizzleDedupeStore).mockReturnValue({} as never);
    vi.mocked(createConfiguredEmbeddingProvider).mockReturnValue({} as never);
    vi.mocked(createConfiguredJudge).mockReturnValue({} as never);

    mockSearch.mockResolvedValue({
      query: { problem: "p", language: "typescript" },
      exact: null,
      related: [],
    });

    const { status, body } = await parseResponse(
      await GET(new Request(`${URL}?q=p&language=typescript&limit=3&strict=0`))
    );

    expect(status).toBe(200);
    expect(body.query.problem).toBe("p");
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          problem: "p",
          language: "typescript",
        }),
        strict: false,
      })
    );
  });
});
