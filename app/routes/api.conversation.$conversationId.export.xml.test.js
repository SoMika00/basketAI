import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "./api.conversation.$conversationId.export.xml.jsx";
import { getConversationHistory } from "../db.server";

vi.mock("../db.server", () => ({
  getConversationHistory: vi.fn(),
}));

function makeRequest(url, method = "GET") {
  return new Request(url, { method });
}

const sampleMessages = [
  {
    id: "msg1",
    role: "user",
    content: "Hello & <world> \"quoted\" 'single'",
    createdAt: new Date("2023-01-01T12:00:00.000Z"),
  },
  {
    id: "msg2",
    role: "assistant",
    content: "Hi there!",
    createdAt: new Date("2023-01-01T12:00:01.000Z"),
  },
];

describe("GET /api/conversation/:conversationId/export.xml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with application/xml content type and well-formed structure", async () => {
    getConversationHistory.mockResolvedValue(sampleMessages);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv123/export.xml"),
      params: { conversationId: "conv123" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");

    const body = await response.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<conversation id="conv123"');
    expect(body).toContain('message_count="2"');
    expect(body).toContain('generated_at="');
    expect(body).toContain('<message id="msg1" role="user"');
    expect(body).toContain('<message id="msg2" role="assistant"');
    expect(body).toContain('</conversation>');
  });

  it("XML-escapes special characters in content and attributes", async () => {
    getConversationHistory.mockResolvedValue(sampleMessages);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv&123/export.xml"),
      params: { conversationId: "conv&123" },
    });

    const body = await response.text();

    expect(body).toContain('id="conv&amp;123"');
    expect(body).toContain("Hello &amp; &lt;world&gt; &quot;quoted&quot; &apos;single&apos;");
    expect(body).not.toContain("Hello & <world>");
  });

  it("adds Content-Disposition attachment header when download=1", async () => {
    getConversationHistory.mockResolvedValue(sampleMessages);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv123/export.xml?download=1"),
      params: { conversationId: "conv123" },
    });

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="conversation-conv123.xml"'
    );
  });

  it("serves inline (no Content-Disposition) without download param", async () => {
    getConversationHistory.mockResolvedValue(sampleMessages);

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv123/export.xml"),
      params: { conversationId: "conv123" },
    });

    expect(response.headers.get("Content-Disposition")).toBeNull();
  });

  it("returns 400 with JSON error when conversationId is missing", async () => {
    const response = await loader({
      request: makeRequest("https://example.com/api/conversation//export.xml"),
      params: { conversationId: "" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 500 with JSON error on server error", async () => {
    getConversationHistory.mockRejectedValue(new Error("db down"));

    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv123/export.xml"),
      params: { conversationId: "conv123" },
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 204 with CORS headers on OPTIONS preflight", async () => {
    const response = await loader({
      request: makeRequest("https://example.com/api/conversation/conv123/export.xml", "OPTIONS"),
      params: { conversationId: "conv123" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
