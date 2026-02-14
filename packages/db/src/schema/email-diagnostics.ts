import { pgTable, text, integer, timestamp, jsonb, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Email diagnostics — aggregate-only email analysis results.
 * Stores computed statistics (category counts, time estimates, behavioral patterns).
 * Does NOT store individual email metadata (From, Subject, Date).
 * Privacy-first: raw metadata processed in-memory, only aggregate stats persisted.
 */
export const emailDiagnostics = pgTable(
  "email_diagnostics",
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
    scanDate: timestamp("scan_date", { withTimezone: true }).notNull().defaultNow(),
    scanPeriodDays: integer("scan_period_days").notNull(),
    totalMessages: integer("total_messages").notNull(),
    estimatedHoursPerWeek: integer("estimated_hours_per_week").notNull(), // stored as tenths (e.g., 125 = 12.5 hours)
    categoryBreakdown: jsonb("category_breakdown").notNull(), // array of {category, count, percentage, estimatedMinutes}
    patternInsights: jsonb("pattern_insights"), // {busiestHour, busiestDayOfWeek, averageResponseTimeHours, threadDepthAverage}
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("email_diagnostics_user_id_idx").on(table.userId),
    index("email_diagnostics_tenant_id_idx").on(table.tenantId),
    index("email_diagnostics_scan_date_idx").on(table.scanDate),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type EmailDiagnostic = typeof emailDiagnostics.$inferSelect;
export type NewEmailDiagnostic = typeof emailDiagnostics.$inferInsert;
