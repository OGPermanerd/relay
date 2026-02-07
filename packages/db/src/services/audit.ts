import { db } from "../client";
import { auditLogs } from "../schema/audit-logs";

export interface AuditEntry {
  actorId?: string | null;
  tenantId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry. Fire-and-forget safe.
 * Uses direct INSERT (not transaction-scoped) because audit_logs
 * is append-only and doesn't need RLS tenant filtering.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!db) return;
  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

/**
 * Write multiple audit log entries in a single INSERT.
 */
export async function writeAuditLogs(entries: AuditEntry[]): Promise<void> {
  if (!db || entries.length === 0) return;
  try {
    await db.insert(auditLogs).values(entries);
  } catch (error) {
    console.error("Failed to write audit logs:", error);
  }
}
