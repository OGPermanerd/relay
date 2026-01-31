import { test, expect } from "@playwright/test";
import { db, skills } from "@relay/db";
import { eq } from "drizzle-orm";

// Skill slug created by the skill upload test
// We use a test skill that exists in the database
const TEST_USER_ID = "e2e-test-user";

test.describe("Skill Rating Flow", () => {
  let testSkillSlug: string;

  test.beforeAll(async () => {
    // Find or create a skill for rating tests
    // First check if our test skill exists
    if (!db) {
      throw new Error("DATABASE_URL is required for E2E tests");
    }

    const existingSkill = await db.query.skills.findFirst({
      where: eq(skills.authorId, TEST_USER_ID),
      columns: { slug: true },
    });

    if (existingSkill) {
      testSkillSlug = existingSkill.slug;
    } else {
      // Create a test skill for rating
      const [newSkill] = await db
        .insert(skills)
        .values({
          name: "Rating Test Skill",
          slug: `rating-test-skill-${Date.now()}`,
          description: "A skill created for rating E2E tests",
          category: "prompt",
          content: "Test content for rating",
          hoursSaved: 1,
          authorId: TEST_USER_ID,
        })
        .returning({ slug: skills.slug });
      testSkillSlug = newSkill.slug;
    }
  });

  test("should show rating form on skill detail page for authenticated user", async ({ page }) => {
    // Navigate to skill detail page
    await page.goto(`/skills/${testSkillSlug}`);

    // Verify the rating form is visible (authenticated users see this)
    await expect(page.getByRole("heading", { name: /rate this skill/i })).toBeVisible();

    // Verify star rating input exists (5 radio buttons for stars)
    await expect(page.getByText(/select rating/i)).toBeVisible();

    // Verify comment field exists
    await expect(page.getByLabel(/comment/i)).toBeVisible();

    // Verify hours saved field exists
    await expect(page.getByLabel(/hours saved/i)).toBeVisible();

    // Verify submit button exists
    await expect(page.getByRole("button", { name: /submit rating/i })).toBeVisible();
  });

  test("should successfully submit a rating with comment and time saved", async ({ page }) => {
    // Navigate to skill detail page
    await page.goto(`/skills/${testSkillSlug}`);

    // Wait for rating form to be visible
    await expect(page.getByRole("heading", { name: /rate this skill/i })).toBeVisible();

    // Click on 4-star rating (the 4th star label)
    // The StarRatingInput uses radio buttons with labels
    await page.locator('input[name="rating"][value="4"]').check({ force: true });

    // Verify star selection shows "4 stars"
    await expect(page.getByText("4 stars")).toBeVisible();

    // Fill in comment
    await page.getByLabel(/comment/i).fill("This skill is excellent for automation testing!");

    // Fill in hours saved estimate
    await page.getByLabel(/hours saved/i).fill("5");

    // Submit the rating
    await page.getByRole("button", { name: /submit rating/i }).click();

    // Wait for success message
    await expect(page.getByText(/rating submitted|updated/i)).toBeVisible({ timeout: 10000 });

    // After submission, the form should show "Update Rating" instead of "Submit Rating"
    await expect(page.getByRole("button", { name: /update rating/i })).toBeVisible();
  });
});
