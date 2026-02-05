import { test, expect } from "@playwright/test";

test.describe("Install Callback API", () => {
  test("accepts valid POST with platform and os", async ({ request }) => {
    const response = await request.post("/api/install-callback", {
      data: { platform: "claude-desktop", os: "linux" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test("returns 400 for invalid JSON body", async ({ page, baseURL }) => {
    // Navigate to a page first so page.evaluate has proper context
    await page.goto("/login");
    // Use page.evaluate with the full URL to send truly invalid JSON
    const result = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/install-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });
      return { status: res.status, body: await res.json() };
    }, baseURL!);
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Invalid JSON body");
  });

  test("accepts POST without API key (anonymous install)", async ({ request }) => {
    const response = await request.post("/api/install-callback", {
      data: { platform: "claude-code", os: "darwin" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  test("accepts POST with all optional fields", async ({ request }) => {
    const response = await request.post("/api/install-callback", {
      data: {
        platform: "other-ide",
        os: "windows",
        clientVersion: "1.0.0",
        skillId: "nonexistent-skill-id",
        key: "rlk_invalid_key_for_testing",
      },
    });
    // Should still return 200 (invalid key is treated as anonymous)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
