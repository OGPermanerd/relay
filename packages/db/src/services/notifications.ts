import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../client";
import { notifications } from "../schema/notifications";

/**
 * Parameters for creating a new notification
 */
export interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type:
    | "grouping_proposal"
    | "trending_digest"
    | "platform_update"
    | "review_submitted"
    | "review_approved"
    | "review_rejected"
    | "review_changes_requested"
    | "review_published"
    | "skill_rated";
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user.
 * Returns the inserted row, or null if DB is not configured.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<typeof notifications.$inferSelect | null> {
  if (!db) return null;
  const [row] = await db
    .insert(notifications)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    })
    .returning();
  return row ?? null;
}

/**
 * Get notifications for a user, ordered by most recent first.
 * Supports pagination via limit and offset.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0
): Promise<(typeof notifications.$inferSelect)[]> {
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get count of unread notifications for a user.
 * Uses the composite (userId, isRead) index for efficiency.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!db) return 0;
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.value ?? 0;
}

/**
 * Mark a single notification as read by setting isRead=true and readAt timestamp.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
