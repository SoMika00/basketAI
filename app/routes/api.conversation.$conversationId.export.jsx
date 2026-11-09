/*
 * API route for exporting a conversation transcript.
 * GET /api/conversation/:conversationId/export[.txt|.md|.csv|.json]
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
 * Maps a format extension to its Content-Type and export formatter.
 */
const FORMATS = {
  txt: {
    contentType: "text/plain; charset=utf-8",
    format: (messages) =>
      messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n\n"),
  },
  md: {
    contentType: "text/markdown; charset=utf-8",
    format: (messages) =>
      messages
        .map((m) => `## ${m.role}\n\n${m.content}`)
        .join("\n\n"),
  },
  csv: {
    contentType: "text/csv; charset=utf-8",
    format: (messages) => {
      const escape = (value) => {
        const str = String(value ?? "");
        if (/[\",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const header = "role,content,created_at";
      const rows = messages.map((m) =>
        [m.role, m.content, new Date(m.createdAt).toISOString()]
          .map(escape)
          .join(",")
      );
      return [header, ...rows].join("\n");
    },
  },
  json: {
    contentType: "application/json; charset=utf-8",
    format: (messages) =>
      JSON.stringify(
        messages.map((m) => ({
          role: m.role,
          content: m.content,
          created_at: new Date(m.createdAt).toISOString(),
        })),
        null,
        2
      ),
  },
};

/**
 * Resolves the requested export format from the URL pathname.
 * Supports `/export` (defaults to txt) and `/export.<ext>`.
 *
 * @param {URL} url - Parsed request URL
 * @returns {string} The resolved extension (txt, md, csv, or json)
 */
function resolveFormat(url) {
  const match = url.pathname.match(/\.(txt|md|csv|json)$/);
  return match ? match[1] : "txt";
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
    const extension = resolveFormat(url);
    const format = FORMATS[extension];

    const messages = await getConversationHistory(conversationId);
    const body = format.format(messages);

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Type": format.contentType,
        "Content-Disposition": buildContentDisposition(conversationId, extension),
      },
    });
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
