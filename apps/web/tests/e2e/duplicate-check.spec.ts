import { test, expect } from "@playwright/test";

test.describe("Skill Duplicate Check", () => {
  test("should warn about similar skills when creating a duplicate", async ({ page }) => {
    test.setTimeout(60000);

    const uniqueId = Date.now();

    // Step 1: Create the first skill
    await page.goto("/skills/new");
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    await page.getByLabel(/^name/i).fill(`Dup Check ${uniqueId}`);
    await page
      .getByLabel(/^description/i)
      .fill("A test skill for duplicate detection verification");
    await page.getByLabel(/^category/i).selectOption("productivity");
    await page.getByLabel(/skill content/i).fill("Test prompt content for duplicate detection");

    await page.getByRole("button", { name: /create skill/i }).click();

    // Wait for action to complete
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // The ILIKE check may find existing matches — click "Publish Anyway" if shown
    const publishAnywayFirst = page.getByRole("button", { name: /publish anyway/i });
    if (await publishAnywayFirst.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishAnywayFirst.click();
      await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
        timeout: 30000,
      });
    }

    // First skill should redirect to its detail page
    await expect(page).not.toHaveURL(/\/skills\/new/);
    // eslint-disable-next-line no-console
    console.log(`First skill created: ${page.url()}`);

    // Step 2: Try to create a skill with the same name
    await page.goto("/skills/new");
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    await page.getByLabel(/^name/i).fill(`Dup Check ${uniqueId}`);
    await page
      .getByLabel(/^description/i)
      .fill("A test skill for duplicate detection verification");
    await page.getByLabel(/^category/i).selectOption("productivity");
    await page.getByLabel(/skill content/i).fill("Test prompt content for duplicate detection");

    await page.getByRole("button", { name: /create skill/i }).click();

    // Wait for action to complete
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // ILIKE check should find the first skill — expect the warning
    const warningHeading = page.getByText(/similar skills found/i);
    await expect(warningHeading).toBeVisible({ timeout: 5000 });

    // Verify warning UI elements
    await expect(page.getByRole("button", { name: /publish anyway/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /go back/i })).toBeVisible();

    // Verify a similar skill name is shown in the SimilarityPane card
    // Note: ILIKE matches any "Dup Check" skills from previous runs too
    await expect(page.getByText(/Dup Check \d+/).first()).toBeVisible({ timeout: 5000 });

    // Verify "Create as Variation" button exists
    await expect(page.getByRole("button", { name: /create as variation/i }).first()).toBeVisible();

    // Click "Publish Anyway" to verify the skip flow works
    await page.getByRole("button", { name: /publish anyway/i }).click();
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // Should redirect to the new skill page
    await expect(page).not.toHaveURL(/\/skills\/new/);
    // eslint-disable-next-line no-console
    console.log(`Second skill created via Publish Anyway: ${page.url()}`);
  });

  test("should show hover popup with skill description on similar skills", async ({ page }) => {
    test.setTimeout(60000);

    const uniqueId = Date.now();

    // Step 1: Create the first skill with a distinctive description
    await page.goto("/skills/new");
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    await page.getByLabel(/^name/i).fill(`Hover Test ${uniqueId}`);
    await page
      .getByLabel(/^description/i)
      .fill("Special hover popup test description for verification");
    await page.getByLabel(/^category/i).selectOption("wiring");
    await page.getByLabel(/skill content/i).fill("Test content for hover popup test");

    await page.getByRole("button", { name: /create skill/i }).click();
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // Handle potential duplicate warning from previous test runs
    const publishBtn = page.getByRole("button", { name: /publish anyway/i });
    if (await publishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishBtn.click();
      await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
        timeout: 30000,
      });
    }

    await expect(page).not.toHaveURL(/\/skills\/new/);

    // Step 2: Create duplicate to trigger warning
    await page.goto("/skills/new");
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    await page.getByLabel(/^name/i).fill(`Hover Test ${uniqueId}`);
    await page
      .getByLabel(/^description/i)
      .fill("Special hover popup test description for verification");
    await page.getByLabel(/^category/i).selectOption("wiring");
    await page.getByLabel(/skill content/i).fill("Test content for hover popup test");

    await page.getByRole("button", { name: /create skill/i }).click();
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // Expect warning with similar skills in the SimilarityPane
    await expect(page.getByText(/similar skills found/i)).toBeVisible({ timeout: 5000 });

    // The SimilarityPane shows description inline in the card (no hover needed)
    const descText = page.getByText(/Special hover popup test description/i).first();
    await expect(descText).toBeVisible({ timeout: 3000 });

    // The card should show a category badge
    const categoryBadge = page.locator(".rounded-full.bg-gray-100").first();
    await expect(categoryBadge).toBeVisible();

    // Cleanup: go back
    await page.getByRole("button", { name: /go back/i }).click();
  });
});
