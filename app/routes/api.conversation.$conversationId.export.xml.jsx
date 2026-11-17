/*
 * API route for exporting a conversation transcript as XML.
 * GET /api/conversation/:conversationId/export.xml
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
 * Escapes a value for safe inclusion in XML text content or attribute values.
 * Escapes &, <, >, ", and '.
 *
 * @param {string} value - The raw value to escape
 * @returns {string} The XML-escaped value
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
 * Builds the XML transcript document.
 *
 * @param {string} conversationId - The conversation identifier
 * @param {Array} messages - Chronologically ordered messages
 * @returns {string} The XML document
 */
function buildXml(conversationId, messages) {
  const generatedAt = new Date().toISOString();
  const lines = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<conversation id="${escapeXml(conversationId)}" message_count="${messages.length}" generated_at="${escapeXml(generatedAt)}">`
  );

  for (const message of messages) {
    const id = escapeXml(message.id);
    const role = escapeXml(message.role);
    const createdAt = escapeXml(new Date(message.createdAt).toISOString());
    const content = escapeXml(message.content);

    lines.push(
      `  <message id="${id}" role="${role}" created_at="${createdAt}">${content}</message>`
    );
  }

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

    // Fetch all messages for the conversation in chronological order.
    const messages = await getConversationHistory(conversationId);

    const xml = buildXml(conversationId, messages);

    const headers = {
      ...corsHeaders(request),
      "Content-Type": "application/xml; charset=utf-8",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="conversation-${conversationId}.xml"`;
    }

    return new Response(xml, { status: 200, headers });
  } catch (error) {
    console.error("Error exporting conversation XML:", error);
    return json(
      { error: "Failed to export conversation transcript" },
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
