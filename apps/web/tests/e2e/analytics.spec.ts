import { test, expect } from "@playwright/test";

test.describe("Analytics Dashboard", () => {
  test("loads analytics page with default tab", async ({ page }) => {
    await page.goto("/analytics");

    // Page header
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByText("Org-wide usage trends and employee activity")).toBeVisible();

    // Default tab is Overview (has active border class)
    await expect(page.getByRole("button", { name: "Overview" })).toHaveClass(/border-blue-500/);

    // Stat cards visible on overview tab
    await expect(page.getByText("Total Hours Saved")).toBeVisible();
    await expect(page.getByText("Active Employees")).toBeVisible();
    await expect(page.getByText("Skills Deployed")).toBeVisible();
  });

  test("navigates between tabs", async ({ page }) => {
    await page.goto("/analytics");

    // Click Employees tab
    await page.getByRole("button", { name: "Employees" }).click();
    await expect(page).toHaveURL(/[?&]tab=employees/);
    await expect(page.getByRole("button", { name: "Employees" })).toHaveClass(/border-blue-500/);

    // Click Skills tab (exact match to avoid "Skills Used" sort header)
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await expect(page).toHaveURL(/[?&]tab=skills/);
    await expect(page.getByRole("button", { name: "Skills", exact: true })).toHaveClass(
      /border-blue-500/
    );

    // Click back to Overview (default tab removes param from URL)
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.getByRole("button", { name: "Overview" })).toHaveClass(/border-blue-500/);
  });

  test("time range selector updates URL", async ({ page }) => {
    await page.goto("/analytics");

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

    // Click 1 year
    await page.getByRole("button", { name: "1 year" }).click();
    await expect(page).toHaveURL(/[?&]range=1y/);
    await expect(page.getByRole("button", { name: "1 year" })).toHaveClass(/bg-blue-600/);
  });

  test("export button is visible and clickable", async ({ page }) => {
    await page.goto("/analytics");

    // Export CSV button should be visible
    const exportBtn = page.getByRole("button", { name: /Export CSV/i });
    await expect(exportBtn).toBeVisible();

    // Handle the alert dialog that appears when there is no data
    page.on("dialog", (dialog) => dialog.dismiss());

    // Click export button - may trigger alert for empty data or initiate download
    await exportBtn.click();

    // Button should still be visible after click
    await expect(exportBtn).toBeVisible();
  });

  test("employees tab shows table or empty state", async ({ page }) => {
    await page.goto("/analytics");

    // Click Employees tab
    await page.getByRole("button", { name: "Employees" }).click();

    // Either shows a table or the empty state message
    const table = page.locator("table");
    const emptyState = page.getByText("No employee usage data for this period");

    await expect(table.or(emptyState)).toBeVisible();
  });

  test("skills tab shows cards or empty state", async ({ page }) => {
    await page.goto("/analytics");

    // Click Skills tab (exact match to avoid "Skills Used" sort header)
    await page.getByRole("button", { name: "Skills", exact: true }).click();

    // Either shows skill cards or empty state
    const skillCard = page.locator(".cursor-pointer.rounded-lg.border").first();
    const emptyState = page.getByText("No skill usage data for this period");

    await expect(skillCard.or(emptyState)).toBeVisible();
  });

  test("nav link navigates to analytics", async ({ page }) => {
    // Start from home page
    await page.goto("/");

    // Click the Analytics nav link
    await page.getByRole("link", { name: "Analytics" }).click();

    // Verify navigation to analytics page
    await expect(page).toHaveURL(/\/analytics/);
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
  });

  test("direct URL with query params works", async ({ page }) => {
    // Navigate directly with tab and range params
    await page.goto("/analytics?tab=employees&range=90d");

    // Verify correct tab is active
    await expect(page.getByRole("button", { name: "Employees" })).toHaveClass(/border-blue-500/);

    // Verify correct time range is selected
    await expect(page.getByRole("button", { name: "90 days" })).toHaveClass(/bg-blue-600/);
  });
});
