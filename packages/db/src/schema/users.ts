import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * User table schema
 * Placeholder for Phase 2 Auth - defines base user structure
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Type inference helpers
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
