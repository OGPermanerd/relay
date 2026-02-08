"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import {
  getSkillReview,
  upsertSkillReview,
  toggleReviewVisibility,
} from "@everyskill/db/services/skill-reviews";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashContent } from "@/lib/content-hash";
import { generateSkillReview, REVIEW_MODEL } from "@/lib/ai-review";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiReviewState = {
  error?: string;
  success?: boolean;
};

// ---------------------------------------------------------------------------
// Request AI Review
// ---------------------------------------------------------------------------

export async function requestAiReview(
  prevState: AiReviewState,
  formData: FormData
): Promise<AiReviewState> {
  // Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  // Extract skill ID
  const skillId = formData.get("skillId") as string;
  if (!skillId) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  // Fetch skill and verify it exists
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      name: true,
      description: true,
      content: true,
      category: true,
      authorId: true,
      slug: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Authorization: author-only (admin system doesn't exist yet)
  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can request a review" };
  }

  // Content hash check: prevent duplicate reviews on unchanged content
  const contentHash = await hashContent(skill.content);
  const existingReview = await getSkillReview(skillId);

  if (existingReview && existingReview.reviewedContentHash === contentHash) {
    return { error: "Content has not changed since last review" };
  }

  // Generate and persist the review
  try {
    const reviewOutput = await generateSkillReview(
      skill.name,
      skill.description ?? "",
      skill.content,
      skill.category ?? "prompt"
    );

    // Extract category scores (without summary/suggestedDescription) for the categories field
    const { summary, suggestedDescription, ...categories } = reviewOutput;

    await upsertSkillReview({
      skillId,
      requestedBy: session.user.id,
      categories,
      summary,
      suggestedDescription,
      reviewedContentHash: contentHash,
      modelName: REVIEW_MODEL,
    });

    revalidatePath(`/skills/${skill.slug}`);
    return { success: true };
  } catch (error) {
    console.error("AI review failed:", error);
    return {
      error: "AI review service is temporarily unavailable. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Toggle AI Review Visibility
// ---------------------------------------------------------------------------

export async function toggleAiReviewVisibility(
  prevState: AiReviewState,
  formData: FormData
): Promise<AiReviewState> {
  // Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const skillId = formData.get("skillId") as string;
  const isVisible = formData.get("isVisible") === "true";

  if (!skillId) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  // Verify skill exists and user is the author
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { authorId: true, slug: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can change review visibility" };
  }

  try {
    await toggleReviewVisibility(skillId, isVisible);
    revalidatePath(`/skills/${skill.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Toggle review visibility failed:", error);
    return { error: "Failed to update review visibility. Please try again." };
  }
}
