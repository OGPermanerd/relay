import { eq } from "drizzle-orm";
import { db } from "../client";
import { notificationPreferences } from "../schema/notification-preferences";

/**
 * Get notification preferences for a user, creating defaults if none exist.
 * Uses ON CONFLICT DO NOTHING to handle concurrent inserts safely.
 * Returns null if DB is not configured.
 */
export async function getOrCreatePreferences(
  userId: string,
  tenantId: string
): Promise<typeof notificationPreferences.$inferSelect | null> {
  if (!db) return null;

  // Try to find existing preferences
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  if (existing) return existing;

  // Insert defaults, ON CONFLICT DO NOTHING for race condition safety
  await db
    .insert(notificationPreferences)
    .values({ userId, tenantId })
    .onConflictDoNothing({ target: notificationPreferences.userId });

  // Re-fetch to get the full row (handles both insert and conflict cases)
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  return row ?? null;
}

/**
 * Update notification preferences for a user.
 * Only updates the fields provided in the updates object.
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<{
    groupingProposalEmail: boolean;
    groupingProposalInApp: boolean;
    trendingDigest: "none" | "daily" | "weekly";
    platformUpdatesEmail: boolean;
    platformUpdatesInApp: boolean;
    reviewNotificationsEmail: boolean;
    reviewNotificationsInApp: boolean;
  }>
): Promise<void> {
  if (!db) return;
  await db
    .update(notificationPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId));
}
