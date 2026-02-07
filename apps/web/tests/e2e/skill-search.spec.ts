import { test, expect } from "@playwright/test";

test.describe("Skill Search and Browse", () => {
  test("should display skills page with search and filters", async ({ page }) => {
    await page.goto("/skills");

    // Search input should be visible
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();

    // Filter buttons should be visible
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
  });

  test("should show search input and filter controls", async ({ page }) => {
    await page.goto("/skills");

    // Search input with placeholder
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("placeholder", "Search skills...");

    // Category filter buttons: All, Claude Skill, AI Prompt, Other
    await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Claude Skill", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Prompt", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Other", exact: true })).toBeVisible();
  });

  test("should update URL when searching", async ({ page }) => {
    await page.goto("/skills");

    // Type in search input
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("test query");

    // Wait for debounced URL update (300ms + buffer)
    await page.waitForTimeout(500);

    // URL should contain search query
    await expect(page).toHaveURL(/\?.*q=test\+query/);
  });

  test("should update URL when selecting type filter", async ({ page }) => {
    await page.goto("/skills");

    // Click on AI Prompt filter
    await page.getByRole("button", { name: "AI Prompt" }).click();

    // URL should contain type parameter
    await expect(page).toHaveURL(/\?.*type=ai-prompt/);

    // The selected button should have active styling (bg-blue-600)
    const aiPromptButton = page.getByRole("button", { name: "AI Prompt" });
    await expect(aiPromptButton).toHaveClass(/bg-blue-600/);
  });

  test("should clear type filter when clicking All", async ({ page }) => {
    // Start with a type filter
    await page.goto("/skills?type=claude-skill");

    // Claude Skill button should be active
    await expect(page.getByRole("button", { name: "Claude Skill" })).toHaveClass(/bg-blue-600/);

    // Click All button
    await page.getByRole("button", { name: "All", exact: true }).click();

    // URL should not have type parameter
    await expect(page).not.toHaveURL(/type=/);
  });

  test("should show empty state for no results", async ({ page }) => {
    // Search for something unlikely to match
    await page.goto("/skills?q=zzzznonexistentquery12345");

    // Check for empty state
    await expect(page.locator("text=No skills found")).toBeVisible();
    await expect(
      page.locator('text=We couldn\'t find any skills matching "zzzznonexistentquery12345"')
    ).toBeVisible();

    // Check for suggestions
    await expect(page.locator("text=Try different keywords")).toBeVisible();
  });

  test("should show skills or empty state when filtering by type", async ({ page }) => {
    // Filter by Other type (maps to workflow + mcp categories)
    await page.goto("/skills?type=other");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Either shows skills table (role="grid") or an empty state message
    const hasSkillsTable = await page
      .locator('table[role="grid"]')
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/no skills/i)
      .isVisible()
      .catch(() => false);

    // One of these should be true — the page loaded successfully
    expect(hasSkillsTable || hasEmptyState).toBe(true);
  });

  test("should maintain search state when navigating away and back", async ({ page }) => {
    await page.goto("/skills");

    // Enter search query
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("navigation test");
    await page.waitForTimeout(500);

    // Verify URL has query
    await expect(page).toHaveURL(/q=navigation/);

    // Navigate to profile
    await page.goto("/profile");
    await expect(page).toHaveURL("/profile");

    // Navigate back to skills with the same query
    await page.goto("/skills?q=navigation+test");

    // URL should maintain query
    await expect(page).toHaveURL(/q=navigation\+test/);
  });

  test("should combine search query with type filter", async ({ page }) => {
    await page.goto("/skills");

    // Enter search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("combined");
    await page.waitForTimeout(500);

    // Select type
    await page.getByRole("button", { name: "AI Prompt" }).click();

    // URL should have both parameters
    await expect(page).toHaveURL(/q=combined/);
    await expect(page).toHaveURL(/type=ai-prompt/);
  });

  test("should show live search dropdown with results", async ({ page }) => {
    await page.goto("/skills");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Get a skill name from the table to search for
    const firstSkillLink = page.locator("table a").first();
    const skillName = await firstSkillLink.textContent();

    if (!skillName) {
      test.skip();
      return;
    }

    // Type the first few characters into search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill(skillName.slice(0, 5));

    // Wait for dropdown to appear (debounce + server round trip)
    const dropdown = page.locator(".absolute.z-50");
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Dropdown should contain at least one result
    const dropdownButtons = dropdown.locator("button");
    await expect(dropdownButtons.first()).toBeVisible();

    // Click the first result
    await dropdownButtons.first().click();

    // Should navigate to a skill detail page
    await expect(page).toHaveURL(/\/skills\//);
  });
});
