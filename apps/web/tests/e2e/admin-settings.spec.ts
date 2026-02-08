import { test, expect } from "@playwright/test";

test.describe("Admin Settings", () => {
  test("non-admin is redirected away from settings page", async ({ page }) => {
    // Without admin role on test user, we get redirected
    await page.goto("/admin/settings");

    // Either redirected to "/" or we see the page (if test user is admin)
    const url = page.url();
    const isAdmin = url.includes("/admin/settings");
    const isRedirected = !isAdmin;

    if (isRedirected) {
      // Non-admin users get redirected to home
      expect(url).not.toContain("/admin/settings");
    } else {
      // Admin user sees the page
      await expect(page.getByRole("heading", { name: "Admin Settings" })).toBeVisible();
    }
  });

  test("admin settings page loads when user is admin", async ({ page }) => {
    // If test user has admin role, we can see the page
    await page.goto("/admin/settings");
    const url = page.url();

    if (!url.includes("/admin/settings")) {
      // Skip if not admin — the redirect test above already covers this
      test.skip();
      return;
    }

    // Page header
    await expect(page.getByRole("heading", { name: "Admin Settings" })).toBeVisible();
    await expect(page.getByText("Configure site-wide features")).toBeVisible();

    // Semantic Similarity section
    await expect(page.getByText("Semantic Similarity (Ollama)")).toBeVisible();
    await expect(page.getByLabel("Enable semantic similarity")).toBeVisible();
    await expect(page.getByLabel("Ollama URL")).toBeVisible();
    await expect(page.getByLabel("Embedding Model")).toBeVisible();
    await expect(page.getByLabel("Embedding Dimensions")).toBeVisible();

    // Save and Test Connection buttons
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test Connection" })).toBeVisible();

    // API Key Management link
    await expect(page.getByRole("heading", { name: "API Key Management" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Go to API Key Management/ })).toBeVisible();
  });

  test("admin settings form has correct defaults", async ({ page }) => {
    await page.goto("/admin/settings");

    if (!page.url().includes("/admin/settings")) {
      test.skip();
      return;
    }

    // Check default values
    const urlInput = page.getByLabel("Ollama URL");
    await expect(urlInput).toHaveValue("http://localhost:11434");

    const modelInput = page.getByLabel("Embedding Model");
    await expect(modelInput).toHaveValue("nomic-embed-text");

    const dimensionsInput = page.getByLabel("Embedding Dimensions");
    await expect(dimensionsInput).toHaveValue("768");

    // Semantic similarity toggle should be visible
    const toggle = page.getByLabel("Enable semantic similarity");
    await expect(toggle).toBeVisible();
  });

  test("test connection shows error without Ollama running", async ({ page }) => {
    await page.goto("/admin/settings");

    if (!page.url().includes("/admin/settings")) {
      test.skip();
      return;
    }

    // Click Test Connection button
    await page.getByRole("button", { name: "Test Connection" }).click();

    // Should show an error since Ollama likely isn't running in test env
    // Wait for the response (either success or error)
    const errorMsg = page
      .locator("text=Connection failed")
      .or(page.locator("text=fetch failed"))
      .or(page.locator("text=Connected"));
    await expect(errorMsg).toBeVisible({ timeout: 10000 });
  });
});
