import { db } from "../client";
import { usageEvents, skills, users } from "../schema";
import { eq, and, sql, gte } from "drizzle-orm";

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

export interface HookComplianceUser {
  userId: string;
  userName: string | null;
  userEmail: string;
  isCompliant: boolean;
  lastHookEvent: string | null; // ISO string
  hookEventCount: number;
}

/**
 * Get hook compliance status for all users in a tenant.
 * A user is "compliant" if they have at least one usage_event
 * with metadata->>'source' = 'hook' in the last 30 days.
 */
export async function getHookComplianceStatus(tenantId: string): Promise<HookComplianceUser[]> {
  if (!db) return [];

  try {
    // Get all users in the tenant
    const tenantUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    if (tenantUsers.length === 0) return [];

    // Get hook event stats per user in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const hookStats = await db
      .select({
        userId: usageEvents.userId,
        eventCount: sql<number>`count(*)::int`.as("event_count"),
        lastEvent: sql<string>`max(${usageEvents.createdAt})::text`.as("last_event"),
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.tenantId, tenantId),
          sql`${usageEvents.metadata}->>'source' = 'hook'`,
          gte(usageEvents.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(usageEvents.userId);

    // Build a lookup map of userId -> stats
    const statsMap = new Map(
      hookStats.map((s) => [s.userId, { count: s.eventCount, lastEvent: s.lastEvent }])
    );

    // Merge users with their hook stats
    return tenantUsers.map((u) => {
      const stats = statsMap.get(u.id);
      return {
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        isCompliant: !!stats && stats.count > 0,
        lastHookEvent: stats?.lastEvent ?? null,
        hookEventCount: stats?.count ?? 0,
      };
    });
  } catch (error) {
    console.error("Failed to get hook compliance status:", error);
    return [];
  }
}
