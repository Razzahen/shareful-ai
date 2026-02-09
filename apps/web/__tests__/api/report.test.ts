import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: 1 }]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { POST } from "@/app/api/report/route";
import { isRateLimited } from "@/lib/rate-limit";

const mockIsRateLimited = vi.mocked(isRateLimited);

const URL = "http://localhost/api/report";

describe("POST /api/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  describe("validation", () => {
    it("returns 400 when target is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { reason: "spam" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("Target");
    });

    it("returns 400 when reason is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { target: "owner/repo" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("Reason");
    });

    it("returns 400 when target format is invalid", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { target: "just-one", reason: "spam" }))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("Invalid target");
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockIsRateLimited.mockReturnValue(true);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { target: "owner/repo", reason: "spam" }))
      );

      expect(status).toBe(429);
      expect(body.error).toContain("Rate limit");
    });
  });
});
