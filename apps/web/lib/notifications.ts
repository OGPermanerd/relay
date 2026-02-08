import { createNotification } from "@everyskill/db";
import { getOrCreatePreferences } from "@everyskill/db";
import { sendEmail } from "@/lib/email";
import { render } from "@react-email/render";
import GroupingProposalEmail from "@/emails/grouping-proposal";
import ReviewNotificationEmail from "@/emails/review-notification";

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

// --- Review notification helpers ---

const REVIEW_TITLES: Record<string, string> = {
  review_submitted: "Skill Submitted for Review",
  review_approved: "Skill Approved",
  review_rejected: "Skill Rejected",
  review_changes_requested: "Changes Requested",
  review_published: "Skill Published",
};

function buildReviewMessage(type: string, skillName: string, reviewerName?: string): string {
  switch (type) {
    case "review_submitted":
      return `"${skillName}" has been submitted for review${reviewerName ? ` by ${reviewerName}` : ""}`;
    case "review_approved":
      return `Your skill "${skillName}" has been approved${reviewerName ? ` by ${reviewerName}` : ""}`;
    case "review_rejected":
      return `Your skill "${skillName}" has been rejected${reviewerName ? ` by ${reviewerName}` : ""}`;
    case "review_changes_requested":
      return `Changes requested on your skill "${skillName}"${reviewerName ? ` by ${reviewerName}` : ""}`;
    case "review_published":
      return `Your skill "${skillName}" is now published`;
    default:
      return `Update on "${skillName}"`;
  }
}

function buildReviewActionUrl(type: string, skillSlug: string): string {
  switch (type) {
    case "review_submitted":
      return "/admin/reviews";
    case "review_approved":
    case "review_published":
      return `/skills/${skillSlug}`;
    case "review_rejected":
    case "review_changes_requested":
      return "/my-skills";
    default:
      return "/";
  }
}

/**
 * Dispatch notifications for review events.
 * Creates in-app notification and sends email based on user preferences.
 * Fire-and-forget: logs errors but never throws.
 */
export async function notifyReviewEvent(params: {
  tenantId: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  type:
    | "review_submitted"
    | "review_approved"
    | "review_rejected"
    | "review_changes_requested"
    | "review_published";
  skillName: string;
  skillSlug: string;
  notes?: string;
  reviewerName?: string;
}): Promise<void> {
  try {
    const preferences = await getOrCreatePreferences(params.recipientId, params.tenantId);

    // In-app notification (respects single toggle for all review types per RVNT-06)
    if (preferences?.reviewNotificationsInApp !== false) {
      await createNotification({
        tenantId: params.tenantId,
        userId: params.recipientId,
        type: params.type,
        title: REVIEW_TITLES[params.type] || "Review Update",
        message: buildReviewMessage(params.type, params.skillName, params.reviewerName),
        actionUrl: buildReviewActionUrl(params.type, params.skillSlug),
        metadata: { skillName: params.skillName, notes: params.notes },
      });
    }

    // Email notification (respects single toggle per RVNT-06)
    if (preferences?.reviewNotificationsEmail !== false) {
      const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:2000"}${buildReviewActionUrl(params.type, params.skillSlug)}`;
      const html = await render(
        ReviewNotificationEmail({
          recipientName: params.recipientName || "there",
          type: params.type,
          skillName: params.skillName,
          notes: params.notes,
          reviewerName: params.reviewerName,
          actionUrl,
        })
      );

      await sendEmail({
        to: params.recipientEmail,
        subject: REVIEW_TITLES[params.type] || "Review Update",
        html,
      });
    }
  } catch (error) {
    // Fire-and-forget: log but never throw
    console.error("[NOTIFICATION ERROR] Failed to dispatch review notification:", error);
  }
}
