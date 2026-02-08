import { test, expect } from "@playwright/test";

test.describe("Messages Page", () => {
  test("should load messages page for authenticated user", async ({ page }) => {
    await page.goto("/messages");

    // Should show the Messages heading
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();

    // Should show the description text
    await expect(
      page.getByText("Grouping proposals and messages from other skill authors.")
    ).toBeVisible();

    // Should show empty state when no messages exist
    await expect(
      page.getByText("No messages yet. When someone proposes grouping a skill under yours")
    ).toBeVisible();
  });

  test("should have valid page structure", async ({ page }) => {
    await page.goto("/messages");

    // Verify the page renders within the protected layout (has header nav)
    await expect(page.getByRole("link", { name: /Skills/i })).toBeVisible();

    // No error messages should be visible
    await expect(page.locator(".bg-red-50")).not.toBeVisible();
  });
});
