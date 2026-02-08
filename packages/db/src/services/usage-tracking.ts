import { db } from "../client";
import { usageEvents, skills } from "../schema";
import { eq } from "drizzle-orm";

export interface TrackingEventInput {
  tenantId: string;
  userId: string;
  skillId: string;
  toolName: string;
  clientTimestamp?: string; // ISO string from hook
  hookEvent?: string; // e.g., "PostToolUse"
  metadata?: Record<string, unknown>;
}

/**
 * Insert an enriched usage event from a hook callback.
 * Fire-and-forget safe: catches all errors and logs them.
 * Never throws.
 */
export async function insertTrackingEvent(input: TrackingEventInput): Promise<void> {
  if (!db) return;

  try {
    // Resolve skill name from skillId (don't fail if not found)
    const skill = await db.query.skills.findFirst({
      columns: { name: true },
      where: eq(skills.id, input.skillId),
    });
    const skillName = skill?.name;

    await db.insert(usageEvents).values({
      tenantId: input.tenantId,
      toolName: input.toolName,
      skillId: input.skillId,
      userId: input.userId,
      metadata: {
        ...input.metadata,
        skillName,
        clientTimestamp: input.clientTimestamp,
        hookEvent: input.hookEvent,
        source: "hook",
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to insert tracking event:", error);
  }
}
