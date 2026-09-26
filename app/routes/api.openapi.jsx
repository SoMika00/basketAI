import { json } from "@remix-run/node";

/**
 * Simple route that returns a static OpenAPI 3.0 specification JSON for the API.
 * The spec is defined as a plain JavaScript object to avoid extra runtime dependencies.
 */
export async function loader() {
  const openapiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Shop Chat Agent API",
      version: "1.0.0",
      description: "API specification for the Shop Chat Agent backend",
    },
    paths: {
      "/api/tools": {
        get: {
          summary: "Get available MCP tools",
          description: "Returns a JSON object containing the list of available MCP tools for the current conversation.",
          parameters: [
            {
              name: "type",
              in: "query",
              description: "Tool type filter",
              required: false,
              schema: {
                type: "string",
                enum: ["storefront", "customer", "all"],
                default: "all",
              },
            },
            {
              name: "conversationId",
              in: "query",
              description: "Identifier of the conversation to fetch customer tokens",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Successful response with tools list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tools: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            auth_required: { type: "boolean" },
                            parameters: { type: "object" },
                          },
                          required: ["name", "description", "parameters"],
                        },
                      },
                    },
                    required: ["tools"],
                  },
                },
              },
            },
            "500": {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                    },
                    required: ["error"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return json(openapiSpec);
}

export const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
