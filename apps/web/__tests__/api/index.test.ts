import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/registry", () => ({
  isRegistered: vi.fn(),
  registerRepo: vi.fn(),
  enqueueIndexJob: vi.fn(),
}));

import { POST } from "@/app/api/index/route";
import { enqueueIndexJob, isRegistered, registerRepo } from "@/lib/registry";

const mockIsRegistered = vi.mocked(isRegistered);
const mockRegisterRepo = vi.mocked(registerRepo);
const mockEnqueueIndexJob = vi.mocked(enqueueIndexJob);

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
    it("enqueues without registering when already registered", async () => {
      mockIsRegistered.mockResolvedValue(true);
      mockEnqueueIndexJob.mockResolvedValue(undefined);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(200);
      expect(body.message).toContain("Queued");
      expect(mockRegisterRepo).not.toHaveBeenCalled();
      expect(mockEnqueueIndexJob).toHaveBeenCalledWith("alice", "shares");
    });

    it("auto-registers and enqueues when not registered", async () => {
      mockIsRegistered.mockResolvedValue(false);
      mockRegisterRepo.mockResolvedValue(undefined as never);
      mockEnqueueIndexJob.mockResolvedValue(undefined);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(200);
      expect(body.message).toContain("Queued");
      expect(mockRegisterRepo).toHaveBeenCalledWith("alice", "shares");
      expect(mockEnqueueIndexJob).toHaveBeenCalledWith("alice", "shares");
    });
  });

  describe("errors", () => {
    it("returns 500 when enqueueIndexJob throws", async () => {
      mockIsRegistered.mockResolvedValue(true);
      mockEnqueueIndexJob.mockRejectedValue(new Error("Queue failed"));

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { repo: "alice/shares" }))
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Indexing failed");
    });
  });
});
