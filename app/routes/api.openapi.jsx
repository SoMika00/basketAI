/*
 * OpenAPI 3.0 specification for the public API.
 * GET /api/openapi.json
 */
import { json } from "@remix-run/node";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

const openapi = {
  openapi: "3.0.0",
  info: {
    title: "Shop Chat Agent API",
    version: "1.0.0",
    description: "Public API for the storefront chat agent.",
  },
  paths: {
    "/api/tools": {
      get: {
        summary: "List available MCP tools",
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["storefront", "customer", "all"] },
          },
          {
            name: "conversationId",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "List of tools",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tools: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/conversation/{conversationId}": {
      get: {
        summary: "Get conversation summary",
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Conversation summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversation_id: { type: "string" },
                    message_count: { type: "integer" },
                    last_message_at: { type: "string", format: "date-time", nullable: true },
                    token_status: { type: "string", enum: ["authorized", "unauthorized"] },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing or invalid conversationId",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "Clear a conversation",
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Deletion result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversation_id: { type: "string" },
                    deleted: { type: "boolean" },
                    messages_deleted: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing conversationId",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/conversation/{conversationId}/messages": {
      get: {
        summary: "Get full message transcript for a conversation",
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Maximum number of most recent messages to return (default 100, max 500).",
            schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Message transcript",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversation_id: { type: "string" },
                    message_count: { type: "integer" },
                    has_more: { type: "boolean" },
                    messages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          role: { type: "string" },
                          content: { type: "string" },
                          created_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing or empty conversationId",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  return json(openapi, { status: 200, headers: corsHeaders(request) });
}

export default function OpenApiRoute() {
  return null;
}
