import { test, expect } from "@playwright/test";

test.describe("Deployment Plan", () => {
  test("page loads and shows header", async ({ page }) => {
    await page.goto("/my-leverage/deployment-plan");
    // If authenticated, check for page title
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toHaveText(/Skill Deployment Plan/);
  });

  test("shows empty state or deployment plan content", async ({ page }) => {
    await page.goto("/my-leverage/deployment-plan");
    // Page should show either empty state or plan content
    const pageContent = page.locator("[class*='max-w']").first();
    await expect(pageContent).toBeVisible({ timeout: 10000 });
    // Verify back link exists (use text to disambiguate from CTA button)
    const backLink = page.getByRole("link", { name: /Back to My Leverage/ });
    await expect(backLink).toBeVisible();
  });

  test("back link navigates to my-leverage", async ({ page }) => {
    await page.goto("/my-leverage/deployment-plan");
    const backLink = page.getByRole("link", { name: /Back to My Leverage/ });
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/my-leverage$/);
  });
});
