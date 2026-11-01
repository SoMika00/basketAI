/*
 * API route for exporting a conversation transcript.
 * GET /api/conversation/:conversationId/export
 * GET /api/conversation/:conversationId/export.json
 * GET /api/conversation/:conversationId/export.csv
 *
 * Supports JSON (default) and CSV representations. The format can be
 * selected via a `.json`/`.csv` path suffix or the `?format=` query parameter.
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
 * Escapes a single CSV field per RFC 4180.
 * Fields containing commas, double quotes, or newlines are wrapped in double
 * quotes and embedded double quotes are doubled.
 *
 * @param {string} value - The raw field value
 * @returns {string} The escaped CSV field
 */
function escapeCsvField(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[,"\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Builds a CSV document from conversation history.
 *
 * @param {Array} messages - Conversation messages from getConversationHistory
 * @returns {string} CSV text (without BOM)
 */
function buildCsv(messages) {
  const header = ["id", "role", "created_at", "content"];
  const rows = messages.map((message) => [
    message.id,
    message.role,
    new Date(message.createdAt).toISOString(),
    message.content,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
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

  const url = new URL(request.url);

  // Determine the requested format. The `.csv`/`.json` path suffix takes
  // precedence over the `?format=` query parameter.
  const pathSuffix = url.pathname.split(".").pop()?.toLowerCase();
  const queryFormat = url.searchParams.get("format");

  let format = "json";
  if (pathSuffix === "csv" || pathSuffix === "json") {
    format = pathSuffix;
  } else if (queryFormat) {
    format = queryFormat.toLowerCase();
  }

  if (format !== "json" && format !== "csv") {
    return json(
      { error: "Unsupported format" },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    const messages = await getConversationHistory(conversationId);

    if (format === "csv") {
      const csv = "\uFEFF" + buildCsv(messages);
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="conversation-${conversationId}.csv"`,
        },
      });
    }

    const payload = {
      conversation_id: conversationId,
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
