import { pgTable, pgEnum, text, timestamp, boolean, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Digest frequency enum for notification preferences
 */
export const digestFrequencyEnum = pgEnum("digest_frequency", ["none", "daily", "weekly"]);

/**
 * Notification preferences table - per-user notification settings
 *
 * One row per user. Controls which notification types are enabled
 * for email and in-app delivery, plus digest frequency for trending skills.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
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
    groupingProposalEmail: boolean("grouping_proposal_email").notNull().default(true),
    groupingProposalInApp: boolean("grouping_proposal_in_app").notNull().default(true),
    trendingDigest: digestFrequencyEnum("trending_digest").notNull().default("weekly"),
    platformUpdatesEmail: boolean("platform_updates_email").notNull().default(true),
    platformUpdatesInApp: boolean("platform_updates_in_app").notNull().default(true),
    reviewNotificationsEmail: boolean("review_notifications_email").notNull().default(true),
    reviewNotificationsInApp: boolean("review_notifications_in_app").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_preferences_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
