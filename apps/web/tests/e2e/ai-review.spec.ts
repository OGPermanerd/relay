import { test, expect } from "@playwright/test";
import { db, skills, users } from "@everyskill/db";
import { skillReviews } from "@everyskill/db/schema";
import { eq } from "drizzle-orm";
import { hashContent } from "@/lib/content-hash";

const TEST_USER_ID = "e2e-test-user";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

test.describe("AI Review Display", () => {
  test.describe.configure({ mode: "serial" });

  let testSkillSlug: string;
  let testSkillId: string;

  test.beforeAll(async () => {
    if (!db) {
      throw new Error("DATABASE_URL is required for E2E tests");
    }

    // Ensure the test user exists
    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoNothing();

    // Create a skill owned by the test user for AI review testing
    const slug = `ai-review-test-${Date.now()}`;
    const content = "Test skill content for AI review E2E test";

    const [newSkill] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: "AI Review Test Skill",
        slug,
        description: "A skill for testing the AI review display",
        category: "prompt",
        content,
        hoursSaved: 1,
        authorId: TEST_USER_ID,
      })
      .returning({ id: skills.id, slug: skills.slug });

    testSkillId = newSkill.id;
    testSkillSlug = newSkill.slug;

    // Seed a review with the new 3-category format
    const contentHash = await hashContent(content);

    await db.insert(skillReviews).values({
      tenantId: DEFAULT_TENANT_ID,
      skillId: testSkillId,
      requestedBy: TEST_USER_ID,
      categories: {
        quality: {
          score: 8,
          suggestions: ["Add error handling for edge cases", "Consider adding input validation"],
        },
        clarity: {
          score: 7,
          suggestions: ["Break the prompt into numbered steps for readability"],
        },
        completeness: {
          score: 9,
          suggestions: ["Include an example output to set expectations"],
        },
      },
      summary:
        "A well-crafted skill that produces reliable results. Minor improvements in clarity and error handling would elevate it further.",
      reviewedContentHash: contentHash,
      modelName: "claude-sonnet-4-20250514",
      isVisible: true,
    });
  });

  test.afterAll(async () => {
    if (!db) return;
    // Clean up seeded review and skill
    await db.delete(skillReviews).where(eq(skillReviews.skillId, testSkillId));
    await db.delete(skills).where(eq(skills.id, testSkillId));
  });

  test("should display 3 categories and overall score on AI Review tab", async ({ page }) => {
    await page.goto(`/skills/${testSkillSlug}`);

    // Click the AI Review tab
    await page.getByRole("tab", { name: "AI Review" }).click();

    // Wait for the AI Review badge
    await expect(page.getByText("AI Review").first()).toBeVisible({ timeout: 10000 });

    // Verify overall score is displayed (average of 8+7+9 = 24/3 = 8)
    const overallBadge = page.locator(".text-lg.font-bold");
    await expect(overallBadge).toHaveText("8/10");
    await expect(page.getByText("Overall")).toBeVisible();

    // Verify all 3 category labels are present
    await expect(page.getByText("Quality", { exact: true })).toBeVisible();
    await expect(page.getByText("Clarity", { exact: true })).toBeVisible();
    await expect(page.getByText("Completeness", { exact: true })).toBeVisible();

    // Verify old categories are NOT present
    await expect(page.getByText("Functionality", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Security", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Reusability", { exact: true })).not.toBeVisible();

    // Verify summary text
    await expect(
      page.getByText("A well-crafted skill that produces reliable results")
    ).toBeVisible();

    // Verify suggestions are rendered
    await expect(page.getByText("Add error handling for edge cases")).toBeVisible();
    await expect(
      page.getByText("Break the prompt into numbered steps for readability")
    ).toBeVisible();
    await expect(page.getByText("Include an example output to set expectations")).toBeVisible();

    // Verify model name in footer
    await expect(page.getByText("claude-sonnet-4-20250514")).toBeVisible();
  });

  test("should persist review on page reload", async ({ page }) => {
    await page.goto(`/skills/${testSkillSlug}`);

    // Click AI Review tab
    await page.getByRole("tab", { name: "AI Review" }).click();

    // Verify review is visible
    const overallBadge = page.locator(".text-lg.font-bold");
    await expect(page.getByText("Overall")).toBeVisible({ timeout: 10000 });
    await expect(overallBadge).toHaveText("8/10");

    // Reload the page
    await page.reload();

    // Click AI Review tab again (tabs reset on reload)
    await page.getByRole("tab", { name: "AI Review" }).click();

    // Verify review still displays
    await expect(page.getByText("Overall")).toBeVisible({ timeout: 10000 });
    await expect(overallBadge).toHaveText("8/10");
    await expect(page.getByText("Quality", { exact: true })).toBeVisible();
    await expect(page.getByText("Clarity", { exact: true })).toBeVisible();
    await expect(page.getByText("Completeness", { exact: true })).toBeVisible();
  });
});
