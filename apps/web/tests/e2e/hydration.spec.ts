import { test, expect } from "@playwright/test";

test.describe("Hydration", () => {
  test("skills listing page should have no hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.toLowerCase().includes("hydration") ||
        text.toLowerCase().includes("mismatch") ||
        (msg.type() === "error" && !text.includes("favicon"))
      ) {
        errors.push(`[${msg.type()}] ${text}`);
      }
    });
    page.on("pageerror", (error) => {
      errors.push(`[pageerror] ${error.message}`);
    });

    await page.goto("/skills");
    await page.waitForLoadState("networkidle");

    // Verify the page rendered correctly
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 5000 });

    // Verify dates are formatted as relative time (e.g., "60d 2h ago", "1y 5d ago", "just now")
    // Date Added is column 7 after reorder: Name, Author, Rating, Days Saved, Trend, Installs, Date, Install
    const dateCells = table.locator("td:nth-child(7)");
    const firstDate = await dateCells.first().textContent();
    expect(firstDate).toMatch(/(\d+[ydhm]\s*)+ago|just now/);

    // No hydration errors should have occurred
    const hydrationErrors = errors.filter(
      (e) => e.includes("hydration") || e.includes("mismatch") || e.includes("Hydration")
    );
    expect(hydrationErrors).toHaveLength(0);
  });

  test("skill detail page should have no hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.toLowerCase().includes("hydration") ||
        text.toLowerCase().includes("mismatch") ||
        (msg.type() === "error" && !text.includes("favicon"))
      ) {
        errors.push(`[${msg.type()}] ${text}`);
      }
    });
    page.on("pageerror", (error) => {
      errors.push(`[pageerror] ${error.message}`);
    });

    // Navigate to first skill detail page
    await page.goto("/skills");
    await page.waitForLoadState("networkidle");

    const firstSkillLink = page.locator("table a").first();
    await expect(firstSkillLink).toBeVisible();
    const href = await firstSkillLink.getAttribute("href");
    await page.goto(href!);
    await page.waitForLoadState("networkidle");

    // Verify the page rendered with a relative date (e.g., "Created 60d 2h ago")
    await expect(page.getByText(/Created \d+[ydhm]/)).toBeVisible({
      timeout: 5000,
    });

    const hydrationErrors = errors.filter(
      (e) => e.includes("hydration") || e.includes("mismatch") || e.includes("Hydration")
    );
    expect(hydrationErrors).toHaveLength(0);
  });
});
