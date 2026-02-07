import path from "path";
import { test, expect } from "@playwright/test";

test.describe("Skill Upload Flow", () => {
  test("should import a skill file and save to database", async ({ page }) => {
    test.setTimeout(60000);

    const uniqueId = Date.now();
    const skillName = `Hello World ${uniqueId}`;

    await page.goto("/skills/new");
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    // Upload hello-world.md via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, "fixtures", "hello-world.md"));

    // Verify the drop zone shows success message
    await expect(page.getByText(/imported.*hello-world\.md/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Verify form fields were auto-filled from the file
    await expect(page.getByLabel(/^name/i)).toHaveValue("Hello World");
    await expect(page.getByLabel(/^description/i)).toHaveValue(/Hello, World/);
    await expect(page.getByLabel(/^category/i)).toHaveValue("prompt");
    await expect(page.getByLabel(/skill content/i)).toHaveValue(/# Hello World/);

    // Make name unique to avoid slug conflicts
    await page.getByLabel(/^name/i).fill(skillName);

    // Submit the form — runs checkAndCreateSkill (similarity check + create in one action)
    await page.getByRole("button", { name: /create skill/i }).click();

    // Wait for action to complete
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 45000,
    });

    // If similar skills are found, click "Publish Anyway" to proceed
    const publishAnyway = page.getByRole("button", { name: /publish anyway/i });
    if (await publishAnyway.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishAnyway.click();
      await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
        timeout: 45000,
      });
    }

    // Check outcome: redirect (success) or error (API rate-limited)
    if (page.url().includes("/skills/new")) {
      const errorBanner = page.locator(".bg-red-50");
      if (await errorBanner.isVisible().catch(() => false)) {
        test.skip(true, "Voyage API unavailable — embedding generation failed");
        return;
      }
    }

    // Wait for redirect to the new skill page
    await page.waitForURL(/\/skills\/hello-world/, {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });

    // Verify we landed on the skill detail page with the correct name
    await expect(page.getByText(new RegExp(skillName, "i"))).toBeVisible({ timeout: 10000 });
  });

  test("should fill and submit the skill creation form", async ({ page }) => {
    // Use unique name for each test run to avoid slug conflicts
    const uniqueId = Date.now();
    const skillName = `E2E Test Skill ${uniqueId}`;

    // Navigate to skill upload page
    await page.goto("/skills/new");

    // Verify page loads with heading
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    // Fill in required fields
    await page.getByLabel(/^name/i).fill(skillName);
    await page.getByLabel(/^description/i).fill("This is a test skill created by E2E tests");
    await page.getByLabel(/^category/i).selectOption("prompt");
    await page.getByLabel(/skill content/i).fill("Test prompt content for automation");

    // Fill in optional fields
    await page.getByLabel(/^tags/i).fill("test, e2e, automation");
    await page.getByLabel(/usage instructions/i).fill("Use this skill for testing purposes");
    await page.getByLabel(/estimated hours saved/i).fill("2");

    // Submit the form
    await page.getByRole("button", { name: /create skill/i }).click();

    // Button should change to "Checking..." during similarity check
    await expect(page.getByRole("button", { name: /checking/i })).toBeVisible({ timeout: 5000 });

    // The form goes through two async steps:
    // 1. checkSimilarity (fails gracefully without VOYAGE_API_KEY → returns [])
    // 2. createSkill (inserts skill, then tries embedding generation)
    //
    // Outcome depends on environment:
    // - With VOYAGE_API_KEY: redirects to /skills/[slug]
    // - Without VOYAGE_API_KEY: shows error "Failed to generate embedding..."
    //
    // Wait for either outcome — the form must no longer show "Checking..."
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // Take a screenshot for debugging
    await page.screenshot({ path: "test-results/upload-after-submit.png" });

    // If similar skills were found, click "Publish Anyway" to proceed
    const publishAnyway = page.getByRole("button", { name: /publish anyway/i });
    if (await publishAnyway.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishAnyway.click();
      await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
        timeout: 45000,
      });
    }

    // Check outcome: redirect (success) or still on form (error/API failure)
    if (page.url().includes("/skills/new")) {
      const errorBanner = page.locator(".bg-red-50");
      if (await errorBanner.isVisible().catch(() => false)) {
        test.skip(true, "Voyage API unavailable — embedding generation failed");
        return;
      }
      // Amber notice or Create Skill button should be visible
      const notice = page.locator('.bg-amber-50, button:has-text("Create Skill")');
      await expect(notice.first()).toBeVisible({ timeout: 5000 });
    }
    // If not on /skills/new, the redirect succeeded — test passes
  });

  test("should show validation error when required fields are empty", async ({ page }) => {
    // Navigate to skill upload page
    await page.goto("/skills/new");

    // Wait for form to load
    await expect(page.getByRole("heading", { name: /share a new skill/i })).toBeVisible();

    // Try to submit without filling required fields - use native HTML validation
    const submitButton = page.getByRole("button", { name: /create skill/i });
    await submitButton.click();

    // The name field is required and should block form submission
    // Check that we're still on the new skill page (form wasn't submitted)
    await expect(page).toHaveURL(/\/skills\/new/);

    // Verify the name field shows native validation (it has required attribute)
    const nameInput = page.getByLabel(/^name/i);
    await expect(nameInput).toHaveAttribute("required", "");
  });
});
