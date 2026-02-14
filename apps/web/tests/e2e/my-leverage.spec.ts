import { test, expect } from "@playwright/test";

test.describe("My Leverage Page", () => {
  test("should load /my-leverage page with EmailDiagnosticCard", async ({ page }) => {
    await page.goto("/my-leverage");

    // Wait for page to load
    await expect(page.locator("h1")).toContainText("My Leverage");

    // Verify EmailDiagnosticCard is present
    await expect(page.locator("text=Email Time Diagnostic")).toBeVisible();
    await expect(page.locator("text=Analyze where your email time goes")).toBeVisible();
    await expect(page.locator("button:has-text('Run Diagnostic')")).toBeVisible();
  });

  test("should display Run Diagnostic button in initial state", async ({ page }) => {
    await page.goto("/my-leverage");

    // Verify initial state description
    await expect(
      page.locator("text=Run a diagnostic scan to see how much time you spend on email")
    ).toBeVisible();

    // Verify button is enabled
    const runButton = page.locator("button:has-text('Run Diagnostic')");
    await expect(runButton).toBeEnabled();
  });
});
