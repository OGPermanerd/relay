import { test, expect } from "@playwright/test";

test.describe("Portfolio Page", () => {
  test("should load /portfolio page with hero stats", async ({ page }) => {
    await page.goto("/portfolio");

    // Page header should be visible
    await expect(page.locator("h1")).toContainText("Portfolio");

    // Hero stat cards should be present (use .first() since chart legends may duplicate text)
    await expect(page.getByText("Skills Authored").first()).toBeVisible();
    await expect(page.getByText("Total Uses").first()).toBeVisible();
    await expect(page.getByText("Hours Saved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Contribution Rank").first()).toBeVisible();
  });

  test("should display portable vs company IP breakdown", async ({ page }) => {
    await page.goto("/portfolio");

    // IP breakdown sections should be visible
    await expect(page.getByText("Portable Skills")).toBeVisible();
    await expect(page.getByText("Company Skills")).toBeVisible();
  });

  test("should show portfolio link in header nav", async ({ page }) => {
    await page.goto("/portfolio");

    // Portfolio nav link should exist in header
    await expect(page.getByRole("link", { name: "Portfolio" })).toBeVisible();
  });

  test("should display skills list section", async ({ page }) => {
    await page.goto("/portfolio");

    // Skills list section should be visible
    await expect(page.getByText("Your Skills")).toBeVisible();
  });

  test("should display impact timeline section", async ({ page }) => {
    await page.goto("/portfolio");

    // Timeline renders either the chart with heading or the empty state
    const heading = page.getByText("Skills Impact Timeline");
    const emptyState = page.getByText("No impact data yet");
    await expect(heading.or(emptyState)).toBeVisible();
  });

  test("should display impact calculator section", async ({ page }) => {
    await page.goto("/portfolio");

    // Calculator renders either stat labels or empty state
    const heading = page.getByText("Impact Calculator");
    const emptyState = page.getByText("No contributions yet");
    const isPopulated = await heading.isVisible().catch(() => false);

    if (isPopulated) {
      await expect(page.getByText("Total Hours Saved")).toBeVisible();
      await expect(page.getByText("Estimated Value Added")).toBeVisible();
      await expect(page.getByText("Skills Created")).toBeVisible();
      await expect(page.getByText("Skills Forked")).toBeVisible();
      await expect(page.getByText("Suggestions Implemented")).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible();
    }
  });

  test("should have Skills Resume link on portfolio page", async ({ page }) => {
    await page.goto("/portfolio");
    const resumeLink = page.getByRole("link", { name: /resume/i });
    await expect(resumeLink).toBeVisible();
    await expect(resumeLink).toHaveAttribute("href", "/portfolio/resume");
  });

  test("should load /portfolio/resume page with resume content", async ({ page }) => {
    await page.goto("/portfolio/resume");
    // Page should load without error
    await expect(page.locator("h1")).toContainText("Skills Resume");
    // Impact stats should be present
    await expect(page.getByText("Skills Authored")).toBeVisible();
    await expect(page.getByText("Hours Saved").first()).toBeVisible();
    await expect(page.getByText("People Helped")).toBeVisible();
    // PDF download button should be present
    await expect(page.getByRole("button", { name: /pdf|download/i })).toBeVisible();
  });

  test("should display share controls on resume page", async ({ page }) => {
    await page.goto("/portfolio/resume");
    // Share controls should be visible (either generate button or existing link)
    const generateBtn = page.getByRole("button", { name: /generate|share/i });
    const shareInput = page.locator("input[readonly]");
    await expect(generateBtn.or(shareInput)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Pre-Platform Work Artifact Tests
  // ---------------------------------------------------------------------------

  test("should display pre-platform work section", async ({ page }) => {
    await page.goto("/portfolio");

    // The Pre-Platform Work heading should be visible
    await expect(page.getByRole("heading", { name: "Pre-Platform Work" })).toBeVisible();

    // The "Add Pre-Platform Work" button should always be present
    await expect(page.getByRole("button", { name: "Add Pre-Platform Work" })).toBeVisible();
  });

  test("should show artifact upload form when clicking add button", async ({ page }) => {
    await page.goto("/portfolio");

    // Click the "Add Pre-Platform Work" button to expand the form
    const addButton = page.getByRole("button", { name: /Add Pre-Platform Work/i });
    await addButton.click();

    // Form fields should appear
    await expect(page.locator("#artifact-title")).toBeVisible();
    await expect(page.locator("#artifact-category")).toBeVisible();
    await expect(page.locator("#artifact-date")).toBeVisible();

    // Submit button should be visible
    await expect(page.getByRole("button", { name: /Save Artifact/i })).toBeVisible();

    // Cancel button should be visible
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible();
  });

  test("should create and display an artifact", async ({ page }) => {
    await page.goto("/portfolio");

    // Expand the upload form
    const addButton = page.getByRole("button", { name: /Add Pre-Platform Work/i });
    await addButton.click();

    // Use a unique title to avoid collisions with previous test runs
    const uniqueTitle = `E2E Create Test ${Date.now()}`;

    // Fill in the form
    await page.locator("#artifact-title").fill(uniqueTitle);
    await page.locator("#artifact-category").selectOption("document");
    await page.locator("#artifact-date").fill("2024-06-15");
    await page.locator("#artifact-description").fill("Created by Playwright E2E test");

    // Submit
    await page.getByRole("button", { name: /Save Artifact/i }).click();

    // Wait for page to refresh and form to collapse
    await page.waitForTimeout(2000);

    // The artifact should now appear in the list
    await expect(page.getByText(uniqueTitle)).toBeVisible();

    // Pre-platform badge should be visible on the artifact
    await expect(page.getByText("Pre-platform").first()).toBeVisible();

    // Cleanup: delete the artifact we just created
    page.on("dialog", (dialog) => dialog.accept());
    const row = page.locator("div.rounded-lg").filter({ has: page.getByText(uniqueTitle) });
    await row.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(1500);
  });

  test("should delete an artifact", async ({ page }) => {
    await page.goto("/portfolio");

    // First create an artifact to delete
    const addButton = page.getByRole("button", { name: /Add Pre-Platform Work/i });
    await addButton.click();

    const uniqueTitle = `E2E Delete Test ${Date.now()}`;

    await page.locator("#artifact-title").fill(uniqueTitle);
    await page.locator("#artifact-category").selectOption("email");
    await page.locator("#artifact-date").fill("2024-01-10");

    await page.getByRole("button", { name: /Save Artifact/i }).click();
    await page.waitForTimeout(2000);

    // Confirm artifact was created
    await expect(page.getByText(uniqueTitle)).toBeVisible();

    // Set up dialog handler before clicking delete
    page.on("dialog", (dialog) => dialog.accept());

    // Find the specific artifact row and click Delete
    const artifactRow = page.locator("div.rounded-lg").filter({ has: page.getByText(uniqueTitle) });
    await artifactRow.getByRole("button", { name: "Delete" }).click();

    // Wait for deletion to complete
    await page.waitForTimeout(2000);

    // The artifact should no longer be visible
    await expect(page.getByText(uniqueTitle)).not.toBeVisible();
  });

  test("should show artifacts on impact timeline", async ({ page }) => {
    await page.goto("/portfolio");

    // The timeline section should render -- check for heading or empty state
    const heading = page.getByText("Skills Impact Timeline");
    const emptyState = page.getByText("No impact data yet");
    await expect(heading.or(emptyState)).toBeVisible();

    // If timeline is populated, check for the recharts container
    const isPopulated = await heading.isVisible().catch(() => false);
    if (isPopulated) {
      const chartContainer = page.locator(".recharts-wrapper");
      await expect(chartContainer).toBeVisible();
    }
  });
});
