/*
 * API route for exporting a conversation's full transcript as a JSON document.
 * GET /api/conversation/:conversationId/export
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
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Loader function for GET requests and OPTIONS preflight.
 */
export async function loader({ request, params }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const { conversationId } = params;

  if (!conversationId) {
    return json(
      { error: "Missing conversationId parameter" },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    // Fetch all messages for the conversation in chronological order.
    const messages = await getConversationHistory(conversationId);

    // Determine token status based on whether a customer token exists.
    const token = await getCustomerToken(conversationId);
    const tokenStatus = token && token.accessToken ? "authorized" : "unauthorized";

    const payload = {
      conversation_id: conversationId,
      exported_at: new Date().toISOString(),
      message_count: messages.length,
      token_status: tokenStatus,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: new Date(message.createdAt).toISOString(),
      })),
    };

    return json(payload, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Disposition": `attachment; filename="conversation-${conversationId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error exporting conversation:", error);
    return json(
      { error: "Failed to export conversation" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export const action = async ({ request }) => {
  // Disallow non-GET methods except OPTIONS handled above.
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
};

export default function ConversationExportRoute() {
  // This route is API only; no UI component needed.
  return null;
}
