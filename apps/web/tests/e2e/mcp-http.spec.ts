import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test Group 1: MCP HTTP Endpoint
// ---------------------------------------------------------------------------
test.describe("MCP HTTP Endpoint", () => {
  test("rejects unauthenticated MCP requests with 401", async ({ page, baseURL }) => {
    // Use page.evaluate for raw fetch (same-origin, no custom headers needed)
    await page.goto("/login");

    const result = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/mcp/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
          id: 1,
        }),
      });
      return { status: res.status };
    }, baseURL!);

    expect(result.status).toBe(401);
  });

  test("returns CORS headers for Claude.ai origin on OPTIONS", async ({ request }) => {
    // Use Playwright request API for CORS tests (browser fetch cannot set Origin header)
    const response = await request.fetch("/api/mcp/mcp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://claude.ai",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization, Mcp-Session-Id",
      },
    });

    expect(response.status()).toBe(204);
    expect(response.headers()["access-control-allow-origin"]).toBe("https://claude.ai");
    expect(response.headers()["access-control-allow-headers"]).toContain("Authorization");
    expect(response.headers()["access-control-allow-headers"]).toContain("Mcp-Session-Id");
    expect(response.headers()["access-control-expose-headers"]).toContain("Mcp-Session-Id");
  });

  test("rejects CORS for unauthorized origins", async ({ request }) => {
    const response = await request.fetch("/api/mcp/mcp", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    // The allow-origin should be empty (not the evil origin)
    const allowOrigin = response.headers()["access-control-allow-origin"] ?? "";
    expect(allowOrigin).not.toBe("https://evil.com");
  });

  test("rejects invalid bearer token with 401", async ({ page, baseURL }) => {
    await page.goto("/login");

    const result = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/mcp/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rlk_invalid_key_here_for_testing",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
          id: 1,
        }),
      });
      return { status: res.status };
    }, baseURL!);

    expect(result.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: MCP Connect UI on Profile
// ---------------------------------------------------------------------------
test.describe("MCP Connect UI on Profile", () => {
  test("profile page shows MCP Connection section", async ({ page }) => {
    await page.goto("/profile");

    // Check for MCP Connection heading
    await expect(page.locator("text=MCP Connection")).toBeVisible();

    // Check for Connect to Claude.ai heading within the component
    await expect(page.locator("text=Connect to Claude.ai")).toBeVisible();

    // Check that the MCP server URL is displayed
    await expect(page.locator("text=api/mcp/mcp")).toBeVisible();

    // Check that the Copy URL button is visible
    await expect(page.getByRole("button", { name: /Copy URL/i })).toBeVisible();

    // Check setup instructions are present
    await expect(page.locator("text=Setup instructions")).toBeVisible();
    await expect(page.locator("text=Open Claude.ai Settings")).toBeVisible();
  });
});
