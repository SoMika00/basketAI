import { createRequest } from "@remix-run/node";
import { loader } from "./api.conversation.jsx";
import * as db from "../db.server";

jest.mock("../db.server", () => ({
  getConversationHistory: jest.fn(),
  getCustomerToken: jest.fn()
}));

describe("GET /api/conversation/:conversationId", () => {
  const mockRequest = (method = "GET", origin = "http://localhost") =>
    new Request("http://example.com/api/conversation/123", {
      method,
      headers: { Origin: origin }
    });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns summary with authorized token", async () => {
    const messages = [
      { id: 1, role: "user", content: "hi", createdAt: new Date("2023-01-01T00:00:00Z") },
      { id: 2, role: "assistant", content: "hello", createdAt: new Date("2023-01-01T00:01:00Z") }
    ];
    db.getConversationHistory.mockResolvedValue(messages);
    db.getCustomerToken.mockResolvedValue({ token: "abc", expiresAt: new Date() });

    const response = await loader({ request: mockRequest(), params: { conversationId: "123" } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      conversation_id: "123",
      message_count: 2,
      last_message_at: messages[1].createdAt.toISOString(),
      token_status: "authorized"
    });
  });

  it("returns summary with unauthorized token", async () => {
    const messages = [{ id: 1, role: "user", content: "hi", createdAt: new Date() }];
    db.getConversationHistory.mockResolvedValue(messages);
    db.getCustomerToken.mockResolvedValue(null);

    const response = await loader({ request: mockRequest(), params: { conversationId: "456" } });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token_status).toBe("unauthorized");
    expect(data.conversation_id).toBe("456");
    expect(data.message_count).toBe(1);
  });

  it("returns 400 when conversationId missing", async () => {
    const response = await loader({ request: mockRequest(), params: {} });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Missing conversationId parameter");
  });
});
