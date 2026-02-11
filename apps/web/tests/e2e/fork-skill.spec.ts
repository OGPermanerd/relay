import { test, expect } from "@playwright/test";
import { db, skills, users } from "@everyskill/db";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "e2e-test-user";
const SECOND_USER_ID = "e2e-fork-author";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

test.describe("Fork Skill", () => {
  test.describe.configure({ mode: "serial" });

  let parentSkillSlug: string;
  let parentSkillId: string;
  let forkedSkillSlug: string;
  let forkedSkillId: string;

  test.beforeAll(async () => {
    if (!db) throw new Error("DATABASE_URL is required for E2E tests");

    // Ensure both test users exist
    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: SECOND_USER_ID,
        email: "e2e-fork-author@company.com",
        name: "Fork Author",
      })
      .onConflictDoNothing();

    // Create a parent skill owned by another user (so test user can fork it)
    const slug = `fork-parent-${Date.now()}`;
    const [parent] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: "Fork Parent Skill",
        slug,
        description: "A skill to be forked in E2E tests",
        category: "prompt",
        content: "Parent skill content for fork testing",
        hoursSaved: 5,
        tags: ["testing", "fork"],
        authorId: SECOND_USER_ID,
      })
      .returning({ id: skills.id, slug: skills.slug });

    parentSkillId = parent.id;
    parentSkillSlug = parent.slug;

    // Create a forked skill to test attribution and fork list
    const forkSlug = `fork-child-${Date.now()}`;
    const [fork] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: "Fork Parent Skill (Fork)",
        slug: forkSlug,
        description: "A skill to be forked in E2E tests",
        category: "prompt",
        content: "Parent skill content for fork testing",
        hoursSaved: 0,
        tags: ["testing", "fork"],
        authorId: TEST_USER_ID,
        forkedFromId: parentSkillId,
      })
      .returning({ id: skills.id, slug: skills.slug });

    forkedSkillId = fork.id;
    forkedSkillSlug = fork.slug;
  });

  test.afterAll(async () => {
    if (!db) return;
    // Clean up forked skill first (FK reference), then parent
    if (forkedSkillId) {
      await db.delete(skills).where(eq(skills.id, forkedSkillId));
    }
    if (parentSkillId) {
      await db.delete(skills).where(eq(skills.id, parentSkillId));
    }
  });

  test("should show fork buttons on skill detail page", async ({ page }) => {
    await page.goto(`/skills/${parentSkillSlug}`);

    // Both Fork & Improve and plain Fork buttons should be visible (non-author view)
    await expect(page.getByRole("button", { name: /fork & improve/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /^fork(\s*\(\d+\))?$/i })).toBeVisible();
  });

  test("should show confirmation modal when fork button clicked", async ({ page }) => {
    await page.goto(`/skills/${parentSkillSlug}`);

    // Click the plain fork button
    await page.getByRole("button", { name: /^fork(\s*\(\d+\))?$/i }).click();

    // Confirmation modal should appear
    await expect(page.getByText(/fork skill/i)).toBeVisible();
    await expect(page.getByText(/you.*ll get a copy to customize/i)).toBeVisible();

    // Modal should have Fork and Cancel buttons
    await expect(page.getByRole("button", { name: /^cancel$/i })).toBeVisible();

    // Cancel should close the modal
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(page.getByText(/you.*ll get a copy to customize/i)).not.toBeVisible();
  });

  test("should display fork attribution on forked skill", async ({ page }) => {
    await page.goto(`/skills/${forkedSkillSlug}`);

    // Should show "Forked from" attribution
    await expect(page.getByText("Forked from")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Fork Parent Skill").first()).toBeVisible();
    await expect(page.getByText("Fork Author")).toBeVisible();
  });

  test("should display forks section on parent skill", async ({ page }) => {
    await page.goto(`/skills/${parentSkillSlug}`);

    // Should show Forks section with count
    await expect(page.getByText(/forks \(1\)/i)).toBeVisible({ timeout: 10000 });

    // The fork card should be visible (use .first() since similar skills section may also show it)
    await expect(page.getByText("Fork Parent Skill (Fork)").first()).toBeVisible();
  });

  test("should show fork count in stats on parent skill", async ({ page }) => {
    await page.goto(`/skills/${parentSkillSlug}`);

    // Stats section should show Forks stat (exact match to avoid matching "Forks (1)" heading)
    await expect(page.getByText("Forks", { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
