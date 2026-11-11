import { describe, it, expect } from "vitest";
import { loader } from "./api-docs.jsx";

function createRequest(url, method = "GET", headers = {}) {
  return new Request(url, { method, headers });
}

describe("api-docs route", () => {
  it("returns a 200 HTML response containing the Swagger UI interface", async () => {
    const request = createRequest("http://localhost/api-docs");
    const response = await loader({ request });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("swagger-ui");
    expect(html).toContain("SwaggerUIBundle");
    expect(html).toContain("/api/openapi.json");
  });

  it("returns a 204 response with CORS headers for OPTIONS preflight", async () => {
    const request = createRequest(
      "http://localhost/api-docs",
      "OPTIONS",
      { Origin: "https://example.com" }
    );
    const response = await loader({ request });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
