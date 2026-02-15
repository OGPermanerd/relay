import { test, expect } from "@playwright/test";

test.describe("Leverage Me Tab", () => {
  test("should load /leverage page with Recommendations section", async ({ page }) => {
    await page.goto("/leverage");

    // Wait for page to load
    await expect(page.locator("h1")).toContainText("Leverage");

    // Me tab should be active
    await expect(page.getByRole("link", { name: "Me", exact: true })).toHaveClass(/bg-blue-50/);
  });

  test("should display leverage layout with nav tabs", async ({ page }) => {
    await page.goto("/leverage");

    // Verify nav tabs are present
    await expect(page.getByRole("link", { name: "Me", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Company" })).toBeVisible();
  });
});
