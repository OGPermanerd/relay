import { pgTable, text, timestamp, integer, jsonb, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Skill versions table - immutable records of skill content at a point in time
 * Wiki-style versioning: new versions create records, never modify existing ones
 */
export const skillVersions = pgTable(
  "skill_versions",
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
    version: integer("version").notNull(), // Sequential: 1, 2, 3...
    contentUrl: text("content_url").notNull(), // R2 object key for skill content
    contentHash: text("content_hash").notNull(), // SHA-256 hash for integrity verification
    contentType: text("content_type").notNull(), // MIME type: text/markdown, application/json
    name: text("name").notNull(), // Snapshot of name at version creation
    description: text("description").notNull(), // Snapshot of description at version creation
    metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Format-specific data
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("skill_versions_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillVersion = typeof skillVersions.$inferSelect;
export type NewSkillVersion = typeof skillVersions.$inferInsert;
