import { describe, it, expect, beforeEach, vi } from "vitest";
import { loader } from "./api.rate-limit";
import {
  check,
  resetRateLimiter,
} from "../services/rate-limit.server";

function makeRequest(url, headers = {}) {
  return new Request(url, { method: "GET", headers });
}

function makeOptionsRequest(url, headers = {}) {
  return new Request(url, { method: "OPTIONS", headers });
}

describe("GET /api/rate-limit", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("returns 200 with default values for an unknown key", async () => {
    const response = await loader({ request: makeRequest("http://localhost/api/rate-limit") });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.key).toBe("ip:unknown");
    expect(body.count).toBe(0);
    expect(body.max).toBeGreaterThan(0);
    expect(body.window_ms).toBeGreaterThan(0);
    expect(body.remaining).toBe(body.max);
    expect(body.retry_after_seconds).toBe(0);
  });

  it("uses conversation:<id> key when conversationId is provided", async () => {
    const response = await loader({
      request: makeRequest("http://localhost/api/rate-limit?conversationId=abc123"),
    });
    const body = await response.json();
    expect(body.key).toBe("conversation:abc123");
  });

  it("derives key from X-Forwarded-For when no conversationId", async () => {
    const response = await loader({
      request: makeRequest("http://localhost/api/rate-limit", {
        "X-Forwarded-For": "203.0.113.7, 10.0.0.1",
      }),
    });
    const body = await response.json();
    expect(body.key).toBe("ip:203.0.113.7");
  });

  it("reflects recorded requests after calling check() N times", async () => {
    const key = "conversation:test";
    for (let i = 0; i < 3; i += 1) {
      check(key);
    }

    const response = await loader({
      request: makeRequest("http://localhost/api/rate-limit?conversationId=test"),
    });
    const body = await response.json();
    expect(body.key).toBe(key);
    expect(body.count).toBe(3);
    expect(body.remaining).toBe(body.max - 3);
    expect(body.retry_after_seconds).toBe(0);
  });

  it("does not consume a rate-limit slot across repeated calls", async () => {
    const response1 = await loader({
      request: makeRequest("http://localhost/api/rate-limit?conversationId=test"),
    });
    const body1 = await response1.json();

    const response2 = await loader({
      request: makeRequest("http://localhost/api/rate-limit?conversationId=test"),
    });
    const body2 = await response2.json();

    expect(body2.count).toBe(body1.count);
    expect(body2.remaining).toBe(body1.remaining);
  });

  it("returns retry_after_seconds > 0 when the limit is exhausted", async () => {
    const key = "conversation:exhausted";
    const max = 20;
    for (let i = 0; i < max; i += 1) {
      check(key);
    }

    const response = await loader({
      request: makeRequest("http://localhost/api/rate-limit?conversationId=exhausted"),
    });
    const body = await response.json();
    expect(body.count).toBe(max);
    expect(body.remaining).toBe(0);
    expect(body.retry_after_seconds).toBeGreaterThan(0);
  });

  it("returns 204 with CORS headers for OPTIONS", async () => {
    const response = await loader({
      request: makeOptionsRequest("http://localhost/api/rate-limit", {
        Origin: "https://example.com",
      }),
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("returns 500 with an error field when the service throws", async () => {
    const rateLimitModule = await import("../services/rate-limit.server");
    const spy = vi
      .spyOn(rateLimitModule, "getRateLimitStatus")
      .mockImplementation(() => {
        throw new Error("boom");
      });

    try {
      const response = await loader({
        request: makeRequest("http://localhost/api/rate-limit"),
      });
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
