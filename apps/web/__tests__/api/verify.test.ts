import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/reputation", () => ({
  recordVerification: vi.fn(),
}));

import { POST } from "@/app/api/verify/route";
import { recordVerification } from "@/lib/reputation";

const mockRecordVerification = vi.mocked(recordVerification);

const URL = "http://localhost/api/verify";

describe("POST /api/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 when share_path is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { github_user: "alice" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("share_path");
    });

    it("returns 400 when share_path is not a string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: 42, github_user: "alice" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when github_user is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: "a/b/c" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("github_user");
    });

    it("returns 400 when github_user is not a string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: "a/b/c", github_user: 42 }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share_path has wrong part count", async () => {
      const { status } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "owner/repo", github_user: "alice" })
        )
      );
      expect(status).toBe(400);
    });
  });

  describe("success", () => {
    it("returns 200 with 'Verification recorded' for new verification", async () => {
      mockRecordVerification.mockResolvedValue({
        count: 1,
        alreadyVerified: false,
      });

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "a/b/c", github_user: "alice" })
        )
      );

      expect(status).toBe(200);
      expect(body.message).toBe("Verification recorded");
      expect(body.count).toBe(1);
    });

    it("returns 200 with 'Already verified' for duplicate", async () => {
      mockRecordVerification.mockResolvedValue({
        count: 3,
        alreadyVerified: true,
      });

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "a/b/c", github_user: "alice" })
        )
      );

      expect(status).toBe(200);
      expect(body.message).toBe("Already verified by this user");
      expect(body.count).toBe(3);
    });

    it("passes correct args to recordVerification", async () => {
      mockRecordVerification.mockResolvedValue({
        count: 1,
        alreadyVerified: false,
      });

      await POST(
        jsonRequest(URL, {
          share_path: "alice/repo/my-slug",
          github_user: "bob",
        })
      );

      expect(mockRecordVerification).toHaveBeenCalledWith(
        "alice",
        "repo",
        "my-slug",
        "bob"
      );
    });
  });

  describe("errors", () => {
    it("returns 500 when recordVerification throws", async () => {
      mockRecordVerification.mockRejectedValue(new Error("DB error"));

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "a/b/c", github_user: "alice" })
        )
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to record verification");
    });
  });
});
