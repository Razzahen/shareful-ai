import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "../helpers";

vi.mock("@/lib/search", () => ({
  searchShares: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { searchShares } from "@/lib/search";

const mockSearchShares = vi.mocked(searchShares);

function searchRequest(params: string) {
  return new Request(`http://localhost/api/search${params}`);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchShares.mockResolvedValue({
      shares: [],
      total: 0,
      nextCursor: null,
    });
  });

  describe("validation", () => {
    it("returns 400 when q param is missing", async () => {
      const { status, body } = await parseResponse(
        await GET(searchRequest(""))
      );
      expect(status).toBe(400);
      expect(body.error).toContain("q");
    });

    it("returns 400 when q param is empty string", async () => {
      const { status } = await parseResponse(await GET(searchRequest("?q=")));
      expect(status).toBe(400);
    });

    it("returns 400 when q param is whitespace only", async () => {
      const { status } = await parseResponse(
        await GET(searchRequest("?q=%20%20"))
      );
      expect(status).toBe(400);
    });
  });

  describe("query parameter parsing", () => {
    it("passes valid type to searchShares", async () => {
      await GET(searchRequest("?q=test&type=fix"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: "fix",
        tags: undefined,
        limit: 10,
        cursor: undefined,
      });
    });

    it("ignores invalid type value", async () => {
      await GET(searchRequest("?q=test&type=bogus"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: undefined,
        tags: undefined,
        limit: 10,
        cursor: undefined,
      });
    });

    it("defaults limit to 10", async () => {
      await GET(searchRequest("?q=test"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: undefined,
        tags: undefined,
        limit: 10,
        cursor: undefined,
      });
    });

    it("caps limit at 50", async () => {
      await GET(searchRequest("?q=test&limit=100"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: undefined,
        tags: undefined,
        limit: 50,
        cursor: undefined,
      });
    });

    it("handles NaN limit by defaulting to 10", async () => {
      await GET(searchRequest("?q=test&limit=abc"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: undefined,
        tags: undefined,
        limit: 10,
        cursor: undefined,
      });
    });

    it("parses comma-separated tags", async () => {
      await GET(searchRequest("?q=test&tags=react,nextjs"));

      expect(mockSearchShares).toHaveBeenCalledWith("test", {
        type: undefined,
        tags: ["react", "nextjs"],
        limit: 10,
        cursor: undefined,
      });
    });

    it("filters empty tags from comma-split", async () => {
      await GET(searchRequest("?q=test&tags=react,,nextjs,"));

      const callArgs = mockSearchShares.mock.calls[0][1];
      expect(callArgs?.tags).toEqual(["react", "nextjs"]);
    });
  });

  describe("success", () => {
    it("returns 200 with search results", async () => {
      mockSearchShares.mockResolvedValue({
        shares: [{ title: "Test" } as never],
        total: 1,
        nextCursor: null,
      });

      const { status, body } = await parseResponse(
        await GET(searchRequest("?q=test"))
      );

      expect(status).toBe(200);
      expect(body.shares).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.query).toBe("test");
    });
  });

  describe("errors", () => {
    it("returns 500 when searchShares throws", async () => {
      mockSearchShares.mockRejectedValue(new Error("DB error"));

      const { status, body } = await parseResponse(
        await GET(searchRequest("?q=test"))
      );

      expect(status).toBe(500);
      expect(body.error).toBe("Search failed");
    });
  });
});
