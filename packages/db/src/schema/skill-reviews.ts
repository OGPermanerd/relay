import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { skills } from "./skills";
import { users } from "./users";

/**
 * Category score structure stored as JSONB
 * Each of the six review categories has a numeric score (1-10) and improvement suggestions
 */
export interface ReviewCategoryScore {
  score: number; // 1-10
  suggestions: string[]; // 1-2 actionable suggestions
}

/**
 * All six review categories evaluated by the AI reviewer
 */
export interface ReviewCategories {
  functionality: ReviewCategoryScore;
  quality: ReviewCategoryScore;
  security: ReviewCategoryScore;
  clarity: ReviewCategoryScore;
  completeness: ReviewCategoryScore;
  reusability: ReviewCategoryScore;
}

/**
 * Skill reviews table - AI-generated quality reviews for skills
 *
 * Each skill has at most one review (latest replaces previous via unique constraint).
 * Reviews are on-demand, triggered by the skill author, and advisory-only.
 *
 * The reviewedContentHash field enables change detection:
 * re-review is only available when skill content has changed since last review.
 */
export const skillReviews = pgTable("skill_reviews", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  skillId: text("skill_id")
    .notNull()
    .unique() // Only one review per skill (latest replaces previous)
    .references(() => skills.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => users.id),
  categories: jsonb("categories").$type<ReviewCategories>().notNull(),
  summary: text("summary").notNull(), // Brief overall summary from AI
  reviewedContentHash: text("reviewed_content_hash").notNull(), // SHA-256 hash of content at review time
  modelName: text("model_name").notNull(), // e.g., "claude-haiku-4-5-20241022"
  isVisible: boolean("is_visible").notNull().default(true), // Author can hide
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export type SkillReview = typeof skillReviews.$inferSelect;
export type NewSkillReview = typeof skillReviews.$inferInsert;
