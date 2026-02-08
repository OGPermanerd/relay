"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { eq, and } from "drizzle-orm";
import {
  canTransition,
  checkAutoApprove,
  type SkillStatus,
} from "@everyskill/db/services/skill-status";
import { generateSkillReview, REVIEW_MODEL } from "@/lib/ai-review";
import { hashContent } from "@/lib/content-hash";
import { upsertSkillReview } from "@everyskill/db/services/skill-reviews";
import { notifyReviewEvent } from "@/lib/notifications";
import { getAdminsInTenant } from "@everyskill/db";
import { revalidatePath } from "next/cache";

export async function submitForReview(
  skillId: string
): Promise<{ success: true; autoApproved: boolean } | { success?: never; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }
  if (!db) return { error: "Database not configured" };

  // Fetch skill with fields needed for AI review
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.authorId, session.user.id)),
    columns: {
      id: true,
      status: true,
      name: true,
      description: true,
      content: true,
      category: true,
      slug: true,
    },
  });

  if (!skill) return { error: "Skill not found" };

  const currentStatus = skill.status as SkillStatus;

  // Allow retry: if already pending_review, skip transition and go straight to AI review
  if (currentStatus === "pending_review") {
    // Clear any previous error message on retry
    await db
      .update(skills)
      .set({ statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  } else if (canTransition(currentStatus, "pending_review")) {
    // Transition from draft or changes_requested to pending_review
    await db
      .update(skills)
      .set({ status: "pending_review", statusMessage: null, updatedAt: new Date() })
      .where(eq(skills.id, skillId));
  } else {
    return { error: `Cannot submit for review from status '${skill.status}'` };
  }

  // Run AI review inline (awaited, not fire-and-forget)
  try {
    const reviewResult = await generateSkillReview(
      skill.name,
      skill.description ?? "",
      skill.content,
      skill.category ?? "prompt"
    );

    // Store the review
    const contentHash = await hashContent(skill.content);
    await upsertSkillReview({
      skillId: skill.id,
      requestedBy: session.user.id,
      categories: reviewResult,
      summary: reviewResult.summary,
      suggestedDescription: reviewResult.suggestedDescription,
      reviewedContentHash: contentHash,
      modelName: REVIEW_MODEL,
    });

    // Check auto-approve
    const autoApproved = checkAutoApprove(reviewResult);

    if (autoApproved) {
      // Transition through full state machine: pending_review -> ai_reviewed -> approved -> published
      await db
        .update(skills)
        .set({ status: "ai_reviewed", updatedAt: new Date() })
        .where(eq(skills.id, skillId));

      await db
        .update(skills)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(skills.id, skillId));

      await db
        .update(skills)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(skills.id, skillId));
    } else {
      // Not auto-approved: transition to ai_reviewed for human review
      await db
        .update(skills)
        .set({ status: "ai_reviewed", updatedAt: new Date() })
        .where(eq(skills.id, skillId));
    }

    revalidatePath("/my-skills");

    // --- Notification dispatch (fire-and-forget, AFTER all DB work) ---
    const tenantId = session.user.tenantId!;
    if (autoApproved) {
      // RVNT-05: Notify author their skill was auto-published
      notifyReviewEvent({
        tenantId,
        recipientId: session.user.id,
        recipientEmail: session.user.email!,
        recipientName: session.user.name || "there",
        type: "review_published",
        skillName: skill.name,
        skillSlug: skill.slug ?? skillId,
      }).catch(() => {});
    } else {
      // RVNT-01: Notify all tenant admins that a skill needs review
      const admins = await getAdminsInTenant(tenantId);
      for (const admin of admins) {
        notifyReviewEvent({
          tenantId,
          recipientId: admin.id,
          recipientEmail: admin.email,
          recipientName: admin.name || "there",
          type: "review_submitted",
          skillName: skill.name,
          skillSlug: skill.slug ?? skillId,
          reviewerName: session.user.name || "A team member",
        }).catch(() => {});
      }
    }

    return { success: true, autoApproved };
  } catch (err) {
    console.error("AI review failed for skill", skillId, err);

    // Keep pending_review status but set error message
    await db
      .update(skills)
      .set({
        statusMessage: "AI review failed — please try again later.",
        updatedAt: new Date(),
      })
      .where(eq(skills.id, skillId));

    revalidatePath("/my-skills");
    return { error: "AI review failed — please try again later." };
  }
}
