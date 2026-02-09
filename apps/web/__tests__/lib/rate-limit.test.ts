import { describe, expect, it, vi } from "vitest";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("returns x-forwarded-for first IP", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns x-real-ip when x-forwarded-for is missing", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(req)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  1.2.3.4  " },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
});

describe("isRateLimited", () => {
  it("allows first request", () => {
    expect(isRateLimited("unique-ip-1", "test-allow", 5, 60_000)).toBe(false);
  });

  it("allows requests up to the limit", () => {
    const ip = "unique-ip-2";
    const ns = "test-limit";
    for (let i = 0; i < 4; i++) {
      expect(isRateLimited(ip, ns, 5, 60_000)).toBe(false);
    }
  });

  it("blocks requests over the limit", () => {
    const ip = "unique-ip-3";
    const ns = "test-block";
    for (let i = 0; i < 5; i++) {
      isRateLimited(ip, ns, 5, 60_000);
    }
    expect(isRateLimited(ip, ns, 5, 60_000)).toBe(true);
  });

  it("uses separate namespaces independently", () => {
    const ip = "unique-ip-4";
    for (let i = 0; i < 5; i++) {
      isRateLimited(ip, "ns-a", 5, 60_000);
    }
    expect(isRateLimited(ip, "ns-a", 5, 60_000)).toBe(true);
    expect(isRateLimited(ip, "ns-b", 5, 60_000)).toBe(false);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();

    const ip = "unique-ip-5";
    const ns = "test-expire";
    const windowMs = 60_000;

    for (let i = 0; i < 6; i++) {
      isRateLimited(ip, ns, 5, windowMs);
    }
    expect(isRateLimited(ip, ns, 5, windowMs)).toBe(true);

    vi.advanceTimersByTime(windowMs + 1);
    expect(isRateLimited(ip, ns, 5, windowMs)).toBe(false);

    vi.useRealTimers();
  });
});
