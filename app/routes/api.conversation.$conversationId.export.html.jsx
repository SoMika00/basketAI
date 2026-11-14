/*
 * API route for exporting a conversation transcript as a self-contained HTML file.
 * GET /api/conversation/:conversationId/export.html
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
 * Escapes HTML special characters to prevent XSS.
 * Escapes &, <, >, ", and '.
 *
 * @param {string} value - The value to escape
 * @returns {string} The escaped value
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Determines whether a raw message content string represents a tool-result-only
 * message (an array of `{type: 'tool_result'}` blocks).
 *
 * @param {string} raw - The raw content string from the database
 * @returns {boolean} True when the content is tool-result-only
 */
function isToolResultOnlyContent(raw) {
  if (typeof raw !== "string") return false;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.every((block) => block && block.type === "tool_result");
  } catch (e) {
    return false;
  }
}

/**
 * Renders a single message as an HTML list item.
 * Tool-result-only messages are labeled as tool output rather than raw JSON.
 *
 * @param {Object} message - The message object from the database
 * @returns {string} The HTML for the message
 */
function renderMessage(message) {
  const role = escapeHtml(message.role);

  if (isToolResultOnlyContent(message.content)) {
    return `<li class="message tool-result"><span class="role">${role}</span><span class="tool-label">[tool output]</span></li>`;
  }

  const content = escapeHtml(message.content);
  return `<li class="message"><span class="role">${role}</span><span class="content">${content}</span></li>`;
}

/**
 * Builds the full self-contained HTML document for a conversation transcript.
 *
 * @param {string} conversationId - The conversation identifier
 * @param {Array} messages - The messages in chronological order
 * @returns {string} The HTML document
 */
function renderHtml(conversationId, messages) {
  const safeId = escapeHtml(conversationId);
  const generatedAt = new Date().toISOString();
  const messageCount = messages.length;

  const items = messages.map(renderMessage).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conversation ${safeId}</title>
<style>
  :root {
    color-scheme: light dark;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 24px;
    line-height: 1.5;
    color: #1a1a1a;
    background: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e5e5e5; background: #1a1a1a; }
  }
  header {
    border-bottom: 1px solid #ccc;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  h1 {
    font-size: 1.5rem;
    margin: 0 0 8px;
  }
  .meta {
    font-size: 0.875rem;
    color: #666;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li.message {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #f5f5f5;
  }
  @media (prefers-color-scheme: dark) {
    li.message { background: #2a2a2a; }
  }
  .role {
    display: inline-block;
    font-weight: 600;
    text-transform: capitalize;
    margin-right: 8px;
    color: #0b6e4f;
  }
  .content {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tool-label {
    font-style: italic;
    color: #888;
  }
</style>
</head>
<body>
<header>
  <h1>Conversation ${safeId}</h1>
  <div class="meta">Messages: ${messageCount} &middot; Generated: ${escapeHtml(generatedAt)}</div>
</header>
<ol>
${items}
</ol>
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
    const messages = await getConversationHistory(conversationId);
    const html = renderHtml(conversationId, messages);

    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      ...corsHeaders(request),
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="conversation-${conversationId}.html"`;
    }

    return new Response(html, { status: 200, headers });
  } catch (error) {
    console.error("Error exporting conversation HTML:", error);
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
