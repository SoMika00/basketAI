/*
 * API route for clearing a conversation's stored history.
 * DELETE /api/conversation/:conversationId
 */
import { json } from "@remix-run/node";
import { deleteConversation } from "../db.server";

/**
 * Helper to generate CORS headers consistent with other API routes.
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Action function for DELETE requests.
 */
export async function action({ request, params }) {
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
    const result = await deleteConversation(conversationId);

    return json(
      {
        conversation_id: conversationId,
        deleted: result.deleted,
        messages_deleted: result.messages_deleted,
      },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Error clearing conversation:", error);
    return json(
      { error: "Failed to clear conversation" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export async function loader() {
  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
