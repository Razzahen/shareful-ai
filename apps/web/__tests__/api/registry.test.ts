import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/registry", () => ({
  listRepos: vi.fn(),
  registerRepo: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  discoverShareSlugs: vi.fn(),
}));

vi.mock("@/lib/indexer", () => ({
  indexRepo: vi.fn(),
}));

import { GET, POST } from "@/app/api/registry/route";
import { discoverShareSlugs } from "@/lib/github";
import { indexRepo } from "@/lib/indexer";
import { listRepos, registerRepo } from "@/lib/registry";

const mockListRepos = vi.mocked(listRepos);
const mockRegisterRepo = vi.mocked(registerRepo);
const mockDiscoverShareSlugs = vi.mocked(discoverShareSlugs);
const mockIndexRepo = vi.mocked(indexRepo);

const URL = "http://localhost/api/registry";

describe("GET /api/registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with list of repos", async () => {
    mockListRepos.mockResolvedValue([
      { owner: "alice", repo: "shares", indexed_at: "2025-01-01T00:00:00Z" },
    ]);

    const _req = new Request(URL);
    const { status, body } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(body.repos).toHaveLength(1);
    expect(body.repos[0].owner).toBe("alice");
  });

  it("returns 500 when listRepos throws", async () => {
    mockListRepos.mockRejectedValue(new Error("DB error"));

    const { status, body } = await parseResponse(await GET());

    expect(status).toBe(500);
    expect(body.error).toBe("Failed to list repos");
  });
});

describe("POST /api/registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 when repo is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, {}))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("repo");
    });

    it("returns 400 when repo is not a string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: 123 }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when repo has wrong format", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "just-one" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when repo has empty segments", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "/repo" }))
      );
      expect(status).toBe(400);
    });
  });

  describe("share discovery check", () => {
    it("returns 400 when no shares are found", async () => {
      mockDiscoverShareSlugs.mockResolvedValue([]);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(400);
      expect(body.error).toContain("No shares found");
    });
  });

  describe("success", () => {
    it("returns 200 with registered repo and indexed count", async () => {
      mockDiscoverShareSlugs.mockResolvedValue(["fix-1", "fix-2", "fix-3"]);
      mockRegisterRepo.mockResolvedValue({
        owner: "alice",
        repo: "shares",
        indexed_at: "2025-01-01T00:00:00Z",
      });
      mockIndexRepo.mockResolvedValue(3);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(200);
      expect(body.message).toContain("alice/shares");
      expect(body.message).toContain("3");
      expect(body.entry.owner).toBe("alice");
      expect(body.indexed).toBe(3);
    });
  });

  describe("errors", () => {
    it("returns 500 when registerRepo throws", async () => {
      mockDiscoverShareSlugs.mockResolvedValue(["fix-1"]);
      mockRegisterRepo.mockRejectedValue(new Error("DB error"));

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Registration failed");
    });
  });
});
