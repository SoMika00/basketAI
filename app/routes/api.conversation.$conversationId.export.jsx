/*
 * API route for exporting a conversation transcript.
 * GET /api/conversation/:conversationId/export
 */
import { json } from "@remix-run/node";
import { getConversationHistory, getConversation } from "../db.server";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

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
 * Parses and validates the `limit` query parameter.
 *
 * @param {string|null} raw - Raw query parameter value
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function parseLimit(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: DEFAULT_LIMIT };
  }

  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "limit must be an integer between 1 and 500" };
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
    return { ok: false, error: "limit must be an integer between 1 and 500" };
  }

  return { ok: true, value };
}

/**
 * Builds the export payload for a conversation.
 *
 * @param {string} conversationId - The conversation identifier
 * @param {{ limit?: number }} [options] - Options
 * @returns {Promise<{ conversation_id: string, message_count: number, messages: Array }>}
 */
export async function buildExportPayload(conversationId, { limit = DEFAULT_LIMIT } = {}) {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }

  const allMessages = await getConversationHistory(conversationId);
  const messages = allMessages.slice(-limit);

  return {
    conversation_id: conversationId,
    message_count: messages.length,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    })),
  };
}

/**
 * Renders the export payload as markdown.
 *
 * @param {Object} payload - The export payload
 * @returns {string}
 */
function renderMarkdown(payload) {
  const lines = [];
  for (const message of payload.messages) {
    lines.push(`## ${message.role} — ${message.created_at}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Loader function for GET requests and OPTIONS preflight.
 */
export async function exportLoader({ request, params }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const conversationId = params.conversationId;

  if (!conversationId || conversationId.trim() === "") {
    return json(
      { error: "conversationId is required" },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "json";
  const limitResult = parseLimit(url.searchParams.get("limit"));

  if (!limitResult.ok) {
    return json(
      { error: limitResult.error },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  if (format !== "json" && format !== "markdown") {
    return json(
      { error: "format must be either 'json' or 'markdown'" },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    const payload = await buildExportPayload(conversationId, {
      limit: limitResult.value,
    });

    if (format === "markdown") {
      const body = renderMarkdown(payload);
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="conversation-${conversationId}.md"`,
        },
      });
    }

    return json(payload, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Disposition": `attachment; filename="conversation-${conversationId}.json"`,
      },
    });
  } catch (error) {
    if (error.status === 404) {
      return json(
        { error: "Conversation not found" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    console.error("Error exporting conversation:", error);
    return json(
      { error: "Failed to export conversation" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * Loader function for GET requests and OPTIONS preflight.
 */
export async function loader(args) {
  return exportLoader(args);
}

export default function ExportRoute() {
  // This route is API only; no UI component needed.
  return null;
}
