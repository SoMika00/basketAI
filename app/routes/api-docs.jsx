/*
 * Swagger UI route for interactive API documentation.
 * GET /api-docs
 *
 * Serves the Swagger UI bundle and points it at the existing OpenAPI spec
 * served from /api/openapi.json.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
 * Resolves the absolute path to the swagger-ui-dist package directory.
 * Uses import.meta.resolve so it works in both dev and production builds.
 */
function resolveSwaggerUiDist() {
  const specifier = "swagger-ui-dist";
  const resolved = import.meta.resolve(specifier);
  return fileURLToPath(new URL(".", resolved));
}

/**
 * Loads the Swagger UI CSS and JS bundles from the installed package.
 * @returns {Promise<{css: string, js: string}>}
 */
async function loadSwaggerAssets() {
  const distDir = resolveSwaggerUiDist();
  const [css, js] = await Promise.all([
    readFile(path.join(distDir, "swagger-ui.css"), "utf8"),
    readFile(path.join(distDir, "swagger-ui-bundle.js"), "utf8"),
  ]);
  return { css, js };
}

/**
 * Builds the Swagger UI HTML page.
 * @param {string} css - Inlined Swagger UI CSS
 * @param {string} js - Inlined Swagger UI bundle JS
 * @returns {string} Full HTML document
 */
function renderSwaggerUi(css, js) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>${css}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script>${js}</script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
        deepLinking: true,
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Loader function for GET /api-docs and OPTIONS preflight.
 */
export async function loader({ request }) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    const { css, js } = await loadSwaggerAssets();
    const html = renderSwaggerUi(css, js);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error serving Swagger UI:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load Swagger UI" }),
      {
        status: 500,
        headers: {
          ...corsHeaders(request),
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export default function ApiDocsRoute() {
  // This route returns HTML directly from the loader; no UI component needed.
  return null;
}
