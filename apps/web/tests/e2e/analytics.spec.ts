import { test, expect } from "@playwright/test";

test.describe("Leverage Dashboard", () => {
  test("loads leverage page with Me tab active", async ({ page }) => {
    await page.goto("/leverage");

    // Layout header
    await expect(page.getByRole("heading", { name: "Leverage", level: 1 })).toBeVisible();

    // Me tab should be active (blue pill style)
    await expect(page.getByRole("link", { name: "Me", exact: true })).toHaveClass(/bg-blue-50/);
  });

  test("company tab shows overview stats", async ({ page }) => {
    await page.goto("/leverage/company");

    // My Company tab should be active
    await expect(page.getByRole("link", { name: "My Company" })).toHaveClass(/bg-blue-50/);

    // Stat cards visible on overview tab
    await expect(page.getByText("Total Hours Saved")).toBeVisible();
    await expect(page.getByText("Active Employees")).toBeVisible();
    await expect(page.getByText("Skills Deployed")).toBeVisible();
  });

  test("time range selector updates URL on company tab", async ({ page }) => {
    await page.goto("/leverage/company");

    // Default should be 30d (bg-blue-600 active class)
    await expect(page.getByRole("button", { name: "30 days" })).toHaveClass(/bg-blue-600/);

    // Click 7 days
    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page).toHaveURL(/[?&]range=7d/);
    await expect(page.getByRole("button", { name: "7 days" })).toHaveClass(/bg-blue-600/);

    // Click 90 days
    await page.getByRole("button", { name: "90 days" }).click();
    await expect(page).toHaveURL(/[?&]range=90d/);
    await expect(page.getByRole("button", { name: "90 days" })).toHaveClass(/bg-blue-600/);
  });

  test("export button is visible on company tab", async ({ page }) => {
    await page.goto("/leverage/company");

    // Export CSV button should be visible
    const exportBtn = page.getByRole("button", { name: /Export CSV/i });
    await expect(exportBtn).toBeVisible();

    // Handle the alert dialog that appears when there is no data
    page.on("dialog", (dialog) => dialog.dismiss());
    await exportBtn.click();
    await expect(exportBtn).toBeVisible();
  });

  test("employees tab shows table or empty state (admin)", async ({ page }) => {
    await page.goto("/leverage/employees");

    // If admin: shows employee table or empty state
    // If non-admin: redirected to /leverage (handled gracefully)
    const table = page.locator("table");
    const emptyState = page.getByText("No employee usage data for this period");

    await expect(table.or(emptyState)).toBeVisible();
  });

  test("skills tab shows cards or empty state (admin)", async ({ page }) => {
    await page.goto("/leverage/skills");

    // If admin: shows skill cards or empty state
    // If non-admin: redirected to /leverage (handled gracefully)
    const skillCard = page.locator(".cursor-pointer.rounded-lg.border").first();
    const emptyState = page.getByText("No skill usage data for this period");

    await expect(skillCard.or(emptyState)).toBeVisible();
  });

  test("nav link navigates to leverage", async ({ page }) => {
    // Start from home page
    await page.goto("/");

    // Click the Leverage nav link
    await page.getByRole("link", { name: "Leverage" }).click();

    // Verify navigation to leverage page
    await expect(page).toHaveURL(/\/leverage/);
    await expect(page.getByRole("heading", { name: "Leverage", level: 1 })).toBeVisible();
  });
});
