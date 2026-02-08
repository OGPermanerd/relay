import { pgTable, text, timestamp, jsonb, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";
import type { ReviewCategories } from "./skill-reviews";

/**
 * Review decisions table - immutable audit trail for admin review actions
 *
 * This table is INSERT-ONLY (no updatedAt column) for SOC2 compliance.
 * Each row represents a single admin decision on a skill review.
 * Multiple decisions per skill are expected (e.g., reject then approve after changes).
 *
 * Separate from skill_reviews which stores mutable AI review data.
 */
export const reviewDecisions = pgTable(
  "review_decisions",
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
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // "approved" | "rejected" | "changes_requested"
    notes: text("notes"), // Optional reviewer notes
    aiScoresSnapshot: jsonb("ai_scores_snapshot").$type<ReviewCategories>(), // Snapshot of AI scores at decision time
    previousContent: text("previous_content"), // Snapshot of skills.content at decision time for future diff
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    // NO updatedAt — table is insert-only, immutable for SOC2 compliance
  },
  (table) => [
    index("review_decisions_skill_id_idx").on(table.skillId),
    index("review_decisions_tenant_id_idx").on(table.tenantId),
    index("review_decisions_reviewer_id_idx").on(table.reviewerId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type ReviewDecision = typeof reviewDecisions.$inferSelect;
export type NewReviewDecision = typeof reviewDecisions.$inferInsert;
