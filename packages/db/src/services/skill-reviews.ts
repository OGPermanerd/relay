import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { skillReviews } from "../schema";
import type { SkillReview, ReviewCategories } from "../schema";

/**
 * Parameters for creating or updating a skill review
 */
export interface UpsertSkillReviewParams {
  skillId: string;
  tenantId: string;
  requestedBy: string;
  categories: ReviewCategories;
  summary: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  reviewedContentHash: string;
  modelName: string;
  isVisible?: boolean;
}

/**
 * Get the AI review for a skill
 * Returns null if no review exists
 */
export async function getSkillReview(skillId: string): Promise<SkillReview | null> {
  if (!db) {
    console.warn("Database not configured, skipping getSkillReview");
    return null;
  }

  const result = await db
    .select()
    .from(skillReviews)
    .where(eq(skillReviews.skillId, skillId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Insert or update an AI review for a skill
 * Uses ON CONFLICT on skillId to replace previous review (one review per skill)
 */
export async function upsertSkillReview(data: UpsertSkillReviewParams): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping upsertSkillReview");
    return;
  }

  // Use raw SQL for the upsert to handle columns with defaults
  // (Drizzle ORM excludes columns with .default() from onConflictDoUpdate set type)
  await db.execute(sql`
    INSERT INTO skill_reviews (id, tenant_id, skill_id, requested_by, categories, summary, suggested_title, suggested_description, reviewed_content_hash, model_name, is_visible, created_at)
    VALUES (
      ${crypto.randomUUID()},
      ${data.tenantId},
      ${data.skillId},
      ${data.requestedBy},
      ${JSON.stringify(data.categories)}::jsonb,
      ${data.summary},
      ${data.suggestedTitle ?? null},
      ${data.suggestedDescription ?? null},
      ${data.reviewedContentHash},
      ${data.modelName},
      ${data.isVisible ?? true},
      NOW()
    )
    ON CONFLICT (tenant_id, skill_id) DO UPDATE SET
      requested_by = EXCLUDED.requested_by,
      categories = EXCLUDED.categories,
      summary = EXCLUDED.summary,
      suggested_title = EXCLUDED.suggested_title,
      suggested_description = EXCLUDED.suggested_description,
      reviewed_content_hash = EXCLUDED.reviewed_content_hash,
      model_name = EXCLUDED.model_name,
      created_at = NOW()
  `);
}

/**
 * Toggle the visibility of a skill's AI review
 * Authors can hide/show their review
 */
export async function toggleReviewVisibility(skillId: string, isVisible: boolean): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping toggleReviewVisibility");
    return;
  }

  await db.execute(
    sql`UPDATE skill_reviews SET is_visible = ${isVisible} WHERE skill_id = ${skillId}`
  );
}
