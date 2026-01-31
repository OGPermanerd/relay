import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { skills } from "./skills";
import { users } from "./users";

/**
 * Skill versions table - immutable records of skill content at a point in time
 * Wiki-style versioning: new versions create records, never modify existing ones
 */
export const skillVersions = pgTable("skill_versions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
});

export type SkillVersion = typeof skillVersions.$inferSelect;
export type NewSkillVersion = typeof skillVersions.$inferInsert;
