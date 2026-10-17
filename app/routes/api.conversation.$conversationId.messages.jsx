/*
 * API route for fetching the full message transcript for a conversation.
 * GET /api/conversation/:conversationId/messages
 */
import { json } from "@remix-run/node";
import { getConversationHistory } from "../db.server";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

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
 * Parses and clamps the optional `limit` query parameter.
 * Defaults to 100 and is capped at 500. Non-positive or non-numeric
 * values fall back to the default.
 *
 * @param {URL} url - Parsed request URL
 * @returns {number} The resolved limit
 */
function resolveLimit(url) {
  const raw = url.searchParams.get("limit");
  if (raw === null) return DEFAULT_LIMIT;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;

  return Math.min(parsed, MAX_LIMIT);
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
    const url = new URL(request.url);
    const limit = resolveLimit(url);

    // Fetch all messages for the conversation in chronological order.
    const messages = await getConversationHistory(conversationId);

    // `has_more` is true when older messages were truncated by the limit.
    const hasMore = messages.length > limit;
    const selected = hasMore ? messages.slice(messages.length - limit) : messages;

    const payload = {
      conversation_id: conversationId,
      message_count: selected.length,
      has_more: hasMore,
      messages: selected.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: new Date(message.createdAt).toISOString(),
      })),
    };

    return json(payload, { status: 200, headers: corsHeaders(request) });
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    return json(
      { error: "Failed to fetch conversation messages" },
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

export default function ConversationMessagesRoute() {
  // This route is API only; no UI component needed.
  return null;
}
