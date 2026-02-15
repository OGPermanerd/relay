"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { sanitizePayload } from "@/lib/sanitize-payload";
import { hashContent } from "@/lib/content-hash";
import { generateUniqueSlug } from "@/lib/slug";
import { generateSkillEmbedding } from "@/lib/embedding-generator";
import { buildEverySkillFrontmatter, stripEverySkillFrontmatter } from "@/lib/frontmatter";
import { db, skillFeedback, skills } from "@everyskill/db";
import { skillVersions } from "@everyskill/db/schema/skill-versions";
import {
  createSuggestion,
  createTrainingExample,
  updateSuggestionStatus as dbUpdateSuggestionStatus,
  replySuggestion as dbReplySuggestion,
} from "@everyskill/db/services/skill-feedback";
import { createNotification } from "@everyskill/db/services/notifications";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export type TrainingExampleState = {
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

const submitTrainingExampleSchema = z.object({
  skillId: z.string().min(1, "Skill ID is required"),
  skillSlug: z.string().min(1, "Skill slug is required"),
  exampleInput: z
    .string()
    .min(1, "Input example is required")
    .max(5000, "Input must be 5000 characters or less"),
  exampleOutput: z
    .string()
    .min(1, "Expected output is required")
    .max(5000, "Output must be 5000 characters or less"),
  qualityScore: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

// ---------------------------------------------------------------------------
// Training example submission
// ---------------------------------------------------------------------------

/**
 * Submit a new training example (golden example) for a skill.
 * Only the skill author can add training examples.
 */
export async function submitTrainingExample(
  prevState: TrainingExampleState,
  formData: FormData
): Promise<TrainingExampleState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to add a training example" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { message: "Tenant not resolved" };
  }

  const parsed = submitTrainingExampleSchema.safeParse({
    skillId: formData.get("skillId"),
    skillSlug: formData.get("skillSlug"),
    exampleInput: formData.get("exampleInput"),
    exampleOutput: formData.get("exampleOutput"),
    qualityScore: formData.get("qualityScore"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { skillId, skillSlug, exampleInput, exampleOutput, qualityScore } = parsed.data;

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  try {
    // Verify current user is the skill author
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, skillId),
      columns: { authorId: true },
    });

    if (!skill) {
      return { message: "Skill not found" };
    }

    if (skill.authorId !== session.user.id) {
      return { message: "Only the skill author can add training examples" };
    }

    // Sanitize user text
    const sanitizedInput = sanitizePayload(exampleInput).sanitized;
    const sanitizedOutput = sanitizePayload(exampleOutput).sanitized;

    await createTrainingExample({
      tenantId,
      skillId,
      userId: session.user.id,
      exampleInput: sanitizedInput,
      exampleOutput: sanitizedOutput,
      qualityScore: qualityScore ?? null,
      source: "web",
      status: "approved",
    });

    revalidatePath(`/skills/${skillSlug}`);

    return { success: true, message: "Training example added" };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to add training example:", error);
    }
    return { message: "Failed to add training example. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Suggestion-to-Fork Pipeline Actions
// ---------------------------------------------------------------------------

/**
 * Accept a suggestion and create a fork pre-populated with the suggestion content.
 * Called directly via async handler (not useActionState form action).
 * Redirects to the new fork with ?improve=1.
 */
export async function acceptAndForkSuggestion(feedbackId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  // Fetch the suggestion
  const suggestion = await db.query.skillFeedback.findFirst({
    where: eq(skillFeedback.id, feedbackId),
    columns: {
      id: true,
      skillId: true,
      suggestedContent: true,
      comment: true,
      status: true,
      feedbackType: true,
    },
  });

  if (!suggestion) {
    return { error: "Suggestion not found" };
  }

  if (suggestion.feedbackType !== "suggestion") {
    return { error: "Feedback item is not a suggestion" };
  }

  if (suggestion.status !== "pending" && suggestion.status !== "accepted") {
    return { error: `Cannot fork from a ${suggestion.status} suggestion` };
  }

  // Fetch the parent skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, suggestion.skillId),
    columns: {
      id: true,
      name: true,
      description: true,
      category: true,
      content: true,
      tags: true,
      visibility: true,
      authorId: true,
      hoursSaved: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Only skill author or admin can accept and fork
  if (skill.authorId !== session.user.id && !isAdmin(session)) {
    return { error: "Only the skill author or an admin can accept and fork" };
  }

  // Strip frontmatter from parent content
  const frontmatterMatch = skill.content.match(/^---\n[\s\S]*?\n---\n/);
  const strippedParentBody = frontmatterMatch
    ? skill.content.slice(frontmatterMatch[0].length)
    : skill.content;

  // Determine fork content: use suggestion content if available, otherwise parent body
  const forkBody =
    suggestion.suggestedContent && suggestion.suggestedContent.trim()
      ? stripEverySkillFrontmatter(suggestion.suggestedContent)
      : strippedParentBody;

  const forkName = `${skill.name} (Fork)`;
  const slug = await generateUniqueSlug(forkName, db);

  // Compute forkedAtContentHash from stripped parent body for drift detection
  const forkedAtContentHash = await hashContent(strippedParentBody);

  // Insert new skill
  let newSkillId: string;
  let newSkillSlug: string;
  try {
    const [inserted] = await db
      .insert(skills)
      .values({
        tenantId,
        name: forkName,
        slug,
        description: skill.description,
        category: skill.category,
        content: forkBody,
        tags: skill.tags,
        hoursSaved: skill.hoursSaved || 0,
        forkedFromId: skill.id,
        forkedAtContentHash,
        authorId: session.user.id,
        status: "draft",
        visibility: "personal",
      })
      .returning({ id: skills.id, slug: skills.slug });

    newSkillId = inserted.id;
    newSkillSlug = inserted.slug;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to create fork from suggestion:", error);
    }
    return { error: "Failed to create fork. Please try again." };
  }

  // Create skill_versions record
  try {
    const contentHash = await hashContent(forkBody);
    const [version] = await db
      .insert(skillVersions)
      .values({
        tenantId,
        skillId: newSkillId,
        version: 1,
        contentUrl: "",
        contentHash,
        contentType: "text/markdown",
        name: forkName,
        description: skill.description,
        createdBy: session.user.id,
      })
      .returning({ id: skillVersions.id });

    await db
      .update(skills)
      .set({ publishedVersionId: version.id })
      .where(eq(skills.id, newSkillId));
  } catch (versionError) {
    // Non-fatal: fork is still usable without version record
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to create version record for fork:", versionError);
    }
  }

  // Link suggestion to fork: set implementedBySkillId and accept
  await db
    .update(skillFeedback)
    .set({
      implementedBySkillId: newSkillId,
      status: "accepted",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    })
    .where(eq(skillFeedback.id, feedbackId));

  // Fire-and-forget: generate embedding for the fork
  generateSkillEmbedding(newSkillId, forkName, skill.description, tenantId).catch(() => {});

  revalidatePath("/skills");
  revalidatePath(`/skills/${newSkillSlug}`);

  // redirect() throws a special Next.js error -- MUST be outside try/catch
  redirect(`/skills/${newSkillSlug}?improve=1`);
}

/**
 * Apply a suggestion's content inline to the original skill and create a version record.
 * Called directly via async handler (not useActionState form action).
 */
export async function applyInlineSuggestion(
  feedbackId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  // Fetch the suggestion
  const suggestion = await db.query.skillFeedback.findFirst({
    where: eq(skillFeedback.id, feedbackId),
    columns: {
      id: true,
      skillId: true,
      suggestedContent: true,
      status: true,
      feedbackType: true,
    },
  });

  if (!suggestion) {
    return { error: "Suggestion not found" };
  }

  if (suggestion.feedbackType !== "suggestion") {
    return { error: "Feedback item is not a suggestion" };
  }

  if (suggestion.status !== "pending" && suggestion.status !== "accepted") {
    return { error: `Cannot apply a ${suggestion.status} suggestion` };
  }

  if (!suggestion.suggestedContent || !suggestion.suggestedContent.trim()) {
    return { error: "Suggestion has no content to apply" };
  }

  // Fetch the skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, suggestion.skillId),
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      hoursSaved: true,
      authorId: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Only skill author or admin can apply inline
  if (skill.authorId !== session.user.id && !isAdmin(session)) {
    return { error: "Only the skill author or an admin can apply suggestions" };
  }

  try {
    // Strip any frontmatter from the suggested content
    const strippedSuggestedContent = stripEverySkillFrontmatter(suggestion.suggestedContent);

    // Rebuild full content with proper frontmatter
    const fullContent =
      buildEverySkillFrontmatter({
        skillId: skill.id,
        name: skill.name,
        category: skill.category,
        hoursSaved: skill.hoursSaved || 0,
      }) + strippedSuggestedContent;

    // Update skill content
    await db
      .update(skills)
      .set({ content: fullContent, updatedAt: new Date() })
      .where(eq(skills.id, skill.id));

    // Compute content hash
    const contentHash = await hashContent(fullContent);

    // Get max version number
    const [maxResult] = await db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${skillVersions.version}), 0)::int`,
      })
      .from(skillVersions)
      .where(eq(skillVersions.skillId, skill.id));

    const nextVersion = (maxResult?.maxVersion ?? 0) + 1;

    // Insert new version record
    const [version] = await db
      .insert(skillVersions)
      .values({
        tenantId,
        skillId: skill.id,
        version: nextVersion,
        contentUrl: "",
        contentHash,
        contentType: "text/markdown",
        name: skill.name,
        description: skill.description,
        createdBy: session.user.id,
      })
      .returning({ id: skillVersions.id });

    // Update skill's published version
    await db.update(skills).set({ publishedVersionId: version.id }).where(eq(skills.id, skill.id));

    // Mark suggestion as implemented and link to skill
    await db
      .update(skillFeedback)
      .set({
        status: "implemented",
        implementedBySkillId: skill.id,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      })
      .where(eq(skillFeedback.id, feedbackId));

    revalidatePath(`/skills/${skill.slug}`);

    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to apply inline suggestion:", error);
    }
    return { error: "Failed to apply suggestion. Please try again." };
  }
}
