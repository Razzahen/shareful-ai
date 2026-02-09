import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/indexer", () => ({
  indexRepo: vi.fn(),
}));

vi.mock("@/lib/registry", () => ({
  isRegistered: vi.fn(),
  registerRepo: vi.fn(),
}));

import { POST } from "@/app/api/index/route";
import { indexRepo } from "@/lib/indexer";
import { isRegistered, registerRepo } from "@/lib/registry";

const mockIndexRepo = vi.mocked(indexRepo);
const mockIsRegistered = vi.mocked(isRegistered);
const mockRegisterRepo = vi.mocked(registerRepo);

const URL = "http://localhost/api/index";

describe("POST /api/index", () => {
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

    it("returns 400 when repo has single part", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "just-one" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when repo has empty owner", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "/repo" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when repo has empty repo name", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "owner/" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 for three-part repo path", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "a/b/c" }))
      );
      expect(status).toBe(400);
    });
  });

  describe("success", () => {
    it("indexes without registering when already registered", async () => {
      mockIsRegistered.mockResolvedValue(true);
      mockIndexRepo.mockResolvedValue(5);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(200);
      expect(body.indexed).toBe(5);
      expect(body.message).toContain("5");
      expect(mockRegisterRepo).not.toHaveBeenCalled();
      expect(mockIndexRepo).toHaveBeenCalledWith("alice", "shares");
    });

    it("auto-registers and indexes when not registered", async () => {
      mockIsRegistered.mockResolvedValue(false);
      mockRegisterRepo.mockResolvedValue(undefined as never);
      mockIndexRepo.mockResolvedValue(3);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(200);
      expect(body.indexed).toBe(3);
      expect(mockRegisterRepo).toHaveBeenCalledWith("alice", "shares");
    });
  });

  describe("errors", () => {
    it("returns 500 when indexRepo throws", async () => {
      mockIsRegistered.mockResolvedValue(true);
      mockIndexRepo.mockRejectedValue(new Error("Index failed"));

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Indexing failed");
    });
  });
});
