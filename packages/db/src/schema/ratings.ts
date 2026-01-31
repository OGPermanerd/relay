import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { skills } from "./skills";
import { users } from "./users";

/**
 * Ratings table - user ratings for skills
 * Supports 1-5 star ratings with optional comments and time-saved estimates
 */
export const ratings = pgTable("ratings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5 stars (constraint enforced at app level)
  comment: text("comment"), // Optional review text
  hoursSavedEstimate: integer("hours_saved_estimate"), // User's estimate of time saved
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
