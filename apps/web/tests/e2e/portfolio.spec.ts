import { test, expect } from "@playwright/test";

test.describe("Portfolio Page", () => {
  test("should load /portfolio page with hero stats", async ({ page }) => {
    await page.goto("/portfolio");

    // Page header should be visible
    await expect(page.locator("h1")).toContainText("Portfolio");

    // Hero stat cards should be present
    await expect(page.getByText("Skills Authored")).toBeVisible();
    await expect(page.getByText("Total Uses")).toBeVisible();
    await expect(page.getByText("Hours Saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Contribution Rank")).toBeVisible();
  });

  test("should display portable vs company IP breakdown", async ({ page }) => {
    await page.goto("/portfolio");

    // IP breakdown sections should be visible
    await expect(page.getByText("Portable Skills")).toBeVisible();
    await expect(page.getByText("Company Skills")).toBeVisible();
  });

  test("should show portfolio link in header nav", async ({ page }) => {
    await page.goto("/portfolio");

    // Portfolio nav link should exist in header
    await expect(page.getByRole("link", { name: "Portfolio" })).toBeVisible();
  });

  test("should display skills list section", async ({ page }) => {
    await page.goto("/portfolio");

    // Skills list section should be visible
    await expect(page.getByText("Your Skills")).toBeVisible();
  });
});
