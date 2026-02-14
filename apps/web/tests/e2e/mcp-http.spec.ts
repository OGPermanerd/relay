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
  test("profile page shows Integration Setup section", async ({ page }) => {
    await page.goto("/profile");

    // Check for Integration Setup heading (SetupWizard component)
    await expect(page.locator("text=Integration Setup")).toBeVisible();

    // New users see "Connect to Claude" wizard step
    // Existing users with keys see "Connected" status with Manage Keys button
    const hasKeys = await page
      .locator("text=Connected")
      .isVisible()
      .catch(() => false);
    if (hasKeys) {
      await expect(page.getByRole("button", { name: /Manage Keys/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Reconfigure/i })).toBeVisible();
    } else {
      await expect(page.locator("text=Connect to Claude")).toBeVisible();
      await expect(page.getByRole("button", { name: /Generate Connection Key/i })).toBeVisible();
    }
  });
});
