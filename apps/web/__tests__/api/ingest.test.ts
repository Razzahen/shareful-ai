import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/dedupe/embeddings", () => ({
  createConfiguredEmbeddingProvider: vi.fn(),
}));
vi.mock("@/lib/dedupe/ingest", () => ({
  ingestProblemSolution: vi.fn(),
}));
vi.mock("@/lib/dedupe/judge", () => ({
  createConfiguredJudge: vi.fn(),
}));
vi.mock("@/lib/dedupe/store", () => ({
  createDrizzleDedupeStore: vi.fn(),
}));

import { POST } from "@/app/api/ingest/route";
import { createConfiguredEmbeddingProvider } from "@/lib/dedupe/embeddings";
import { ingestProblemSolution } from "@/lib/dedupe/ingest";
import { createConfiguredJudge } from "@/lib/dedupe/judge";
import { createDrizzleDedupeStore } from "@/lib/dedupe/store";

const mockIngest = vi.mocked(ingestProblemSolution);
const URL = "http://localhost/api/ingest";

function jsonAuthedRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: "Bearer secret",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUBMIT_SECRET = "secret";
  });

  it("returns 401 when SUBMIT_SECRET is set and auth is missing", async () => {
    process.env.SUBMIT_SECRET = "secret";
    const req = jsonRequest(URL, { problem: "p", solution: "s" });
    const { status } = await parseResponse(await POST(req));
    expect(status).toBe(401);
  });

  it("returns 400 when problem is missing", async () => {
    const { status, body } = await parseResponse(
      await POST(jsonAuthedRequest(URL, { solution: "s" }))
    );
    expect(status).toBe(400);
    expect(body.error).toContain("problem");
  });

  it("returns 400 when solution is missing", async () => {
    const { status, body } = await parseResponse(
      await POST(jsonAuthedRequest(URL, { problem: "p" }))
    );
    expect(status).toBe(400);
    expect(body.error).toContain("solution");
  });

  it("returns 503 when OPENAI is not configured", async () => {
    mockIngest.mockRejectedValue(new Error("Missing OPENAI_API_KEY"));
    const { status, body } = await parseResponse(
      await POST(jsonAuthedRequest(URL, { problem: "p", solution: "s" }))
    );
    expect(status).toBe(503);
    expect(body.error).toBe("LLM not configured");
  });

  it("passes submission through and returns result", async () => {
    vi.mocked(createDrizzleDedupeStore).mockReturnValue({} as never);
    vi.mocked(createConfiguredEmbeddingProvider).mockReturnValue({} as never);
    vi.mocked(createConfiguredJudge).mockReturnValue({} as never);

    mockIngest.mockResolvedValue({
      submissionId: 1,
      problem: {
        id: 10,
        action: "created",
        judge: {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "x",
        },
      },
      solution: {
        id: 20,
        action: "created",
        judge: {
          decision: "new",
          matchId: null,
          confidence: 0,
          rationale: "x",
        },
      },
      link: {
        problemId: 10,
        solutionId: 20,
        action: "created",
        seenCount: 1,
      },
    });

    const { status, body } = await parseResponse(
      await POST(
        jsonAuthedRequest(URL, {
          problem: "Problem",
          solution: "Solution",
          language: "typescript",
          framework: "nextjs",
          errorSignature: "Hydration failed",
          metadata: { a: 1 },
        })
      )
    );

    expect(status).toBe(200);
    expect(body.problem.id).toBe(10);
    expect(mockIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        submission: expect.objectContaining({
          problem: "Problem",
          solution: "Solution",
          language: "typescript",
          framework: "nextjs",
          errorSignature: "Hydration failed",
        }),
      })
    );
  });
});
