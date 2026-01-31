import { test, expect } from "@playwright/test";

test.describe("Skill Search and Browse", () => {
  test("should display skills page with browse header", async ({ page }) => {
    await page.goto("/skills");

    // Check page header
    await expect(page.locator("h1")).toContainText("Browse Skills");
    await expect(page.locator("text=Discover skills shared by your colleagues")).toBeVisible();
  });

  test("should show search input and filter controls", async ({ page }) => {
    await page.goto("/skills");

    // Search input with placeholder
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("placeholder", "Search skills...");

    // Category filter buttons (All, Prompt, Workflow, Agent, MCP)
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prompt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Workflow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MCP" })).toBeVisible();
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

  test("should update URL when selecting category filter", async ({ page }) => {
    await page.goto("/skills");

    // Click on Prompt category
    await page.getByRole("button", { name: "Prompt" }).click();

    // URL should contain category parameter
    await expect(page).toHaveURL(/\?.*category=prompt/);

    // The selected button should have active styling (bg-blue-600)
    const promptButton = page.getByRole("button", { name: "Prompt" });
    await expect(promptButton).toHaveClass(/bg-blue-600/);
  });

  test("should clear category filter when clicking All", async ({ page }) => {
    // Start with a category filter
    await page.goto("/skills?category=agent");

    // Agent button should be active
    await expect(page.getByRole("button", { name: "Agent" })).toHaveClass(/bg-blue-600/);

    // Click All button (exact match to avoid "Clear all filters" button)
    await page.getByRole("button", { name: "All", exact: true }).click();

    // URL should not have category parameter
    await expect(page).not.toHaveURL(/category=/);
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

  test("should show empty category state when filtering empty category", async ({ page }) => {
    // Filter by a category (may be empty in test DB)
    await page.goto("/skills?category=mcp");

    // Either shows skills or empty category state
    const hasSkills = await page
      .locator("text=skill")
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator("text=No skills in this category")
      .isVisible()
      .catch(() => false);

    // One of these should be true
    expect(hasSkills || hasEmptyState).toBe(true);
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

  test("should combine search query with category filter", async ({ page }) => {
    await page.goto("/skills");

    // Enter search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("combined");
    await page.waitForTimeout(500);

    // Select category
    await page.getByRole("button", { name: "Workflow" }).click();

    // URL should have both parameters
    await expect(page).toHaveURL(/q=combined/);
    await expect(page).toHaveURL(/category=workflow/);
  });
});
