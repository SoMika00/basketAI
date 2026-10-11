import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loader } from "./health.jsx";

vi.mock("../db.server", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "../db.server";

function makeRequest(method = "GET", headers = {}) {
  return new Request("http://localhost/health", { method, headers });
}

describe("GET /health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_PROVIDER;
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with the expected response shape when the DB probe succeeds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await loader({ request: makeRequest() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(typeof body.uptime_seconds).toBe("number");
    expect(typeof body.timestamp).toBe("string");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.llm_provider).toBe("anthropic");
  });

  it("returns 503 degraded with database error when the DB probe throws", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await loader({ request: makeRequest() });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("error");
    expect(body.checks.llm_provider).toBe("anthropic");
  });

  it("reports groq when GROQ_API_KEY is set", async () => {
    process.env.GROQ_API_KEY = "test-key";
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await loader({ request: makeRequest() });
    const body = await response.json();

    expect(body.checks.llm_provider).toBe("groq");
  });

  it("reports groq when LLM_PROVIDER is groq", async () => {
    process.env.LLM_PROVIDER = "groq";
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await loader({ request: makeRequest() });
    const body = await response.json();

    expect(body.checks.llm_provider).toBe("groq");
  });

  it("reports anthropic when LLM_PROVIDER is anthropic even with GROQ_API_KEY set", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.GROQ_API_KEY = "test-key";
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await loader({ request: makeRequest() });
    const body = await response.json();

    expect(body.checks.llm_provider).toBe("anthropic");
  });
});

describe("OPTIONS /health", () => {
  it("returns 204 with CORS headers allowing GET", async () => {
    const response = await loader({
      request: makeRequest("OPTIONS", { Origin: "https://example.com" }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
