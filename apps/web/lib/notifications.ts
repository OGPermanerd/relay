import { createNotification } from "@everyskill/db";
import { getOrCreatePreferences } from "@everyskill/db";
import { sendEmail } from "@/lib/email";
import { render } from "@react-email/render";
import GroupingProposalEmail from "@/emails/grouping-proposal";

/**
 * Dispatch notifications for a grouping proposal.
 * Creates in-app notification and sends email based on user preferences.
 * Fire-and-forget: logs errors but never throws.
 */
export async function notifyGroupingProposal(params: {
  tenantId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  proposerName: string;
  skillName: string;
  parentSkillName: string;
  message: string;
}): Promise<void> {
  try {
    // Load recipient notification preferences (creates defaults if none exist)
    const preferences = await getOrCreatePreferences(params.recipientId, params.tenantId);

    // In-app notification (default: enabled)
    if (preferences?.groupingProposalInApp !== false) {
      await createNotification({
        tenantId: params.tenantId,
        userId: params.recipientId,
        type: "grouping_proposal",
        title: "Skill Grouping Request",
        message: `${params.proposerName} wants to group "${params.skillName}" under "${params.parentSkillName}"`,
        actionUrl: "/messages",
        metadata: {
          skillName: params.skillName,
          parentSkillName: params.parentSkillName,
          proposerName: params.proposerName,
        },
      });
    }

    // Email notification (default: enabled)
    if (preferences?.groupingProposalEmail !== false) {
      const html = await render(
        GroupingProposalEmail({
          recipientName: params.recipientName || "there",
          proposerName: params.proposerName,
          skillName: params.skillName,
          parentSkillName: params.parentSkillName,
          message: params.message,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:2000"}/messages`,
        })
      );

      await sendEmail({
        to: params.recipientEmail,
        subject: `${params.proposerName} wants to group a skill under yours`,
        html,
      });
    }
  } catch (error) {
    // Fire-and-forget: log but never throw
    console.error("[NOTIFICATION ERROR] Failed to dispatch grouping proposal notification:", error);
  }
}
