/*
 * API route for exporting a conversation transcript as XML.
 * GET /api/conversation/:conversationId/export.xml
 */
import { json } from "@remix-run/node";
import { getConversationHistory } from "../db.server";
import { buildContentDisposition } from "../utils/download.server";

/**
 * Helper to generate CORS headers consistent with other API routes.
 * Exposes Content-Disposition so browser fetch() clients can read the filename.
 */
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Escapes a string for safe inclusion in XML text content.
 *
 * @param {string} value - The raw string value
 * @returns {string} The XML-escaped string
 */
function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds an XML document from the conversation messages.
 *
 * @param {string} conversationId - The conversation identifier
 * @param {Array} messages - The conversation messages
 * @returns {string} The XML document string
 */
function buildXml(conversationId, messages) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<conversation>",
    `  <id>${escapeXml(conversationId)}</id>`,
    `  <message_count>${messages.length}</message_count>`,
    `  <generated_at>${escapeXml(new Date().toISOString())}</generated_at>`,
    "  <messages>",
  ];

  for (const message of messages) {
    lines.push("    <message>");
    lines.push(`      <role>${escapeXml(message.role)}</role>`);
    lines.push(`      <content>${escapeXml(message.content)}</content>`);
    lines.push(`      <created_at>${escapeXml(new Date(message.createdAt).toISOString())}</created_at>`);
    lines.push("    </message>");
  }

  lines.push("  </messages>");
  lines.push("</conversation>");

  return lines.join("\n");
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
    const download = url.searchParams.get("download") === "1";

    const messages = await getConversationHistory(conversationId);
    const body = buildXml(conversationId, messages);

    const headers = {
      ...corsHeaders(request),
      "Content-Type": "application/xml; charset=utf-8",
    };

    if (download) {
      headers["Content-Disposition"] = buildContentDisposition(conversationId, "xml");
    }

    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error("Error exporting conversation XML:", error);
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

export default function ConversationExportXmlRoute() {
  // This route is API only; no UI component needed.
  return null;
}
