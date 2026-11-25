/*
 * API route for exporting a conversation transcript as HTML.
 * GET /api/conversation/:conversationId/export.html
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
 * Escapes HTML special characters to prevent XSS.
 * @param {string} value - The raw string to escape
 * @returns {string} The HTML-escaped string
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Determines whether a message content is a tool-result-only payload.
 * @param {string} raw - Raw message content
 * @returns {boolean} True when the content is an array of tool_result blocks
 */
function isToolResultOnlyContent(raw) {
  if (typeof raw !== "string") return false;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.every((b) => b && b.type === "tool_result");
  } catch (e) {
    return false;
  }
}

/**
 * Renders a single message as an HTML block.
 * @param {Object} message - The message record
 * @returns {string} HTML for the message
 */
function renderMessage(message) {
  const role = escapeHtml(message.role);
  const createdAt = new Date(message.createdAt).toISOString();

  if (isToolResultOnlyContent(message.content)) {
    return `
      <div class="message tool-result">
        <div class="meta"><span class="role">${role}</span> <span class="time">${escapeHtml(createdAt)}</span></div>
        <div class="content"><em>Tool output</em></div>
      </div>`;
  }

  const content = escapeHtml(message.content);
  return `
      <div class="message">
        <div class="meta"><span class="role">${role}</span> <span class="time">${escapeHtml(createdAt)}</span></div>
        <div class="content">${content}</div>
      </div>`;
}

/**
 * Builds the self-contained HTML document for a conversation.
 * @param {string} conversationId - The conversation identifier
 * @param {Array} messages - The conversation messages in chronological order
 * @returns {string} The HTML document
 */
function buildHtmlDocument(conversationId, messages) {
  const generatedAt = new Date().toISOString();
  const messageCount = messages.length;
  const body = messages.map(renderMessage).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conversation ${escapeHtml(conversationId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; background: #fafafa; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    .summary { color: #555; font-size: 0.9rem; margin-bottom: 24px; }
    .message { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
    .message.tool-result { background: #f4f4f4; }
    .meta { font-size: 0.8rem; color: #888; margin-bottom: 6px; }
    .role { font-weight: 600; text-transform: capitalize; }
    .content { white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Conversation ${escapeHtml(conversationId)}</h1>
    <div class="summary">${messageCount} message${messageCount === 1 ? "" : "s"} &middot; generated ${escapeHtml(generatedAt)}</div>
    ${body}
  </div>
</body>
</html>`;
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
    const download = url.searchParams.get("download");

    const messages = await getConversationHistory(conversationId);
    const body = buildHtmlDocument(conversationId, messages);

    const headers = {
      ...corsHeaders(request),
      "Content-Type": "text/html; charset=utf-8",
    };

    if (download === "1") {
      headers["Content-Disposition"] = buildContentDisposition(conversationId, "html");
    }

    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error("Error exporting conversation as HTML:", error);
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

export default function ConversationExportHtmlRoute() {
  // This route is API only; no UI component needed.
  return null;
}
