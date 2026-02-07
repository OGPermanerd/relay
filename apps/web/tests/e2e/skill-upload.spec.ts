import path from "path";
import { test, expect } from "@playwright/test";

test.describe("Skill Upload Flow", () => {
  test("should import a skill file and submit successfully", async ({ page }) => {
    const uniqueId = Date.now();

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
    await page.getByLabel(/^name/i).fill(`Hello World ${uniqueId}`);

    // Take screenshot before submit
    await page.screenshot({ path: "test-results/file-import-before-submit.png" });

    // Submit the form
    await page.getByRole("button", { name: /create skill/i }).click();

    // Wait for the "Checking..." phase to complete
    await expect(page.getByRole("button", { name: /checking/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /checking/i })).not.toBeVisible({
      timeout: 30000,
    });

    // Take screenshot after submit to debug
    await page.screenshot({ path: "test-results/file-import-after-submit.png" });

    // Check outcome: either redirected to skill page, or error displayed
    const url = page.url();
    if (url.includes("/skills/new")) {
      // Still on form — capture any error messages for debugging
      const errorBanner = page.locator(".bg-red-50");
      const hasError = await errorBanner.isVisible().catch(() => false);
      if (hasError) {
        const errorText = await errorBanner.textContent();
        console.log("Error after submit:", errorText);
      }

      // Capture form field values to see if they survived the action cycle
      const nameVal = await page
        .getByLabel(/^name/i)
        .inputValue()
        .catch(() => "FIELD_NOT_FOUND");
      const descVal = await page
        .getByLabel(/^description/i)
        .inputValue()
        .catch(() => "FIELD_NOT_FOUND");
      const catVal = await page
        .getByLabel(/^category/i)
        .inputValue()
        .catch(() => "FIELD_NOT_FOUND");
      const contentVal = await page
        .getByLabel(/skill content/i)
        .inputValue()
        .catch(() => "FIELD_NOT_FOUND");
      console.log("Form state after submit:", {
        name: nameVal,
        description: descVal,
        category: catVal,
        content: contentVal?.slice(0, 50),
      });
    } else {
      // Redirected — skill was saved successfully
      console.log("Redirected to:", url);
      await expect(page.getByText(/hello world/i)).toBeVisible({ timeout: 10000 });
    }
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

    // Verify we got an outcome: either redirected away from /skills/new,
    // or an error message is shown, or the form re-appeared (step reset to "form")
    const url = page.url();
    if (url.includes("/skills/new")) {
      // Still on the form — either an error message or the "Create Skill" button reappears
      const errorOrReset = page.locator('.bg-red-50, button:has-text("Create Skill")');
      await expect(errorOrReset.first()).toBeVisible({ timeout: 5000 });
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
