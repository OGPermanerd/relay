import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * User table schema
 * Uses text id and Auth.js required fields for DrizzleAdapter compatibility
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Type inference helpers
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
