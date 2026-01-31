import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Skills table - versioned skill definitions with denormalized aggregates
 *
 * Version references:
 * - publishedVersionId: Currently published version visible to users
 * - draftVersionId: Work-in-progress version for editing
 *
 * Note: Can't add FK to skillVersions.id due to circular reference.
 * Relationship constraints handled in application layer.
 */
export const skills = pgTable("skills", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(), // prompt, workflow, agent, mcp

  // Version references (no FK due to circular dependency with skillVersions)
  publishedVersionId: text("published_version_id"), // Currently published version
  draftVersionId: text("draft_version_id"), // Work-in-progress version

  // Denormalized aggregates for performance
  totalUses: integer("total_uses").notNull().default(0), // Sum from usageEvents
  averageRating: integer("average_rating"), // Rating * 100 for precision (e.g., 425 = 4.25 stars)

  // DEPRECATED: Will be removed after migration to R2 storage
  // MCP tools currently use this field - migrate in a later plan
  content: text("content").notNull(), // The actual skill content (markdown)
  hoursSaved: integer("hours_saved").default(1), // Estimated hours saved per use

  authorId: text("author_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
