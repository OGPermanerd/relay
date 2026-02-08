"use server";

import { auth } from "@/auth";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@everyskill/db/services/notifications";

/**
 * Get notifications for the current user.
 * Serializes dates to ISO strings to avoid hydration mismatches.
 */
export async function getMyNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await getUserNotifications(session.user.id, 20);
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    actionUrl: n.actionUrl,
    isRead: n.isRead,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    readAt: n.readAt instanceof Date ? n.readAt.toISOString() : (n.readAt ?? null),
  }));
}

/**
 * Get unread notification count for the current user.
 */
export async function getMyUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return getUnreadNotificationCount(session.user.id);
}

/**
 * Mark a single notification as read. Returns updated unread count.
 */
export async function markRead(notificationId: string): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  await markNotificationAsRead(notificationId);
  return getUnreadNotificationCount(session.user.id);
}

/**
 * Mark all notifications as read for the current user. Returns 0.
 */
export async function markAllRead(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  await markAllNotificationsAsRead(session.user.id);
  return 0;
}
