import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Skills table - minimal schema for MCP testing
 * Full schema will be expanded in Phase 4 (Data Model)
 */
export const skills = pgTable("skills", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(), // prompt, workflow, agent, mcp
  content: text("content").notNull(), // The actual skill content (markdown)
  hoursSaved: integer("hours_saved").default(1), // Estimated hours saved per use
  authorId: text("author_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
