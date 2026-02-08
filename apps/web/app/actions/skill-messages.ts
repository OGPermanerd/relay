"use server";

import { auth } from "@/auth";
import {
  sendSkillMessage,
  getMessagesForUser,
  markMessageRead,
} from "@everyskill/db/services/skill-messages";

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
    const id = await sendSkillMessage({
      tenantId: DEFAULT_TENANT_ID,
      fromUserId: session.user.id,
      toUserId,
      subjectSkillId,
      proposedParentSkillId: proposedParentSkillId || undefined,
      message: message.trim(),
    });

    return id ? { success: true } : { error: "Failed to send message" };
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
