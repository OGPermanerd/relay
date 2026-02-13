import { test, expect } from "@playwright/test";

// Unauthenticated tests
test.describe("Authentication Flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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

// Authenticated home page tests (use default authenticated storage state)
test.describe("Home Page", () => {
  test("should show search-first hero with discovery search", async ({ page }) => {
    await page.goto("/");

    // Welcome heading should be visible
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();

    // Discovery search input should be visible
    await expect(page.getByPlaceholder(/Describe what you need/i)).toBeVisible();
  });

  test("should show category tiles", async ({ page }) => {
    await page.goto("/");

    // Category tile labels should be visible (use heading role for specificity)
    await expect(page.getByRole("heading", { name: "Prompts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "MCP Tools" })).toBeVisible();
  });

  test("should show trending skills section", async ({ page }) => {
    await page.goto("/");

    // Trending Skills heading should be visible
    await expect(page.getByRole("heading", { name: "Trending Skills" })).toBeVisible();
  });

  test("should show compact stats bar", async ({ page }) => {
    await page.goto("/");

    // Stats bar should show key metrics inline text (use specific patterns to avoid ambiguity)
    await expect(page.getByText(/\d+ contributors/i)).toBeVisible();
    await expect(page.getByText(/\d[\d.]* FTE years saved/i)).toBeVisible();
  });

  test("should show top contributors leaderboard", async ({ page }) => {
    await page.goto("/");

    // Top Contributors heading should be visible
    await expect(page.getByRole("heading", { name: "Top Contributors" })).toBeVisible();
  });

  test("should show mini leverage widget with Your Impact", async ({ page }) => {
    await page.goto("/");

    // Your Impact heading should be visible
    await expect(page.getByText("Your Impact")).toBeVisible();

    // Link to full leverage page
    await expect(page.getByRole("link", { name: /View full details/i })).toBeVisible();
  });

  test("should show CTA cards for sharing and browsing skills", async ({ page }) => {
    await page.goto("/");

    // CTA cards should be visible
    await expect(page.getByRole("link", { name: /Create Leverage.*Share a Skill/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Get Leverage.*Browse All Skills/i })
    ).toBeVisible();
  });

  test("should not have any tab navigation", async ({ page }) => {
    await page.goto("/");

    // No tab buttons should exist (old UI had Browse Skills and My Leverage tabs)
    await expect(page.getByRole("button", { name: /Browse Skills/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /My Leverage/i })).not.toBeVisible();
  });

  test("should have category tiles that link to filtered browse", async ({ page }) => {
    await page.goto("/");

    // Category tiles should link to /skills?category=X
    const promptLink = page.getByRole("link", { name: /Prompts.*skills/i });
    await expect(promptLink).toBeVisible();
    await expect(promptLink).toHaveAttribute("href", "/skills?category=prompt");
  });
});
