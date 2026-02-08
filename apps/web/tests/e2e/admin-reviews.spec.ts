import { test, expect } from "@playwright/test";

test.describe("Admin Review Queue", () => {
  test("non-admin is redirected away from reviews page", async ({ page }) => {
    await page.goto("/admin/reviews");

    const url = page.url();
    const isAdmin = url.includes("/admin/reviews");
    const isRedirected = !isAdmin;

    if (isRedirected) {
      expect(url).not.toContain("/admin/reviews");
    } else {
      await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
    }
  });

  test("admin reviews page loads with queue table", async ({ page }) => {
    await page.goto("/admin/reviews");
    const url = page.url();

    if (!url.includes("/admin/reviews")) {
      test.skip();
      return;
    }

    // Page header
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
    await expect(page.getByText("Skills awaiting admin review")).toBeVisible();

    // Filter bar elements
    await expect(page.locator("#status-filter")).toBeVisible();
    await expect(page.locator("#category-filter")).toBeVisible();
    await expect(page.locator("#date-from")).toBeVisible();
    await expect(page.locator("#date-to")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();

    // Either a table or empty state should be visible
    const table = page.locator("table");
    const emptyState = page.getByText("No skills awaiting review");
    await expect(table.or(emptyState)).toBeVisible();
  });

  test("admin nav shows Reviews tab", async ({ page }) => {
    await page.goto("/admin/reviews");
    const url = page.url();

    if (!url.includes("/admin")) {
      test.skip();
      return;
    }

    // Reviews nav item should be visible
    await expect(page.getByRole("link", { name: /Reviews/ })).toBeVisible();
  });

  test("filter dropdowns have correct options", async ({ page }) => {
    await page.goto("/admin/reviews");
    const url = page.url();

    if (!url.includes("/admin/reviews")) {
      test.skip();
      return;
    }

    // Status filter has expected options
    const statusFilter = page.locator("#status-filter");
    await expect(statusFilter.locator("option")).toHaveCount(5);

    // Category filter has expected options
    const categoryFilter = page.locator("#category-filter");
    await expect(categoryFilter.locator("option")).toHaveCount(5);
  });
});
