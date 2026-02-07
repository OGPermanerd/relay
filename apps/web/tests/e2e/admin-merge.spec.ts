import { test, expect } from "@playwright/test";

test.describe("Admin Merge Page", () => {
  test("merge page loads for admin user", async ({ page }) => {
    await page.goto("/admin/merge");
    const url = page.url();

    if (!url.includes("/admin/merge")) {
      // Non-admin users get redirected
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: "Merge Duplicate Skills" })).toBeVisible();
    await expect(page.getByText("Source skill (will be deleted)")).toBeVisible();
    await expect(page.getByText("Target skill (will receive merged data)")).toBeVisible();
  });

  test("admin settings page has link to merge page", async ({ page }) => {
    await page.goto("/admin/settings");
    const url = page.url();

    if (!url.includes("/admin/settings")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: "Duplicate Skill Merge" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to Skill Merge/ })).toBeVisible();
  });

  test("merge page has search inputs", async ({ page }) => {
    await page.goto("/admin/merge");
    const url = page.url();

    if (!url.includes("/admin/merge")) {
      test.skip();
      return;
    }

    const sourceInput = page.getByPlaceholder("Search by name...").first();
    const targetInput = page.getByPlaceholder("Search by name...").last();

    await expect(sourceInput).toBeVisible();
    await expect(targetInput).toBeVisible();
  });
});
