import { db } from "@everyskill/db";
import { usageEvents, type NewUsageEvent } from "@everyskill/db/schema/usage-events";
import { incrementSkillUses } from "@everyskill/db/services/skill-metrics";
import { writeAuditLog } from "@everyskill/db/services/audit";
import { getTenantId } from "../auth.js";

// Fallback tenant ID for anonymous MCP usage (no API key configured)
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

/**
 * Track MCP tool usage for analytics and write audit log entry.
 * Called within each tool handler after successful execution.
 */
export async function trackUsage(
  event: Omit<NewUsageEvent, "id" | "createdAt" | "tenantId"> & { tenantId?: string },
  { skipIncrement = false }: { skipIncrement?: boolean } = {}
): Promise<void> {
  try {
    if (!db) {
      console.error("Database not configured, skipping usage tracking");
      return;
    }
    const tenantId = event.tenantId || getTenantId() || DEFAULT_TENANT_ID;
    await db.insert(usageEvents).values({ ...event, tenantId });

    // Increment skill usage counter for denormalized totalUses
    if (event.skillId && !skipIncrement) {
      await incrementSkillUses(event.skillId);
    }

    // Audit log — fire-and-forget
    writeAuditLog({
      actorId: event.userId,
      tenantId,
      action: `mcp.${event.toolName}`,
      resourceType: event.skillId ? "skill" : "mcp_tool",
      resourceId: event.skillId || event.toolName,
      metadata: {
        transport: "stdio",
        ...(event.metadata as Record<string, unknown> | undefined),
      },
    }).catch(() => {});
  } catch (error) {
    // Log but don't fail the tool call - tracking is non-critical
    console.error("Failed to track usage:", error);
  }
}

export type { NewUsageEvent };
