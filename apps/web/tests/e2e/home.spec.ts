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
test.describe("Home Page Tabs", () => {
  test("should show Browse Skills tab by default with CTAs", async ({ page }) => {
    await page.goto("/");

    // Check for Browse Skills tab button
    await expect(page.getByRole("button", { name: /Browse Skills/i })).toBeVisible();

    // The browse content should be visible (e.g., "Trending Skills" heading)
    await expect(page.getByRole("heading", { name: "Trending Skills" })).toBeVisible();

    // CTA cards should be visible (use link roles to avoid matching empty-state text)
    await expect(page.getByRole("link", { name: /Create Leverage.*Share a Skill/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Get Leverage.*Install a Skill/i })).toBeVisible();
  });

  test("should show My Leverage tab when clicked", async ({ page }) => {
    await page.goto("/");

    // Click the My Leverage tab
    await page.getByRole("button", { name: /My Leverage/i }).click();

    // URL should update with ?view=leverage
    await expect(page).toHaveURL(/[?&]view=leverage/);

    // Leverage content should be visible (use heading role to avoid ambiguity with stat card labels)
    await expect(page.getByRole("heading", { name: "Skills Used" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skills Created" })).toBeVisible();
  });

  test("should load My Leverage tab directly via URL", async ({ page }) => {
    await page.goto("/?view=leverage");

    // My Leverage content should be visible (use heading role to avoid ambiguity)
    await expect(page.getByRole("heading", { name: "Skills Used" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skills Created" })).toBeVisible();
  });

  test("should show Skills Used and Skills Created headings on leverage tab", async ({ page }) => {
    await page.goto("/?view=leverage");

    // Both section headings should be visible
    const skillsUsedHeading = page.locator("h2").filter({ hasText: "Skills Used" });
    const skillsCreatedHeading = page.locator("h2").filter({ hasText: "Skills Created" });

    await expect(skillsUsedHeading).toBeVisible();
    await expect(skillsCreatedHeading).toBeVisible();
  });

  test("should render stat cards on leverage tab", async ({ page }) => {
    await page.goto("/?view=leverage");

    // StatCard labels from the MyLeverageView component
    // Skills Used section stat cards
    await expect(page.getByText("Years Saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Actions")).toBeVisible();
    await expect(page.getByText("Most Used")).toBeVisible();

    // Skills Created section stat cards
    await expect(page.getByText("Skills Published")).toBeVisible();
    await expect(page.getByText("Years Saved by Others")).toBeVisible();
    await expect(page.getByText("Unique Users")).toBeVisible();
  });

  test("should switch back to Browse Skills from leverage tab", async ({ page }) => {
    await page.goto("/?view=leverage");

    // Verify leverage content is showing
    await expect(page.getByText("Years Saved", { exact: true })).toBeVisible();

    // Click Browse Skills tab
    await page.getByRole("button", { name: /Browse Skills/i }).click();

    // Browse content should now be visible
    await expect(page.getByRole("heading", { name: "Trending Skills" })).toBeVisible();

    // Leverage-specific content should not be visible
    await expect(page.getByText("Years Saved", { exact: true })).not.toBeVisible();
  });
});
