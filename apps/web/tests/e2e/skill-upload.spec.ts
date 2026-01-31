import { test, expect } from "@playwright/test";

test.describe("Skill Upload Flow", () => {
  test("should successfully upload a skill with all metadata", async ({ page }) => {
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

    // Wait for navigation to the new skill's page
    // Successful submission redirects to /skills/[slug]
    await expect(page).toHaveURL(/\/skills\/e2e-test-skill/, { timeout: 15000 });

    // Verify skill details are displayed on the detail page
    await expect(page.getByText(skillName)).toBeVisible();
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
