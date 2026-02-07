import { db } from "@relay/db";
import { usageEvents, type NewUsageEvent } from "@relay/db/schema/usage-events";
import { incrementSkillUses } from "@relay/db/services/skill-metrics";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

/**
 * Track MCP tool usage for analytics
 * Called within each tool handler after successful execution
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
    await db.insert(usageEvents).values({ tenantId: DEFAULT_TENANT_ID, ...event });

    // Increment skill usage counter for denormalized totalUses
    if (event.skillId && !skipIncrement) {
      await incrementSkillUses(event.skillId);
    }
  } catch (error) {
    // Log but don't fail the tool call - tracking is non-critical
    console.error("Failed to track usage:", error);
  }
}

export type { NewUsageEvent };
