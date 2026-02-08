import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Category score structure stored as JSONB
 * Each review category has a numeric score (1-10) and improvement suggestions
 */
export interface ReviewCategoryScore {
  score: number; // 1-10
  suggestions: string[]; // 1-2 actionable suggestions
}

/**
 * Three review categories evaluated by the AI reviewer
 */
export interface ReviewCategories {
  quality: ReviewCategoryScore;
  clarity: ReviewCategoryScore;
  completeness: ReviewCategoryScore;
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
export const skillReviews = pgTable(
  "skill_reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id),
    categories: jsonb("categories").$type<ReviewCategories>().notNull(),
    summary: text("summary").notNull(), // Brief overall summary from AI
    suggestedDescription: text("suggested_description"), // AI-suggested improved description
    reviewedContentHash: text("reviewed_content_hash").notNull(), // SHA-256 hash of content at review time
    modelName: text("model_name").notNull(), // e.g., "claude-haiku-4-5-20241022"
    isVisible: boolean("is_visible").notNull().default(true), // Author can hide
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("skill_reviews_tenant_skill_unique").on(table.tenantId, table.skillId),
    index("skill_reviews_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillReview = typeof skillReviews.$inferSelect;
export type NewSkillReview = typeof skillReviews.$inferInsert;
