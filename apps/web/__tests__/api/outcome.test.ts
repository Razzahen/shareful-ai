import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/reputation", () => ({
  recordOutcome: vi.fn(),
}));

import { POST } from "@/app/api/outcome/route";
import { recordOutcome } from "@/lib/reputation";

const mockRecordOutcome = vi.mocked(recordOutcome);

const URL = "http://localhost/api/outcome";

describe("POST /api/outcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns 400 when share_path is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { outcome: "success" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("share_path");
    });

    it("returns 400 when share_path is not a string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: 123, outcome: "success" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share_path is empty string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: "", outcome: "success" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when outcome is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: "a/b/c" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("outcome");
    });

    it("returns 400 when outcome is invalid value", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share_path: "a/b/c", outcome: "maybe" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share_path has 2 parts", async () => {
      const { status } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "owner/repo", outcome: "success" })
        )
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share_path has 4 parts", async () => {
      const { status } = await parseResponse(
        await POST(
          jsonRequest(URL, { share_path: "a/b/c/d", outcome: "success" })
        )
      );
      expect(status).toBe(400);
    });
  });

  describe("success", () => {
    it("returns 200 and records success outcome", async () => {
      mockRecordOutcome.mockResolvedValue(undefined);

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, {
            share_path: "alice/my-repo/fix-bug",
            outcome: "success",
          })
        )
      );

      expect(status).toBe(200);
      expect(body.message).toContain("success");
      expect(body.message).toContain("alice/my-repo/fix-bug");
      expect(mockRecordOutcome).toHaveBeenCalledWith(
        "alice",
        "my-repo",
        "fix-bug",
        "success"
      );
    });

    it("returns 200 and records failure outcome", async () => {
      mockRecordOutcome.mockResolvedValue(undefined);

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, {
            share_path: "alice/my-repo/fix-bug",
            outcome: "failure",
          })
        )
      );

      expect(status).toBe(200);
      expect(body.message).toContain("failure");
    });
  });

  describe("errors", () => {
    it("returns 500 when recordOutcome throws", async () => {
      mockRecordOutcome.mockRejectedValue(new Error("DB error"));

      const { status, body } = await parseResponse(
        await POST(
          jsonRequest(URL, {
            share_path: "a/b/c",
            outcome: "success",
          })
        )
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Failed to record outcome");
    });
  });
});
