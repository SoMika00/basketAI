/*
 * Health check endpoint.
 * GET /health
 *
 * Reports service liveness and basic dependency status without making
 * external network calls to the LLM provider.
 */
import { json } from "@remix-run/node";
import { prisma } from "../db.server";

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
 * Determines the configured LLM provider without making external calls.
 * Mirrors the logic in app/services/llm.server.js.
 */
function getLlmProvider() {
  const provider =
    process.env.LLM_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "anthropic");
  return provider === "groq" ? "groq" : "anthropic";
}

/**
 * Performs a lightweight DB liveness probe with a short timeout.
 * @returns {Promise<boolean>} True if the database is reachable.
 */
async function probeDatabase() {
  const timeoutMs = parseInt(process.env.HEALTH_DB_TIMEOUT_MS || "2000", 10);

  const result = await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database probe timed out")), timeoutMs)
    ),
  ]);

  return Array.isArray(result) && result.length > 0;
}

/**
 * Loader function for GET /health and OPTIONS preflight.
 */
export async function loader({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime());
  const llmProvider = getLlmProvider();

  let database = "ok";
  try {
    await probeDatabase();
  } catch (error) {
    console.error("Health check database probe failed:", error);
    database = "error";
  }

  const healthy = database === "ok";
  const payload = {
    status: healthy ? "ok" : "degraded",
    uptime_seconds: uptimeSeconds,
    timestamp,
    checks: {
      database,
      llm_provider: llmProvider,
    },
  };

  return json(payload, {
    status: healthy ? 200 : 503,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store",
    },
  });
}

export default function HealthRoute() {
  // This route is API only; no UI component needed.
  return null;
}
