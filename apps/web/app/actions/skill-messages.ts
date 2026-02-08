"use server";

import { auth } from "@/auth";
import {
  sendSkillMessage,
  getMessagesForUser,
  markMessageRead,
} from "@everyskill/db/services/skill-messages";
import { db, users, skills } from "@everyskill/db";
import { eq } from "drizzle-orm";
import { notifyGroupingProposal } from "@/lib/notifications";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export type MessageState = { error?: string; success?: boolean };

export async function sendGroupingProposal(
  prevState: MessageState,
  formData: FormData
): Promise<MessageState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const toUserId = formData.get("toUserId") as string;
  const subjectSkillId = formData.get("subjectSkillId") as string;
  const proposedParentSkillId = formData.get("proposedParentSkillId") as string;
  const message = formData.get("message") as string;

  if (!toUserId || !subjectSkillId || !message?.trim()) return { error: "Missing required fields" };
  if (message.length > 1000) return { error: "Message too long (max 1000 chars)" };

  try {
    const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;

    const id = await sendSkillMessage({
      tenantId,
      fromUserId: session.user.id,
      toUserId,
      subjectSkillId,
      proposedParentSkillId: proposedParentSkillId || undefined,
      message: message.trim(),
    });

    if (!id) return { error: "Failed to send message" };

    // Fire-and-forget notification dispatch
    try {
      const [recipient] = db
        ? await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, toUserId))
            .limit(1)
        : [];

      const [subjectSkill] = db
        ? await db
            .select({ name: skills.name })
            .from(skills)
            .where(eq(skills.id, subjectSkillId))
            .limit(1)
        : [];

      const [parentSkill] =
        proposedParentSkillId && db
          ? await db
              .select({ name: skills.name })
              .from(skills)
              .where(eq(skills.id, proposedParentSkillId))
              .limit(1)
          : [];

      if (recipient?.email) {
        await notifyGroupingProposal({
          tenantId,
          recipientId: toUserId,
          recipientEmail: recipient.email,
          recipientName: recipient.name || recipient.email,
          proposerName: session.user.name || session.user.email || "Someone",
          skillName: subjectSkill?.name || "a skill",
          parentSkillName: parentSkill?.name || "another skill",
          message: message.trim(),
        });
      }
    } catch (notifyError) {
      // Notification failure should not break the message flow
      console.error(
        "[NOTIFICATION] Failed to dispatch grouping proposal notification:",
        notifyError
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send grouping proposal:", error);
    return { error: "Failed to send message" };
  }
}

export async function getMyMessages() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return getMessagesForUser(session.user.id);
}

export async function markAsRead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const messageId = formData.get("messageId") as string;
  if (messageId) await markMessageRead(messageId);
}
