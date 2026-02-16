import { pgTable, text, timestamp, doublePrecision, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Work artifacts table for pre-LLM history.
 * Stores documents, emails, templates, scripts, and other work products
 * that demonstrate a user's skills before they started using AI tooling.
 */
export const workArtifacts = pgTable(
  "work_artifacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("other"),
    artifactDate: timestamp("artifact_date").notNull(),
    fileName: text("file_name"),
    fileType: text("file_type"),
    extractedText: text("extracted_text"),
    suggestedSkillIds: text("suggested_skill_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    estimatedHoursSaved: doublePrecision("estimated_hours_saved"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("work_artifacts_user_id_idx").on(table.userId),
    index("work_artifacts_tenant_id_idx").on(table.tenantId),
    index("work_artifacts_user_date_idx").on(table.userId, table.artifactDate),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type WorkArtifact = typeof workArtifacts.$inferSelect;
export type NewWorkArtifact = typeof workArtifacts.$inferInsert;
