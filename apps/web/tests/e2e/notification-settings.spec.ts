import { test, expect } from "@playwright/test";

test.describe("Notification Settings Page", () => {
  test("should display notification preferences page with all sections", async ({ page }) => {
    await page.goto("/settings/notifications");

    // Should not redirect to login (authenticated)
    await expect(page).toHaveURL("/settings/notifications");

    // Check settings layout heading (notifications is within the shared settings layout)
    await expect(page.locator("h1")).toContainText("Settings");

    // Check three sections are visible
    await expect(page.locator("text=Skill Grouping Requests")).toBeVisible();
    await expect(page.locator("text=Trending Skills Digest")).toBeVisible();
    await expect(page.locator("text=Platform Updates")).toBeVisible();

    // Check descriptions
    await expect(
      page.locator("text=When someone proposes grouping a skill under yours")
    ).toBeVisible();
    await expect(
      page.locator("text=Regular digest of trending skills in your organization")
    ).toBeVisible();
    await expect(page.locator("text=Feature releases and platform improvements")).toBeVisible();
  });

  test("should have checkboxes and frequency select", async ({ page }) => {
    await page.goto("/settings/notifications");

    // Should have 6 checkboxes (2 grouping, 2 platform, 2 review)
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(6);

    // Should have frequency select
    const select = page.locator('select[name="trendingDigest"]');
    await expect(select).toBeVisible();
    // Value depends on DB state (may have been modified by prior test runs)
    const value = await select.inputValue();
    expect(["none", "daily", "weekly"]).toContain(value);

    // Should have save button
    await expect(page.getByRole("button", { name: "Save Preferences" })).toBeVisible();
  });

  test("should save preferences and show success feedback", async ({ page }) => {
    await page.goto("/settings/notifications");

    // Uncheck a preference
    const groupingEmailCheckbox = page.locator('input[name="groupingProposalEmail"]');
    await groupingEmailCheckbox.uncheck();

    // Change digest frequency
    const select = page.locator('select[name="trendingDigest"]');
    await select.selectOption("daily");

    // Submit form
    await page.getByRole("button", { name: "Save Preferences" }).click();

    // Should show success message
    await expect(page.locator("text=Preferences saved successfully")).toBeVisible();
  });
});
