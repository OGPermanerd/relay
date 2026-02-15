"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { sanitizePayload } from "@/lib/sanitize-payload";
import { db, skillFeedback, skills } from "@everyskill/db";
import {
  createSuggestion,
  updateSuggestionStatus as dbUpdateSuggestionStatus,
  replySuggestion as dbReplySuggestion,
} from "@everyskill/db/services/skill-feedback";
import { createNotification } from "@everyskill/db/services/notifications";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ---------------------------------------------------------------------------
// State types (exported directly, NOT re-exported from "use server" files)
// ---------------------------------------------------------------------------

export type SuggestionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export type StatusUpdateState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export type ReplyState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const submitSuggestionSchema = z.object({
  skillId: z.string().min(1, "Skill ID is required"),
  skillSlug: z.string().min(1, "Skill slug is required"),
  category: z.enum(["output_quality", "missing_feature", "error", "performance", "other"], {
    errorMap: () => ({ message: "Please select a category" }),
  }),
  severity: z.enum(["nice_to_have", "important", "critical"], {
    errorMap: () => ({ message: "Please select a severity level" }),
  }),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(2000, "Comment must be 2000 characters or less"),
  suggestedContent: z
    .string()
    .max(5000, "Suggested content must be 5000 characters or less")
    .optional()
    .transform((val) => val || undefined),
});

const updateStatusSchema = z.object({
  feedbackId: z.string().min(1, "Feedback ID is required"),
  skillSlug: z.string().min(1, "Skill slug is required"),
  newStatus: z.enum(["accepted", "dismissed", "implemented", "pending"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
});

const replySchema = z.object({
  feedbackId: z.string().min(1, "Feedback ID is required"),
  skillSlug: z.string().min(1, "Skill slug is required"),
  reviewNotes: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(2000, "Reply must be 2000 characters or less"),
});

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

/**
 * Submit a new suggestion on a skill.
 */
export async function submitSuggestion(
  prevState: SuggestionState,
  formData: FormData
): Promise<SuggestionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to submit a suggestion" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { message: "Tenant not resolved" };
  }

  const parsed = submitSuggestionSchema.safeParse({
    skillId: formData.get("skillId"),
    skillSlug: formData.get("skillSlug"),
    category: formData.get("category"),
    severity: formData.get("severity"),
    comment: formData.get("comment"),
    suggestedContent: formData.get("suggestedContent"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { skillId, skillSlug, category, severity, comment, suggestedContent } = parsed.data;

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  try {
    // Sanitize user text
    const sanitizedComment = sanitizePayload(comment).sanitized;
    const sanitizedContent = suggestedContent
      ? sanitizePayload(suggestedContent).sanitized
      : undefined;

    await createSuggestion({
      tenantId,
      skillId,
      userId: session.user.id,
      category,
      severity,
      comment: sanitizedComment,
      suggestedContent: sanitizedContent,
    });

    // Notify skill author (fire-and-forget)
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, skillId),
      columns: { authorId: true, name: true },
    });

    if (skill?.authorId && skill.authorId !== session.user.id) {
      const submitterName = session.user.name || "Someone";
      const severityLabel = severity.replace(/_/g, " ");
      const commentExcerpt =
        sanitizedComment.length > 100 ? sanitizedComment.slice(0, 100) + "..." : sanitizedComment;

      createNotification({
        tenantId,
        userId: skill.authorId,
        type: "suggestion_received",
        title: `New suggestion on ${skill.name}`,
        message: `${submitterName} submitted a ${severityLabel} suggestion: "${commentExcerpt}"`,
        actionUrl: `/skills/${skillSlug}`,
      }).catch(() => {
        // Swallow notification errors -- suggestion already saved
      });
    }

    revalidatePath(`/skills/${skillSlug}`);

    return { success: true, message: "Suggestion submitted" };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to submit suggestion:", error);
    }
    return { message: "Failed to submit suggestion. Please try again." };
  }
}

/**
 * Update the status of a suggestion (accept, dismiss, implement, reopen).
 * Only the skill author or an admin can do this.
 */
