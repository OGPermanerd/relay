import { test, expect } from "@playwright/test";
import { db, skills, users } from "@everyskill/db";

const TEST_USER_ID = "e2e-test-user";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

test.describe("Install Modal Flow", () => {
  test.describe.configure({ mode: "serial" });

  let testSkillSlug: string;
  let testSkillId: string;

  test.beforeAll(async () => {
    if (!db) throw new Error("DATABASE_URL is required for E2E tests");

    // Ensure test user exists
    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoNothing();

    // Create a test skill for install modal testing
    const slug = `install-test-${Date.now()}`;
    const [skill] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: "Install Test Skill",
        slug,
        description: "A skill for testing the install modal flow",
        category: "prompt",
        content: "Test skill content for install modal",
        hoursSaved: 2,
        tags: ["testing", "install"],
        authorId: TEST_USER_ID,
      })
      .returning({ id: skills.id, slug: skills.slug });

    testSkillId = skill.id;
    testSkillSlug = skill.slug;
  });

  test.afterAll(async () => {
    if (!db) return;
    if (testSkillId) {
      const { eq } = await import("drizzle-orm");
      await db.delete(skills).where(eq(skills.id, testSkillId));
    }
  });

  test("install button opens platform modal from skills table", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table to load
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Find an install icon button in a table row
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await expect(installButton).toBeVisible();

    // Click the install button
    await installButton.click();

    // Assert the platform install modal is visible
    await expect(page.getByText("Install EverySkill MCP Server")).toBeVisible();

    // Assert 4 platform cards are visible (use role buttons with full accessible names)
    await expect(page.getByRole("button", { name: /Claude Desktop/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Claude Code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Other IDE/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Other Systems/i })).toBeVisible();
  });

  test("selecting a platform shows config JSON", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();
    await expect(page.getByText("Install EverySkill MCP Server")).toBeVisible();

    // Click on "Claude Code" platform card
    await page.getByRole("button", { name: /Claude Code/i }).click();

    // Assert a pre element with JSON config is visible
    const preBlock = page.locator("pre");
    await expect(preBlock).toBeVisible();

    // Assert the JSON contains expected content
    const configText = await preBlock.textContent();
    expect(configText).toContain("everyskill-skills");
    expect(configText).toContain("npx");

    // Assert a "Copy Config" button is visible
    await expect(page.getByRole("button", { name: /copy config/i })).toBeVisible();
  });

  test("modal stays open after clicking copy", async ({ page, context }) => {
    // Grant clipboard permissions for the test
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();
    await expect(page.getByText("Install EverySkill MCP Server")).toBeVisible();

    // Select a platform (Claude Desktop is pre-selected, but click to be sure)
    await page.getByRole("button", { name: /Claude Desktop/i }).click();

    // Click the Copy Config button
    await page.getByRole("button", { name: /copy config/i }).click();

    // Assert modal is still visible (not closed)
    await expect(page.getByText("Install EverySkill MCP Server")).toBeVisible();

    // Assert button text changes to "Copied!" (clipboard feedback)
    await expect(page.getByText("Copied!")).toBeVisible();
  });

  test("install button on skill detail page opens modal", async ({ page }) => {
    await page.goto(`/skills/${testSkillSlug}`);

    // Find the Install button on the detail page
    const installButton = page.getByRole("button", { name: /install/i }).first();
    await expect(installButton).toBeVisible({ timeout: 10000 });

    // Click it
    await installButton.click();

    // Assert the platform install modal is visible
    await expect(page.getByText("Install EverySkill MCP Server")).toBeVisible();
  });

  test("detected OS label appears in modal", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();

    // Assert text matching "Detected:" is visible in the modal
    await expect(page.getByText(/Detected:/)).toBeVisible();
  });
});
