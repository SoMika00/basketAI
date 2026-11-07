/*
 * API route for exporting a conversation transcript.
 * GET /api/conversation/:conversationId/export
 */
import { json } from "@remix-run/node";
import { getConversationHistory } from "../db.server";

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
    const messages = await getConversationHistory(conversationId);

    const payload = {
      conversation_id: conversationId,
      exported_at: new Date().toISOString(),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: new Date(message.createdAt).toISOString(),
      })),
    };

    return json(payload, { status: 200, headers: corsHeaders(request) });
  } catch (error) {
    console.error("Error exporting conversation:", error);
    return json(
      { error: "Failed to export conversation" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export default function ConversationExportRoute() {
  // This route is API only; no UI component needed.
  return null;
}
