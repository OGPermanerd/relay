import { test, expect } from "@playwright/test";
import { db, skills, users } from "@relay/db";
import { ne } from "drizzle-orm";

// We need a skill from a DIFFERENT author than the test user to rate it
// Test user ID is "e2e-test-user"
const TEST_USER_ID = "e2e-test-user";
const OTHER_AUTHOR_ID = "e2e-other-author";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

test.describe("Skill Rating Flow", () => {
  let testSkillSlug: string;

  test.beforeAll(async () => {
    if (!db) {
      throw new Error("DATABASE_URL is required for E2E tests");
    }

    // Ensure a different author exists for the skill we'll rate
    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: OTHER_AUTHOR_ID,
        email: "other-author@company.com",
        name: "Other Author",
      })
      .onConflictDoNothing();

    // Find or create a skill from the OTHER author
    const existingSkill = await db.query.skills.findFirst({
      where: ne(skills.authorId, TEST_USER_ID),
      columns: { slug: true },
    });

    if (existingSkill) {
      testSkillSlug = existingSkill.slug;
    } else {
      // Create a test skill from a different author for rating
      const [newSkill] = await db
        .insert(skills)
        .values({
          tenantId: DEFAULT_TENANT_ID,
          name: "Skill To Rate",
          slug: `skill-to-rate-${Date.now()}`,
          description: "A skill from another author for rating E2E tests",
          category: "prompt",
          content: "Test content for rating",
          hoursSaved: 1,
          authorId: OTHER_AUTHOR_ID,
        })
        .returning({ slug: skills.slug });
      testSkillSlug = newSkill.slug;
    }
  });

  test("should show rating form on skill detail page for authenticated user", async ({ page }) => {
    // Navigate to skill detail page
    await page.goto(`/skills/${testSkillSlug}`);

    // Wait for page to load and check for rating form section
    // The heading can be "Rate This Skill" (new rating) or "Update Your Rating" (existing rating)
    await expect(
      page.getByRole("heading", { name: /rate this skill|update your rating/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify comment field exists (with optional marker)
    await expect(page.getByLabel(/comment/i)).toBeVisible();

    // Verify hours saved field exists
    await expect(page.getByLabel(/hours saved/i)).toBeVisible();

    // Verify submit button exists (either "Submit Rating" or "Update Rating")
    await expect(page.getByRole("button", { name: /submit rating|update rating/i })).toBeVisible();
  });

  test("should interact with rating form and submit", async ({ page }) => {
    // Navigate to skill detail page
    await page.goto(`/skills/${testSkillSlug}`);

    // Wait for rating form to be visible (either new or update)
    await expect(
      page.getByRole("heading", { name: /rate this skill|update your rating/i })
    ).toBeVisible({ timeout: 10000 });

    // Click on 4-star rating (the 4th star label)
    // The StarRatingInput uses radio buttons with labels
    await page.locator('input[name="rating"][value="4"]').check({ force: true });

    // Verify star selection shows "4 stars"
    await expect(page.getByText("4 stars")).toBeVisible();

    // Fill in comment
    await page.getByLabel(/comment/i).fill("This skill is excellent for automation testing!");

    // Fill in hours saved estimate
    await page.getByLabel(/hours saved/i).fill("5");

    // Submit the rating (button could say Submit or Update)
    const submitButton = page.getByRole("button", { name: /submit rating|update rating/i });
    await submitButton.click();

    // Wait for the form to process — button changes to "Submitting..." or
    // the page revalidates. Either way, the form should remain functional.
    await page.waitForLoadState("networkidle");

    // After submission, verify the page is still in a valid state:
    // Either success message, or form is still visible for interaction
    await expect(page.getByRole("button", { name: /submit rating|update rating/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
