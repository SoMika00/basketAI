/*
 * API route for fetching conversation summary metadata.
 * GET /api/conversation/:conversationId
 */
import { json } from "@remix-run/node";
import { getConversationHistory, getCustomerToken } from "../db.server";

/**
 * Helper to generate CORS headers consistent with other API routes.
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Loader function for GET requests.
 */
export async function loader({ request, params }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const { conversationId } = params;

  if (!conversationId) {
    return json({ error: "Missing conversationId parameter" }, { status: 400, headers: corsHeaders(request) });
  }

  try {
    // Fetch messages for the conversation
    const messages = await getConversationHistory(conversationId);
    const messageCount = messages.length;
    const lastMessageAt = messageCount > 0 ? new Date(messages[messages.length - 1].createdAt).toISOString() : null;

    // Determine token status
    const token = await getCustomerToken(conversationId);
    const tokenStatus = token ? "authorized" : "unauthorized";

    const payload = {
      conversation_id: conversationId,
      message_count: messageCount,
      last_message_at: lastMessageAt,
      token_status: tokenStatus
    };

    return json(payload, { status: 200, headers: corsHeaders(request) });
  } catch (error) {
    console.error("Error fetching conversation summary:", error);
    return json({ error: "Failed to fetch conversation summary" }, { status: 500, headers: corsHeaders(request) });
  }
}

export const action = async ({ request }) => {
  // Disallow non-GET methods except OPTIONS handled above
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
};