export async function updateSuggestionStatus(
  prevState: StatusUpdateState,
  formData: FormData
): Promise<StatusUpdateState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to update suggestion status" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { message: "Tenant not resolved" };
  }

  const parsed = updateStatusSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    skillSlug: formData.get("skillSlug"),
    newStatus: formData.get("newStatus"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { feedbackId, skillSlug, newStatus } = parsed.data;

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  try {
    // Get the suggestion to find the suggester and skill
    const suggestion = await db.query.skillFeedback.findFirst({
      where: eq(skillFeedback.id, feedbackId),
      columns: { userId: true, skillId: true },
    });

    if (!suggestion) {
      return { message: "Suggestion not found" };
    }

    // Verify current user is the skill author or admin
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, suggestion.skillId),
      columns: { authorId: true, name: true },
    });

    if (!skill) {
      return { message: "Skill not found" };
    }

    if (skill.authorId !== session.user.id && !isAdmin(session)) {
      return { message: "Only the skill author or an admin can update suggestion status" };
    }

    const result = await dbUpdateSuggestionStatus({
      id: feedbackId,
      status: newStatus,
      reviewerId: session.user.id,
    });

    if (!result.success) {
      return { message: result.error || "Failed to update status" };
    }

    // Notify the suggester (fire-and-forget)
    if (suggestion.userId && suggestion.userId !== session.user.id) {
      const statusLabels: Record<string, string> = {
        accepted: "accepted",
        dismissed: "dismissed",
        implemented: "implemented",
        pending: "reopened",
      };
      const statusLabel = statusLabels[newStatus] || newStatus;

      createNotification({
        tenantId,
        userId: suggestion.userId,
        type: "suggestion_status_changed",
        title: `Your suggestion was ${statusLabel}`,
        message: `Your suggestion on ${skill.name} has been ${statusLabel}`,
        actionUrl: `/skills/${skillSlug}`,
      }).catch(() => {
        // Swallow notification errors
      });
    }

    revalidatePath(`/skills/${skillSlug}`);

    return { success: true, message: `Suggestion ${newStatus}` };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to update suggestion status:", error);
    }
    return { message: "Failed to update suggestion status. Please try again." };
  }
}

/**
 * Reply to a suggestion (add reviewNotes) without changing status.
 * Only the skill author can reply.
 */
export async function replySuggestion(
  prevState: ReplyState,
  formData: FormData
): Promise<ReplyState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to reply" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { message: "Tenant not resolved" };
  }

  const parsed = replySchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    skillSlug: formData.get("skillSlug"),
    reviewNotes: formData.get("reviewNotes"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { feedbackId, skillSlug, reviewNotes } = parsed.data;

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  try {
    // Get the suggestion to find the suggester and skill
    const suggestion = await db.query.skillFeedback.findFirst({
      where: eq(skillFeedback.id, feedbackId),
      columns: { userId: true, skillId: true },
    });

    if (!suggestion) {
      return { message: "Suggestion not found" };
    }

    // Verify current user is the skill author
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, suggestion.skillId),
      columns: { authorId: true, name: true },
    });

    if (!skill) {
      return { message: "Skill not found" };
    }

    if (skill.authorId !== session.user.id) {
      return { message: "Only the skill author can reply to suggestions" };
    }

    // Sanitize reply text
    const sanitizedNotes = sanitizePayload(reviewNotes).sanitized;

    await dbReplySuggestion({
      id: feedbackId,
      reviewNotes: sanitizedNotes,
      reviewerId: session.user.id,
    });

    // Notify the suggester (fire-and-forget)
    if (suggestion.userId && suggestion.userId !== session.user.id) {
      createNotification({
        tenantId,
        userId: suggestion.userId,
        type: "suggestion_status_changed",
        title: "Author replied to your suggestion",
        message: `The author of ${skill.name} replied to your suggestion`,
        actionUrl: `/skills/${skillSlug}`,
      }).catch(() => {
        // Swallow notification errors
      });
    }

    revalidatePath(`/skills/${skillSlug}`);

    return { success: true, message: "Reply sent" };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to reply to suggestion:", error);
    }
    return { message: "Failed to send reply. Please try again." };
  }
}
