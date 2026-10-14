import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { check, getRateLimitStatus, resetRateLimiter } from "./rate-limit.server";

describe("rate-limit.server", () => {
  beforeEach(() => {
    resetRateLimiter();
    process.env.CHAT_RATE_LIMIT_MAX = "3";
    process.env.CHAT_RATE_LIMIT_WINDOW_MS = "60000";
  });

  afterEach(() => {
    resetRateLimiter();
    delete process.env.CHAT_RATE_LIMIT_MAX;
    delete process.env.CHAT_RATE_LIMIT_WINDOW_MS;
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    expect(check("key-a").allowed).toBe(true);
    expect(check("key-a").allowed).toBe(true);
    expect(check("key-a").allowed).toBe(true);
  });

  it("blocks requests over the limit", () => {
    check("key-a");
    check("key-a");
    check("key-a");

    const result = check("key-a");
    expect(result.allowed).toBe(false);
    expect(result.retry_after_seconds).toBeGreaterThan(0);
  });

  it("resets the counter after the window expires", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    check("key-a");
    check("key-a");
    check("key-a");
    expect(check("key-a").allowed).toBe(false);

    // Advance past the window
    vi.setSystemTime(now + 60001);
    expect(check("key-a").allowed).toBe(true);
  });

  it("isolates separate keys", () => {
    check("key-a");
    check("key-a");
    check("key-a");

    // key-b should be unaffected by key-a's usage
    expect(check("key-b").allowed).toBe(true);
    expect(check("key-b").allowed).toBe(true);
    expect(check("key-b").allowed).toBe(true);
    expect(check("key-b").allowed).toBe(false);
  });

  it("exposes status via getRateLimitStatus", () => {
    check("key-a");
    check("key-a");

    const status = getRateLimitStatus("key-a");
    expect(status.count).toBe(2);
    expect(status.max).toBe(3);
    expect(status.remaining).toBe(1);
  });
});
