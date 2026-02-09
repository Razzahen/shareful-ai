import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResponse } from "../helpers";

vi.mock("@/lib/reputation", () => ({
  getContributorProfile: vi.fn(),
}));

import { GET } from "@/app/api/profile/[username]/route";
import { getContributorProfile } from "@/lib/reputation";

const mockGetProfile = vi.mocked(getContributorProfile);

function makeRequest(username: string) {
  const req = new Request(`http://localhost/api/profile/${username}`);
  return GET(req, { params: Promise.resolve({ username }) });
}

const mockProfile = {
  username: "alice",
  score: 85.5,
  shares_count: 3,
  total_views: 150,
  avg_success_rate: 0.9,
  shares: [],
};

describe("GET /api/profile/[username]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with profile data for existing user", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    const { status, body } = await parseResponse(await makeRequest("alice"));

    expect(status).toBe(200);
    expect(body.username).toBe("alice");
    expect(body.score).toBe(85.5);
    expect(body.shares_count).toBe(3);
  });

  it("returns 404 when user not found", async () => {
    mockGetProfile.mockResolvedValue(null);

    const { status, body } = await parseResponse(await makeRequest("unknown"));

    expect(status).toBe(404);
    expect(body.error).toContain("unknown");
  });

  it("returns 500 when lib throws", async () => {
    mockGetProfile.mockRejectedValue(new Error("DB error"));

    const { status, body } = await parseResponse(await makeRequest("alice"));

    expect(status).toBe(500);
    expect(body.error).toBe("Failed to fetch profile");
  });

  it("passes username param correctly to lib function", async () => {
    mockGetProfile.mockResolvedValue(mockProfile);

    await makeRequest("test-user-123");

    expect(mockGetProfile).toHaveBeenCalledWith("test-user-123");
  });

  it("returns 400 for empty username", async () => {
    const { status, body } = await parseResponse(await makeRequest(""));

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });
});
