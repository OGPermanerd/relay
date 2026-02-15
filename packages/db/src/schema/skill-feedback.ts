import { pgTable, text, timestamp, integer, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { skillVersions } from "./skill-versions";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Skill feedback table - user feedback on skills
 * Supports multiple feedback types: thumbs_up, thumbs_down, suggestion, training_example, bug_report
 * Nullable userId allows anonymous MCP feedback
 */
export const skillFeedback = pgTable(
  "skill_feedback",
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
    skillVersionId: text("skill_version_id").references(() => skillVersions.id),
    userId: text("user_id").references(() => users.id),
    usageEventId: text("usage_event_id"), // NO FK — uuid/text type mismatch with usage_events
    feedbackType: text("feedback_type").notNull(), // "thumbs_up" | "thumbs_down" | "suggestion" | "training_example" | "bug_report"
    sentiment: integer("sentiment"), // -1, 0, 1
    comment: text("comment"),
    suggestedContent: text("suggested_content"),
    suggestedDiff: text("suggested_diff"),
    exampleInput: text("example_input"),
    exampleOutput: text("example_output"),
    expectedOutput: text("expected_output"),
    qualityScore: integer("quality_score"), // 1-10
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    source: text("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("skill_feedback_skill_id_idx").on(table.skillId),
    index("skill_feedback_user_id_idx").on(table.userId),
    index("skill_feedback_tenant_id_idx").on(table.tenantId),
    index("skill_feedback_feedback_type_idx").on(table.feedbackType),
    index("skill_feedback_status_idx").on(table.status),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillFeedback = typeof skillFeedback.$inferSelect;
export type NewSkillFeedback = typeof skillFeedback.$inferInsert;
