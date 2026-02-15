import { test, expect } from "@playwright/test";

test.describe("Deployment Plan", () => {
  test("page loads and shows header", async ({ page }) => {
    await page.goto("/leverage/deployment-plan");
    // Check for the page title (second h1 after layout title)
    await expect(page.getByRole("heading", { name: /Skill Deployment Plan/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows empty state or deployment plan content", async ({ page }) => {
    await page.goto("/leverage/deployment-plan");
    // Page should show either empty state or plan content
    const pageContent = page.locator("[class*='max-w']").first();
    await expect(pageContent).toBeVisible({ timeout: 10000 });
    // Verify back link exists
    const backLink = page.getByRole("link", { name: /Back to Leverage/ });
    await expect(backLink).toBeVisible();
  });

  test("back link navigates to leverage", async ({ page }) => {
    await page.goto("/leverage/deployment-plan");
    const backLink = page.getByRole("link", { name: /Back to Leverage/ });
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/leverage$/);
  });
});
