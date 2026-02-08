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

  test("install button opens skill-aware modal from skills table", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table to load
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Find an install icon button in a table row
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await expect(installButton).toBeVisible();

    // Click the install button
    await installButton.click();

    // Assert the skill-aware modal is visible (shows "Install {name}")
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();

    // Assert the copy prompt area is visible
    await expect(page.getByText("Copy this and paste it into Claude:")).toBeVisible();

    // Assert the prompt contains skill reference
    const promptBox = page.locator(".font-mono").first();
    await expect(promptBox).toContainText("skill from EverySkill");
  });

  test("skill-aware modal shows category badge and download link", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();

    // Assert skill-aware modal is visible
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();

    // Assert download link is visible
    await expect(page.getByText(/Or download.*\.md directly/)).toBeVisible();

    // Assert the collapsible MCP setup section exists
    await expect(page.getByText("First time? Set up EverySkill MCP server")).toBeVisible();
  });

  test("MCP setup section expands and shows config", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();

    // Assert skill-aware modal is visible
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();

    // Expand the MCP setup section
    await page.getByText("First time? Set up EverySkill MCP server").click();

    // Assert platform cards are visible
    await expect(page.getByRole("button", { name: /Claude Desktop/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Claude Code/i })).toBeVisible();

    // Assert a pre element with JSON config is visible
    const preBlock = page.locator("pre");
    await expect(preBlock).toBeVisible();

    // Assert the JSON contains expected content
    const configText = await preBlock.textContent();
    expect(configText).toContain("everyskill-skills");

    // Assert "Copy Config" button is visible
    await expect(page.getByRole("button", { name: /copy config/i })).toBeVisible();
  });

  test("modal copy prompt button works", async ({ page, context }) => {
    // Grant clipboard permissions for the test
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();

    // Assert skill-aware modal is visible
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();

    // Click the copy button (clipboard icon next to the prompt)
    const copyButton = page.getByTitle("Copy prompt");
    await copyButton.click();

    // Assert modal is still visible (not closed)
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();
  });

  test("install button on skill detail page opens skill-aware modal", async ({ page }) => {
    await page.goto(`/skills/${testSkillSlug}`);

    // Find the Install button on the detail page
    const installButton = page.getByRole("button", { name: /install/i }).first();
    await expect(installButton).toBeVisible({ timeout: 10000 });

    // Click it
    await installButton.click();

    // Assert the skill-aware modal is visible with the test skill name
    await expect(page.getByText("Install Install Test Skill")).toBeVisible();

    // Assert the prompt contains the skill ID
    await expect(page.locator(".font-mono").first()).toContainText(testSkillId);

    // Assert download link references the slug
    await expect(page.getByText(`Or download ${testSkillSlug}.md directly`)).toBeVisible();
  });

  test("close button dismisses modal", async ({ page }) => {
    await page.goto("/skills");

    // Wait for the table and open the modal
    const table = page.locator('table[role="grid"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    const installButton = page.locator("td").getByLabel("Install skill").first();
    await installButton.click();

    // Assert modal is visible
    await expect(page.getByRole("heading", { name: /^Install\s/ })).toBeVisible();

    // Click the close button (X)
    await page.locator('[class*="rounded-lg p-1 text-gray-400"]').click();

    // Assert modal is gone
    await expect(page.getByText("Copy this and paste it into Claude:")).not.toBeVisible();
  });
});
