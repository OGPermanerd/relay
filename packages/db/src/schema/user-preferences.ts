import { pgTable, text, timestamp, jsonb, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Interface mirroring the Zod-validated shape in apps/web/lib/preferences-defaults.ts.
 * Defined here to avoid cross-package imports (packages/db cannot import from apps/web).
 */
export interface UserPreferencesData {
  preferredCategories: ("productivity" | "wiring" | "doc-production" | "data-viz" | "code")[];
  defaultSort: "uses" | "quality" | "rating" | "days_saved";
  claudeMdWorkflowNotes: string;
}

/**
 * User preferences table - per-user JSONB preferences
 *
 * One row per user. Stores structured preferences as JSONB with
 * code-defined defaults merged at read time. Zod validates on write.
 */
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    preferences: jsonb("preferences").notNull().default("{}").$type<UserPreferencesData>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    greetingPool: jsonb("greeting_pool").$type<string[]>(),
    greetingPoolGeneratedAt: timestamp("greeting_pool_generated_at", { withTimezone: true }),
  },
  (table) => [
    index("user_preferences_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
