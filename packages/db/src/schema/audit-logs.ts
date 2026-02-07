import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

/**
 * Audit logs table - SOC2 compliance tracking
 * Records all significant actions for security auditing
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id"), // User who performed the action
  tenantId: text("tenant_id"), // Tenant context (nullable for cross-tenant events)
  action: text("action").notNull(), // e.g., "auth.login", "skill.create"
  resourceType: text("resource_type"), // e.g., "skill", "api_key"
  resourceId: text("resource_id"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Type inference helpers
 */
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
