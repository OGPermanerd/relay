import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../client";
import { skillMessages } from "../schema";
import type { NewSkillMessage } from "../schema";

/**
 * Send a skill message (grouping proposal) from one user to another
 * Returns the new message ID, or null if DB is not configured
 */
export async function sendSkillMessage(
  data: Omit<NewSkillMessage, "id" | "createdAt" | "readAt" | "status">
): Promise<string | null> {
  if (!db) return null;
  const [row] = await db.insert(skillMessages).values(data).returning({ id: skillMessages.id });
  return row?.id ?? null;
}

/**
 * Get messages received by a user, ordered by most recent first
 * Limited to 50 messages
 */
export async function getMessagesForUser(
  userId: string
): Promise<(typeof skillMessages.$inferSelect)[]> {
  if (!db) return [];
  return db
    .select()
    .from(skillMessages)
    .where(eq(skillMessages.toUserId, userId))
    .orderBy(desc(skillMessages.createdAt))
    .limit(50);
}

/**
 * Get count of unread messages for a user
 */
export async function getUnreadCountForUser(userId: string): Promise<number> {
  if (!db) return 0;
  const results = await db
    .select({ id: skillMessages.id })
    .from(skillMessages)
    .where(and(eq(skillMessages.toUserId, userId), isNull(skillMessages.readAt)));
  return results.length;
}

/**
 * Mark a message as read by setting readAt timestamp
 */
export async function markMessageRead(messageId: string): Promise<void> {
  if (!db) return;
  await db.update(skillMessages).set({ readAt: new Date() }).where(eq(skillMessages.id, messageId));
}

/**
 * Update the status of a message (accepted or declined)
 */
export async function updateMessageStatus(
  messageId: string,
  status: "accepted" | "declined"
): Promise<void> {
  if (!db) return;
  await db.update(skillMessages).set({ status }).where(eq(skillMessages.id, messageId));
}
