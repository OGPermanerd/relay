import { test, expect } from "@playwright/test";
import { db, skills, users } from "@relay/db";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "e2e-test-user";

test.describe("Delete Skill", () => {
  test.describe.configure({ mode: "serial" });

  let deleteSkillId: string;
  let deleteSkillSlug: string;

  test.beforeAll(async () => {
    if (!db) throw new Error("DATABASE_URL is required for E2E tests");

    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoNothing();

    const slug = `delete-test-${Date.now()}`;
    const [skill] = await db
      .insert(skills)
      .values({
        name: "Skill To Delete",
        slug,
        description: "A skill for delete E2E testing",
        category: "prompt",
        content: "Delete test content",
        hoursSaved: 1,
        tags: ["testing"],
        authorId: TEST_USER_ID,
      })
      .returning({ id: skills.id, slug: skills.slug });

    deleteSkillId = skill.id;
    deleteSkillSlug = skill.slug;
  });

  test.afterAll(async () => {
    if (!db) return;
    // Clean up in case deletion test didn't run
    if (deleteSkillId) {
      await db
        .delete(skills)
        .where(eq(skills.id, deleteSkillId))
        .catch(() => {});
    }
  });

  test("delete button visible on detail page for author", async ({ page }) => {
    await page.goto(`/skills/${deleteSkillSlug}`);
    await expect(page.getByRole("button", { name: /delete/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("confirmation modal appears on delete click", async ({ page }) => {
    await page.goto(`/skills/${deleteSkillSlug}`);
    await page.getByRole("button", { name: /delete/i }).click();

    await expect(page.getByText("Delete skill")).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^cancel$/i })).toBeVisible();

    // Cancel should close
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).not.toBeVisible();
  });

  test("deleting a skill removes it and redirects", async ({ page }) => {
    await page.goto(`/skills/${deleteSkillSlug}`);
    await page.getByRole("button", { name: /delete/i }).click();

    // Click the confirm delete button inside the modal form
    const modal = page.locator(".fixed.inset-0");
    await modal.getByRole("button", { name: /^delete$/i }).click();

    // Should redirect to my-skills (wait for URL change via client-side navigation)
    await expect(async () => {
      expect(page.url()).toContain("/my-skills");
    }).toPass({ timeout: 15000 });
  });
});
