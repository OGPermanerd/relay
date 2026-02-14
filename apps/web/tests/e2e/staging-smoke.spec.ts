/**
 * Staging smoke test — verifies the deployed staging site loads without errors.
 *
 * Run standalone: npx playwright test tests/e2e/staging-smoke.spec.ts
 * Runs automatically after deploy via deploy.sh
 *
 * Uses STAGING_URL env var (defaults to https://staging.everyskill.ai).
 * Does NOT require auth setup — only checks that pages render without crashes.
 */
import { test, expect, type Page } from "@playwright/test";

const STAGING_URL = process.env.STAGING_URL || "https://staging.everyskill.ai";

// Collect client-side errors during page load
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore expected errors (favicon, auth redirects)
      if (!text.includes("favicon") && !text.includes("Failed to load resource")) {
        errors.push(`[console.error] ${text}`);
      }
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

test.describe("Staging Smoke Test", () => {
  // No auth needed — these tests verify pages load without client-side crashes
  test.use({ storageState: { cookies: [], origins: [] } });

  test("homepage or login page loads without client-side exceptions", async ({ page }) => {
    const errors = collectErrors(page);

    const response = await page.goto(STAGING_URL, { timeout: 15000 });
    expect(response?.status()).toBeLessThan(500);

    // Should land on login page (unauthenticated) or homepage
    await page.waitForLoadState("networkidle");

    // Page should have rendered something
    await expect(page.locator("body")).toBeVisible();

    // No client-side exceptions
    const clientExceptions = errors.filter((e) => e.includes("[pageerror]"));
    expect(clientExceptions).toHaveLength(0);
  });

  test("health endpoint returns healthy", async ({ request }) => {
    const response = await request.get(`${STAGING_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.db).toBe(true);
  });

  test("login page renders without errors", async ({ page }) => {
    const errors = collectErrors(page);

    const response = await page.goto(`${STAGING_URL}/login`, { timeout: 15000 });
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState("networkidle");

    // Should show sign-in UI
    const signInButton = page.getByRole("button", { name: /sign in/i });
    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInButton.or(signInLink)).toBeVisible();

    // No client-side exceptions
    const clientExceptions = errors.filter((e) => e.includes("[pageerror]"));
    expect(clientExceptions).toHaveLength(0);
  });
});
