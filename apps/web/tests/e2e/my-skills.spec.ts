import { test, expect } from "@playwright/test";
import { db, skills, users } from "@relay/db";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "e2e-test-user";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

test.describe("My Skills Page", () => {
  test.describe.configure({ mode: "serial" });

  let testSkillId: string;
  const testSlug = `my-skills-test-${Date.now()}`;

  test.beforeAll(async () => {
    if (!db) throw new Error("DATABASE_URL is required for E2E tests");

    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoNothing();

    const [skill] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: "My Skills Test Skill",
        slug: testSlug,
        description: "A skill for my-skills page E2E testing",
        category: "prompt",
        content: "Test content",
        hoursSaved: 2,
        tags: ["testing"],
        authorId: TEST_USER_ID,
      })
      .returning({ id: skills.id });

    testSkillId = skill.id;
  });

  test.afterAll(async () => {
    if (!db) return;
    if (testSkillId) {
      await db.delete(skills).where(eq(skills.id, testSkillId));
    }
  });

  test("my-skills page loads and shows user skills", async ({ page }) => {
    await page.goto("/my-skills");
    await expect(page.getByRole("heading", { name: "My Skills" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("My Skills Test Skill")).toBeVisible();
  });

  test("my-skills page shows delete button for owned skill", async ({ page }) => {
    await page.goto("/my-skills");
    await expect(page.getByText("My Skills Test Skill")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /delete/i }).first()).toBeVisible();
  });

  test("profile page has link to my-skills", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "My Skills" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: /Go to My Skills/ })).toBeVisible();
  });
});
