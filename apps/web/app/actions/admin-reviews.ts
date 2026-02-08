"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills, users, reviewDecisions } from "@everyskill/db";
import { canTransition, type SkillStatus } from "@everyskill/db/services/skill-status";
import { getSkillReview } from "@everyskill/db/services/skill-reviews";
import { notifyReviewEvent } from "@/lib/notifications";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// =============================================================================
// Types
// =============================================================================

export type ActionResult = { success?: boolean; error?: string };

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Approve a skill and publish it.
 *
 * Transitions: ai_reviewed -> approved -> published (in a single transaction).
 * Writes an immutable review_decisions record for SOC2 audit trail.
 */
export async function approveSkillAction(skillId: string, notes?: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  if (!db) {
    return { error: "Database not configured" };
  }

  const reviewerId = session.user.id;

  // Fetch skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      status: true,
      tenantId: true,
      content: true,
      authorId: true,
      name: true,
      slug: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  const currentStatus = skill.status as SkillStatus;
  if (!canTransition(currentStatus, "approved")) {
    return { error: `Cannot approve from status '${skill.status}'` };
  }

  // Fetch AI review snapshot for decision record
  const aiReview = await getSkillReview(skillId);
  const aiScoresSnapshot = aiReview?.categories ?? null;

  // Transaction: insert decision record, then approve + publish
  await db.transaction(async (tx) => {
    // (a) Insert immutable review decision record
    await tx.insert(reviewDecisions).values({
      tenantId: skill.tenantId,
      skillId: skill.id,
      reviewerId,
      action: "approved",
      notes: notes ?? null,
      aiScoresSnapshot,
      previousContent: skill.content,
    });

    // (b) Transition to approved
    await tx
      .update(skills)
      .set({ status: "approved", statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    // (c) Transition to published
    await tx
      .update(skills)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  });

  // Fetch author info for notification
  if (skill.authorId) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, skill.authorId),
      columns: { id: true, email: true, name: true },
    });
    if (author) {
      // RVNT-05 only: author is notified of publication (approval is implicit)
      // Do NOT send separate RVNT-02 (approved) to avoid double notification
      notifyReviewEvent({
        tenantId: skill.tenantId,
        recipientId: author.id,
        recipientEmail: author.email,
        recipientName: author.name || "there",
        type: "review_published",
        skillName: skill.name,
        skillSlug: skill.slug ?? skillId,
        notes: notes || undefined,
        reviewerName: session.user.name || "Admin",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Reject a skill.
 *
 * Requires non-empty notes explaining the rejection reason.
 * Writes an immutable review_decisions record for SOC2 audit trail.
 */
export async function rejectSkillAction(skillId: string, notes: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  if (!db) {
    return { error: "Database not configured" };
  }

  const reviewerId = session.user.id;

  // Validate notes
  const notesResult = z.string().min(1, "Rejection reason is required").safeParse(notes);
  if (!notesResult.success) {
    return { error: notesResult.error.errors[0].message };
  }

  // Fetch skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      status: true,
      tenantId: true,
      content: true,
      authorId: true,
      name: true,
      slug: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  const currentStatus = skill.status as SkillStatus;
  if (!canTransition(currentStatus, "rejected")) {
    return { error: `Cannot reject from status '${skill.status}'` };
  }

  // Fetch AI review snapshot for decision record
  const aiReview = await getSkillReview(skillId);
  const aiScoresSnapshot = aiReview?.categories ?? null;

  // Transaction: insert decision record, then reject
  await db.transaction(async (tx) => {
    // (a) Insert immutable review decision record
    await tx.insert(reviewDecisions).values({
      tenantId: skill.tenantId,
      skillId: skill.id,
      reviewerId,
      action: "rejected",
      notes: notesResult.data,
      aiScoresSnapshot,
      previousContent: skill.content,
    });

    // (b) Transition to rejected with status message
    await tx
      .update(skills)
      .set({
        status: "rejected",
        statusMessage: `Rejected: ${notesResult.data}`,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, skillId));
  });

  // Fetch author info for notification
  if (skill.authorId) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, skill.authorId),
      columns: { id: true, email: true, name: true },
    });
    if (author) {
      // RVNT-03: Notify author of rejection with reason
      notifyReviewEvent({
        tenantId: skill.tenantId,
        recipientId: author.id,
        recipientEmail: author.email,
        recipientName: author.name || "there",
        type: "review_rejected",
        skillName: skill.name,
        skillSlug: skill.slug ?? skillId,
        notes: notesResult.data,
        reviewerName: session.user.name || "Admin",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Request changes on a skill.
 *
 * Requires non-empty notes describing what changes are needed.
 * Writes an immutable review_decisions record for SOC2 audit trail.
 */
export async function requestChangesAction(skillId: string, notes: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  if (!db) {
    return { error: "Database not configured" };
  }

  const reviewerId = session.user.id;

  // Validate notes
  const notesResult = z.string().min(1, "Feedback is required").safeParse(notes);
  if (!notesResult.success) {
    return { error: notesResult.error.errors[0].message };
  }

  // Fetch skill
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      status: true,
      tenantId: true,
      content: true,
      authorId: true,
      name: true,
      slug: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  const currentStatus = skill.status as SkillStatus;
  if (!canTransition(currentStatus, "changes_requested")) {
    return { error: `Cannot request changes from status '${skill.status}'` };
  }

  // Fetch AI review snapshot for decision record
  const aiReview = await getSkillReview(skillId);
  const aiScoresSnapshot = aiReview?.categories ?? null;

  // Transaction: insert decision record, then request changes
  await db.transaction(async (tx) => {
    // (a) Insert immutable review decision record
    await tx.insert(reviewDecisions).values({
      tenantId: skill.tenantId,
      skillId: skill.id,
      reviewerId,
      action: "changes_requested",
      notes: notesResult.data,
      aiScoresSnapshot,
      previousContent: skill.content,
    });

    // (b) Transition to changes_requested with feedback as status message
    await tx
      .update(skills)
      .set({
        status: "changes_requested",
        statusMessage: notesResult.data,
        updatedAt: new Date(),
      })
      .where(eq(skills.id, skillId));
  });

  // Fetch author info for notification
  if (skill.authorId) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, skill.authorId),
      columns: { id: true, email: true, name: true },
    });
    if (author) {
      // RVNT-04: Notify author that changes are requested
      notifyReviewEvent({
        tenantId: skill.tenantId,
        recipientId: author.id,
        recipientEmail: author.email,
        recipientName: author.name || "there",
        type: "review_changes_requested",
        skillName: skill.name,
        skillSlug: skill.slug ?? skillId,
        notes: notesResult.data,
        reviewerName: session.user.name || "Admin",
      }).catch(() => {});
    }
  }

  revalidatePath("/admin");
  return { success: true };
}
