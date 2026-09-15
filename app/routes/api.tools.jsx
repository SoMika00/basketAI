import { json } from "@remix-run/node";
import { LoaderFunction } from "@remix-run/node";
import MCPClient from "../mcp-client.js";
import { getCustomerToken } from "../db.server.js";

/**
 * Loader for /api/tools endpoint.
 * Returns merged list of MCP tools based on query param `type`.
 * Supports optional authentication for customer tools via conversationId.
 */
export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "all"; // storefront | customer | all
    const conversationId = url.searchParams.get("conversationId");

    // Initialize MCP client with placeholder values for hostUrl, shopId.
    // In existing code, MCPClient is instantiated elsewhere (e.g., in chat route).
    // We'll derive hostUrl from request headers (origin) and use dummy shopId.
    const hostUrl = `${url.protocol}//${url.host}`;
    const shopId = process.env.SHOP_ID || ""; // optional, not used for tools list.
    const client = new MCPClient(hostUrl, conversationId, shopId);

    // Fetch tools based on requested type.
    let storefrontTools = [];
    let customerTools = [];
    let authRequired = false;

    if (type === "storefront" || type === "all") {
      storefrontTools = await client.connectToStorefrontServer();
    }

    if (type === "customer" || type === "all") {
      try {
        // Attempt to fetch customer tools; client will handle token lookup.
        customerTools = await client.connectToCustomerServer();
        // If token missing, client still returns tools but may include auth flags.
        // We'll set authRequired flag if client has no token.
        if (!client.customerAccessToken) {
          authRequired = true;
        }
      } catch (e) {
        // If customer tools fail, we still return storefront tools.
        console.error("Error fetching customer tools:", e);
        authRequired = true;
      }
    }

    const tools = [];
    if (type === "storefront" || type === "all") tools.push(...storefrontTools);
    if (type === "customer" || type === "all") tools.push(...customerTools);

    // Attach auth_required flag to each customer tool when token missing.
    if (authRequired && (type === "customer" || type === "all")) {
      tools.forEach((tool) => {
        if (client.customerTools.some((t) => t.name === tool.name)) {
          tool.auth_required = true;
        }
      });
    }

    return json({ tools }, { status: 200 });
  } catch (error) {
    console.error("Failed to load tools:", error);
    return json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
};

export default function ToolsRoute() {
  // This route is API only; no UI component needed.
  return null;
}
