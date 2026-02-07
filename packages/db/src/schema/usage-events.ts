import { pgTable, text, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Usage events track MCP tool invocations for analytics
 * Supports both anonymous (no userId) and authenticated usage
 */
export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  toolName: text("tool_name").notNull(),
  skillId: text("skill_id"), // text to match skills table (created in Plan 02)
  userId: text("user_id").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("usage_events_tenant_id_idx").on(table.tenantId),
]);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
