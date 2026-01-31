import { db, usageEvents, type NewUsageEvent } from "@relay/db";

/**
 * Track MCP tool usage for analytics
 * Called within each tool handler after successful execution
 */
export async function trackUsage(event: Omit<NewUsageEvent, "id" | "createdAt">): Promise<void> {
  try {
    if (!db) {
      console.error("Database not configured, skipping usage tracking");
      return;
    }
    await db.insert(usageEvents).values(event);
  } catch (error) {
    // Log but don't fail the tool call - tracking is non-critical
    console.error("Failed to track usage:", error);
  }
}

export type { NewUsageEvent };
