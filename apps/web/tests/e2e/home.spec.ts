import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Visiting home page should redirect to login
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should display login page with sign-in option", async ({ page }) => {
    await page.goto("/login");

    // Check that the page loads
    await expect(page.locator("body")).toBeVisible();

    // Check for sign-in button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should have valid HTML structure", async ({ page }) => {
    await page.goto("/login");

    // Verify html element has lang attribute
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang");

    // Verify body exists
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
