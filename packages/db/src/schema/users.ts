import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * User table schema
 * Uses text id for Auth.js DrizzleAdapter compatibility
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
