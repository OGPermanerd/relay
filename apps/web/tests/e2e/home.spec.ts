import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should load and display Relay heading", async ({ page }) => {
    await page.goto("/");

    // Check that the main heading is visible
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Relay");

    // Check subtitle content
    await expect(page.getByText("Internal Skill Marketplace")).toBeVisible();
    await expect(
      page.getByText("Connect with colleagues who have the skills you need")
    ).toBeVisible();
  });

  test("should have valid HTML structure", async ({ page }) => {
    await page.goto("/");

    // Verify html element has lang attribute
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang");

    // Verify body exists
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Verify main content area exists
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
