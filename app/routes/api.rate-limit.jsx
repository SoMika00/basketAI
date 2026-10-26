/*
 * API route for reporting the current chat rate-limit status.
 * GET /api/rate-limit
 */
import { json } from "@remix-run/node";
import {
  deriveRateLimitKey,
  getRateLimitStatus,
  getRetryAfterSeconds,
} from "../services/rate-limit.server";

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
export async function loader({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    const key = deriveRateLimitKey(request, conversationId);
    const status = getRateLimitStatus(key);
    const retryAfterSeconds = getRetryAfterSeconds(key);

    return json(
      {
        key,
        count: status.count,
        max: status.max,
        window_ms: status.window_ms,
        remaining: status.remaining,
        retry_after_seconds: retryAfterSeconds,
      },
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("Error fetching rate-limit status:", error);
    return json(
      { error: "Failed to fetch rate-limit status" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

export default function RateLimitRoute() {
  // This route is API only; no UI component needed.
  return null;
}
