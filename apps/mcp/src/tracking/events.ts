import { db } from "@relay/db";
import { usageEvents, type NewUsageEvent } from "@relay/db/schema/usage-events";
import { incrementSkillUses } from "@relay/db/services/skill-metrics";

/**
 * Track MCP tool usage for analytics
 * Called within each tool handler after successful execution
 */
export async function trackUsage(
  event: Omit<NewUsageEvent, "id" | "createdAt">,
  { skipIncrement = false }: { skipIncrement?: boolean } = {}
): Promise<void> {
  try {
    if (!db) {
      console.error("Database not configured, skipping usage tracking");
      return;
    }
    await db.insert(usageEvents).values(event);

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
