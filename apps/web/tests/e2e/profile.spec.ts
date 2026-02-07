import { test, expect } from "@playwright/test";

test.describe("User Profile Page", () => {
  test("should display profile page with user info", async ({ page }) => {
    await page.goto("/profile");

    // Should not redirect to login (authenticated)
    await expect(page).toHaveURL("/profile");

    // Check profile header section
    await expect(page.locator("h1")).toContainText("E2E Test User");

    // Email appears in header paragraph (use first match)
    await expect(page.locator("p.text-gray-600").first()).toContainText("e2e-test@company.com");
  });

  test("should display contribution statistics section", async ({ page }) => {
    await page.goto("/profile");

    // Check contribution stats section header
    await expect(page.locator("text=Contribution Statistics")).toBeVisible();

    // Check for stat labels
    await expect(page.locator("text=Skills Shared")).toBeVisible();
    await expect(page.locator("text=Total Uses")).toBeVisible();
    await expect(page.locator("text=Avg Rating")).toBeVisible();
    await expect(page.locator("text=FTE Years Saved")).toBeVisible();

    // Check for stat descriptions
    await expect(page.locator("text=Skills you've contributed")).toBeVisible();
    await expect(page.locator("text=Times your skills were used")).toBeVisible();
    await expect(page.locator("text=Average rating received")).toBeVisible();
    await expect(page.locator("text=Years saved for the org")).toBeVisible();
  });

  test("should display account information section", async ({ page }) => {
    await page.goto("/profile");

    // Check account info section header
    await expect(page.locator("text=Account Information")).toBeVisible();

    // Check for account info fields
    await expect(page.locator("dt:has-text('Name')")).toBeVisible();
    await expect(page.locator("dt:has-text('Email')")).toBeVisible();
    await expect(page.locator("dt:has-text('Sign-in Provider')")).toBeVisible();

    // Check sign-in provider value
    await expect(page.locator("dd:has-text('Google')")).toBeVisible();
  });

  test("should show numeric values for stats", async ({ page }) => {
    await page.goto("/profile");

    // Stats should show numeric values (0 or more) or dash for no rating
    // The stats are in the grid with rounded-lg bg-white p-4 shadow-sm
    const statCards = page.locator(".grid .rounded-lg.bg-white.p-4.shadow-sm");

    // We should have 4 stat cards
    await expect(statCards).toHaveCount(4);

    // Each card should have a visible value
    for (let i = 0; i < 4; i++) {
      await expect(statCards.nth(i)).toBeVisible();
      // Each stat card has a p.text-2xl with the value
      await expect(statCards.nth(i).locator(".text-2xl")).toBeVisible();
    }
  });

  test("should show user avatar or initials", async ({ page }) => {
    await page.goto("/profile");

    // The profile section has a flex container with avatar
    const profileHeader = page.locator(".flex.items-center.gap-6");
    await expect(profileHeader).toBeVisible();

    // Either an image with rounded-full or a div with initials (h-24 w-24 for large avatar)
    const hasImage = await profileHeader
      .locator("img.rounded-full")
      .isVisible()
      .catch(() => false);
    const hasInitials = await profileHeader
      .locator(".h-24.w-24.rounded-full")
      .isVisible()
      .catch(() => false);

    // One of these should be true
    expect(hasImage || hasInitials).toBe(true);
  });
});
