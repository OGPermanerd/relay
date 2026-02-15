import { pgTable, text, timestamp, integer, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Token measurements table - tracks token usage and cost per skill invocation
 * Used for cost estimation, benchmarking, and optimization
 */
export const tokenMeasurements = pgTable(
  "token_measurements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    usageEventId: text("usage_event_id"), // NO FK — uuid/text type mismatch with usage_events
    userId: text("user_id").references(() => users.id),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    modelName: text("model_name").notNull(),
    modelProvider: text("model_provider").notNull().default("anthropic"),
    estimatedCostMicrocents: integer("estimated_cost_microcents"),
    latencyMs: integer("latency_ms"),
    source: text("source").notNull().default("hook"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("token_measurements_skill_id_idx").on(table.skillId),
    index("token_measurements_model_name_idx").on(table.modelName),
    index("token_measurements_tenant_id_idx").on(table.tenantId),
    index("token_measurements_created_at_idx").on(table.createdAt),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type TokenMeasurement = typeof tokenMeasurements.$inferSelect;
export type NewTokenMeasurement = typeof tokenMeasurements.$inferInsert;
