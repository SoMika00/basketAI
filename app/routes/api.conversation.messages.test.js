import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "./api.conversation.$conversationId.messages";

vi.mock("../db.server", () => ({
  getConversationHistory: vi.fn(),
}));

import { getConversationHistory } from "../db.server";

function makeRequest(url, method = "GET") {
  return new Request(url, { method });
}

describe("api.conversation.$conversationId.messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns messages in chronological order with ISO timestamps", async () => {
    getConversationHistory.mockResolvedValue([
      { id: "m1", role: "user", content: "hello", createdAt: new Date("2023-01-01T00:00:00.000Z") },
      { id: "m2", role: "assistant", content: "hi there", createdAt: new Date("2023-01-01T00:00:01.000Z") },
    ]);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/123/messages"),
      params: { conversationId: "123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      conversation_id: "123",
      message_count: 2,
      has_more: false,
      messages: [
        { id: "m1", role: "user", content: "hello", created_at: "2023-01-01T00:00:00.000Z" },
        { id: "m2", role: "assistant", content: "hi there", created_at: "2023-01-01T00:00:01.000Z" },
      ],
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns empty messages for an unknown conversation", async () => {
    getConversationHistory.mockResolvedValue([]);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/unknown/messages"),
      params: { conversationId: "unknown" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      conversation_id: "unknown",
      message_count: 0,
      has_more: false,
      messages: [],
    });
  });

  it("returns 400 when conversationId is missing", async () => {
    const response = await loader({
      request: makeRequest("https://example.com/api/conversation//messages"),
      params: { conversationId: "" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("clamps limit to a maximum of 500 and sets has_more", async () => {
    const messages = Array.from({ length: 600 }, (_, i) => ({
      id: `m${i}`,
      role: "user",
      content: `msg ${i}`,
      createdAt: new Date(2023, 0, 1, 0, 0, i),
    }));
    getConversationHistory.mockResolvedValue(messages);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/123/messages?limit=9999"),
      params: { conversationId: "123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message_count).toBe(500);
    expect(body.messages).toHaveLength(500);
    expect(body.has_more).toBe(true);
    // Most recent messages are returned (chronological order preserved).
    expect(body.messages[0].id).toBe("m100");
    expect(body.messages[499].id).toBe("m599");
  });

  it("returns 500 on unexpected DB failures", async () => {
    getConversationHistory.mockRejectedValue(new Error("db down"));

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/123/messages"),
      params: { conversationId: "123" },
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("handles OPTIONS preflight with 204 and CORS headers", async () => {
    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/123/messages", "OPTIONS"),
      params: { conversationId: "123" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
