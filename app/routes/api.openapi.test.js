import { describe, it, expect } from "vitest";
import { createRequest } from "@remix-run/node";
import { loader as openapiLoader } from "../routes/api.openapi.jsx";

describe("OpenAPI spec", () => {
  it("includes /api/tools path with correct parameters", async () => {
    const request = createRequest("http://localhost/api/openapi.json");
    const response = await openapiLoader({ request });
    const data = await response.json();

    expect(data).toHaveProperty("openapi", "3.0.0");
    expect(data.paths).toHaveProperty("/api/tools");
    const getOp = data.paths["/api/tools"].get;
    expect(getOp).toBeDefined();
    const paramNames = getOp.parameters.map((p) => p.name);
    expect(paramNames).toContain("type");
    expect(paramNames).toContain("conversationId");
    const typeParam = getOp.parameters.find((p) => p.name === "type");
    expect(typeParam.schema.enum).toEqual(["storefront", "customer", "all"]);
  });
});
