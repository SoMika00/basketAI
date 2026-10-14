import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { action } from "./chat.jsx";
import { resetRateLimiter } from "../services/rate-limit.server";

// Mock the LLM service so no real provider call is made.
vi.mock("../services/llm.server", () => ({
  createLlmService: () => ({
    streamConversation: async () => ({ role: "assistant", content: "ok", stop_reason: "end_turn" }),
  }),
}));

// Mock the MCP client so no network calls are made.
vi.mock("../mcp-client", () => ({
  default: class {
    constructor() {
      this.tools = [];
    }
    async connectToStorefrontServer() {
      return [];
    }
    async connectToCustomerServer() {
      return [];
    }
    async callTool() {
      return { content: [] };
    }
  },
}));

// Mock DB helpers to avoid a real database connection.
vi.mock("../db.server", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
  getConversationHistory: vi.fn().mockResolvedValue([]),
  storeCustomerAccountUrls: vi.fn().mockResolvedValue(undefined),
  getCustomerAccountUrls: vi.fn().mockResolvedValue(null),
}));

function buildRequest({ conversationId, ip } = {}) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  if (ip) headers.set("X-Forwarded-For", ip);

  const body = { message: "hello" };
  if (conversationId) body.conversation_id = conversationId;

  return new Request("http://localhost/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("chat rate limiting", () => {
  beforeEach(() => {
    resetRateLimiter();
    process.env.CHAT_RATE_LIMIT_MAX = "2";
    process.env.CHAT_RATE_LIMIT_WINDOW_MS = "60000";
  });

  afterEach(() => {
    resetRateLimiter();
    delete process.env.CHAT_RATE_LIMIT_MAX;
    delete process.env.CHAT_RATE_LIMIT_WINDOW_MS;
  });

  it("returns 429 with the expected shape when the limit is exceeded", async () => {
    const conversationId = "conv-123";

    // First two requests are under the limit.
    await action({ request: buildRequest({ conversationId }) });
    await action({ request: buildRequest({ conversationId }) });

    // Third request exceeds the limit.
    const response = await action({ request: buildRequest({ conversationId }) });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();

    const body = await response.json();
    expect(body.error).toBe("rate_limit_exceeded");
    expect(typeof body.retry_after_seconds).toBe("number");
    expect(body.retry_after_seconds).toBeGreaterThan(0);
  });

  it("isolates rate limits by conversation id", async () => {
    await action({ request: buildRequest({ conversationId: "conv-a" }) });
    await action({ request: buildRequest({ conversationId: "conv-a" }) });

    // A different conversation should still be allowed.
    const response = await action({ request: buildRequest({ conversationId: "conv-b" }) });
    expect(response.status).not.toBe(429);
  });
});
