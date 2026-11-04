/*
 * API route for exporting a conversation transcript.
 * GET /api/conversation/:conversationId/export
 * GET /api/conversation/:conversationId/export.json
 * GET /api/conversation/:conversationId/export.csv
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

  const conversationId = params.conversationId;

  if (!conversationId) {
    return json(
      { error: "conversationId is required" },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    const messages = await getConversationHistory(conversationId);

    const url = new URL(request.url);
    const format = url.pathname.endsWith(".csv")
      ? "csv"
      : url.pathname.endsWith(".json")
        ? "json"
        : "json";

    if (format === "csv") {
      const header = "role,content\n";
      const rows = messages
        .map((m) => {
          const content = (m.content || "").replace(/"/g, '""');
          return `"${m.role}","${content}"`;
        })
        .join("\n");

      return new Response(header + rows, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="conversation-${conversationId}.csv"`,
        },
      });
    }

    return json(
      {
        conversation_id: conversationId,
        message_count: messages.length,
        messages,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Disposition": `attachment; filename="conversation-${conversationId}.json"`,
        },
      }
    );
  } catch (error) {
    console.error("Error exporting conversation:", error);
    return json(
      { error: "Failed to export conversation" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export default function ExportRoute() {
  // This route is API only; no UI component needed.
  return null;
}
