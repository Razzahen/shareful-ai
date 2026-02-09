import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/registry", () => ({
  isRegistered: vi.fn(),
  enqueueIndexJob: vi.fn(),
}));

import { GET } from "@/app/api/telemetry/route";
import { enqueueIndexJob, isRegistered } from "@/lib/registry";

const mockIsRegistered = vi.mocked(isRegistered);
const mockEnqueueIndexJob = vi.mocked(enqueueIndexJob);

describe("GET /api/telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 with no params", async () => {
    const res = await GET(new Request("http://localhost/api/telemetry"));
    expect(res.status).toBe(204);
    expect(mockEnqueueIndexJob).not.toHaveBeenCalled();
  });

  it("returns 204 when only owner is provided", async () => {
    const res = await GET(
      new Request("http://localhost/api/telemetry?owner=alice")
    );
    expect(res.status).toBe(204);
    expect(mockEnqueueIndexJob).not.toHaveBeenCalled();
  });

  it("returns 204 when only repo is provided", async () => {
    const res = await GET(
      new Request("http://localhost/api/telemetry?repo=shares")
    );
    expect(res.status).toBe(204);
    expect(mockEnqueueIndexJob).not.toHaveBeenCalled();
  });

  it("enqueues index job when owner and repo are provided and not registered", async () => {
    mockIsRegistered.mockResolvedValue(false);
    mockEnqueueIndexJob.mockResolvedValue(undefined);

    const res = await GET(
      new Request("http://localhost/api/telemetry?owner=alice&repo=shares")
    );

    expect(res.status).toBe(204);
    expect(mockIsRegistered).toHaveBeenCalledWith("alice", "shares");
    expect(mockEnqueueIndexJob).toHaveBeenCalledWith("alice", "shares");
  });

  it("does not enqueue when repo is already registered", async () => {
    mockIsRegistered.mockResolvedValue(true);

    const res = await GET(
      new Request("http://localhost/api/telemetry?owner=alice&repo=shares")
    );

    expect(res.status).toBe(204);
    expect(mockIsRegistered).toHaveBeenCalledWith("alice", "shares");
    expect(mockEnqueueIndexJob).not.toHaveBeenCalled();
  });
});
