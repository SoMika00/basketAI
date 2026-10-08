import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteConversationMock = vi.fn();

vi.mock("../db.server", () => ({
  deleteConversation: deleteConversationMock,
}));

import { action } from "./api.conversation.clear.jsx";

describe("api.conversation.clear", () => {
  beforeEach(() => {
    deleteConversationMock.mockReset();
  });

  it("deletes a conversation with messages and returns 200", async () => {
    deleteConversationMock.mockResolvedValue({
      deleted: true,
      messages_deleted: 3,
    });

    const request = new Request("http://localhost/api/conversation/conv-123", {
      method: "DELETE",
      headers: { Origin: "https://example.com" },
    });

    const response = await action({
      request,
      params: { conversationId: "conv-123" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      conversation_id: "conv-123",
      deleted: true,
      messages_deleted: 3,
    });
    expect(deleteConversationMock).toHaveBeenCalledWith("conv-123");
  });

  it("returns 200 with deleted:false for an unknown conversation (idempotent)", async () => {
    deleteConversationMock.mockResolvedValue({
      deleted: false,
      messages_deleted: 0,
    });

    const request = new Request("http://localhost/api/conversation/unknown", {
      method: "DELETE",
      headers: { Origin: "https://example.com" },
    });

    const response = await action({
      request,
      params: { conversationId: "unknown" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      conversation_id: "unknown",
      deleted: false,
      messages_deleted: 0,
    });
  });

  it("returns 400 when conversationId is missing", async () => {
    const request = new Request("http://localhost/api/conversation/", {
      method: "DELETE",
      headers: { Origin: "https://example.com" },
    });

    const response = await action({
      request,
      params: {},
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Missing conversationId parameter" });
    expect(deleteConversationMock).not.toHaveBeenCalled();
  });

  it("returns 204 for CORS preflight with DELETE allowed", async () => {
    const request = new Request("http://localhost/api/conversation/conv-123", {
      method: "OPTIONS",
      headers: { Origin: "https://example.com" },
    });

    const response = await action({
      request,
      params: { conversationId: "conv-123" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "DELETE"
    );
    expect(deleteConversationMock).not.toHaveBeenCalled();
  });
});
