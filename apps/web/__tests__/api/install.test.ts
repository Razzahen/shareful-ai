import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, parseResponse } from "../helpers";

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  isRateLimited: vi.fn().mockReturnValue(false),
}));

import { POST } from "@/app/api/install/route";
import { isRateLimited } from "@/lib/rate-limit";

const mockIsRateLimited = vi.mocked(isRateLimited);

const URL = "http://localhost/api/install";

describe("POST /api/install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
  });

  describe("validation", () => {
    it("returns 400 when share is missing", async () => {
      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, {}))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("share");
    });

    it("returns 400 when share is not a string", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share: 123 }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share has two parts", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share: "owner/repo" }))
      );
      expect(status).toBe(400);
    });

    it("returns 400 when share has empty segments", async () => {
      const { status } = await parseResponse(
        await POST(jsonRequest(URL, { share: "owner//slug" }))
      );
      expect(status).toBe(400);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockIsRateLimited.mockReturnValue(true);

      const { status, body } = await parseResponse(
        await POST(jsonRequest(URL, { share: "owner/repo/slug" }))
      );

      expect(status).toBe(429);
      expect(body.error).toContain("Rate limit");
    });
  });

  describe("success", () => {
    it("returns 204 for valid share", async () => {
      const res = await POST(jsonRequest(URL, { share: "alice/shares/fix-1" }));
      expect(res.status).toBe(204);
    });
  });
});
