import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { skills } from "./skills";

/**
 * User skill views table - tracks when each user last viewed each skill.
 *
 * Used for temporal tracking: "Updated" badges, "What's New" feed,
 * and change detection (new feedback, version bumps since last view).
 *
 * One row per (tenant, user, skill) combination. UPSERT on re-view
 * updates lastViewedAt and increments viewCount.
 */
export const userSkillViews = pgTable(
  "user_skill_views",
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
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    lastViewedVersion: integer("last_viewed_version"),
    viewCount: integer("view_count").notNull().default(1),
  },
  (table) => [
    uniqueIndex("user_skill_views_tenant_user_skill_unique").on(
      table.tenantId,
      table.userId,
      table.skillId
    ),
    index("user_skill_views_user_id_idx").on(table.userId),
    index("user_skill_views_skill_id_idx").on(table.skillId),
    index("user_skill_views_tenant_id_idx").on(table.tenantId),
    index("user_skill_views_user_viewed_idx").on(table.userId, table.lastViewedAt),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type UserSkillView = typeof userSkillViews.$inferSelect;
export type NewUserSkillView = typeof userSkillViews.$inferInsert;
