import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "./api.conversation.$conversationId.export.html.jsx";
import { getConversationHistory } from "../db.server";

vi.mock("../db.server", () => ({
  getConversationHistory: vi.fn(),
}));

function makeRequest(url, method = "GET") {
  return new Request(url, { method });
}

describe("api.conversation.$conversationId.export.html", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a valid HTML document with escaped content", async () => {
    getConversationHistory.mockResolvedValue([
      { id: "1", role: "user", content: "<script>alert('xss')</script> & hello", createdAt: new Date() },
      { id: "2", role: "assistant", content: "Hi there & welcome", createdAt: new Date() },
    ]);

    const response = await loader({
      request: makeRequest("http://localhost/api/conversation/abc123/export.html"),
      params: { conversationId: "abc123" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");

    const html = await response.text();

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Conversation abc123</title>");
    expect(html).toContain("Conversation abc123");
    expect(html).toContain("Messages: 2");

    // Escaped content must not contain raw script tags or raw ampersands.
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt; &amp; hello");
    expect(html).toContain("Hi there &amp; welcome");

    // Messages appear in order.
    const userIndex = html.indexOf("&lt;script&gt;");
    const assistantIndex = html.indexOf("Hi there &amp; welcome");
    expect(userIndex).toBeGreaterThan(-1);
    expect(assistantIndex).toBeGreaterThan(userIndex);
  });

  it("sets Content-Disposition attachment header when download=1", async () => {
    getConversationHistory.mockResolvedValue([
      { id: "1", role: "user", content: "hello", createdAt: new Date() },
    ]);

    const response = await loader({
      request: makeRequest("http://localhost/api/conversation/abc123/export.html?download=1"),
      params: { conversationId: "abc123" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="conversation-abc123.html"'
    );
  });

  it("serves inline without Content-Disposition when download is absent", async () => {
    getConversationHistory.mockResolvedValue([
      { id: "1", role: "user", content: "hello", createdAt: new Date() },
    ]);

    const response = await loader({
      request: makeRequest("http://localhost/api/conversation/abc123/export.html"),
      params: { conversationId: "abc123" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBeNull();
  });

  it("returns 400 when conversationId is missing", async () => {
    const response = await loader({
      request: makeRequest("http://localhost/api/conversation//export.html"),
      params: { conversationId: "" },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 500 on server errors", async () => {
    getConversationHistory.mockRejectedValue(new Error("boom"));

    const response = await loader({
      request: makeRequest("http://localhost/api/conversation/abc123/export.html"),
      params: { conversationId: "abc123" },
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("labels tool-result-only messages as tool output", async () => {
    getConversationHistory.mockResolvedValue([
      {
        id: "1",
        role: "user",
        content: JSON.stringify([{ type: "tool_result", tool_use_id: "t1", content: "raw json" }]),
        createdAt: new Date(),
      },
    ]);

    const response = await loader({
      request: makeRequest("http://localhost/api/conversation/abc123/export.html"),
      params: { conversationId: "abc123" },
    });

    const html = await response.text();
    expect(html).toContain("[tool output]");
    expect(html).not.toContain("raw json");
  });
});
