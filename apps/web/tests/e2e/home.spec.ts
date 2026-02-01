import { test, expect } from "@playwright/test";

// These tests run without authentication to test unauthenticated flows
test.use({ storageState: { cookies: [], origins: [] } });

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

    // Check for sign-in button or link
    const signInButton = page.getByRole("button", { name: /sign in/i });
    const signInLink = page.getByRole("link", { name: /sign in/i });
    const anySignIn = signInButton.or(signInLink);
    await expect(anySignIn).toBeVisible();
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
