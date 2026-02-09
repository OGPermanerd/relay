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
import { generateSkillReview, generateImprovedSkill, REVIEW_MODEL } from "@/lib/ai-review";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiReviewState = {
  error?: string;
  success?: boolean;
};

export type ImproveSkillState = {
  error?: string;
  improvedContent?: string;
  originalContent?: string;
};

export type AcceptImproveState = {
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

// ---------------------------------------------------------------------------
// Improve Skill (generate improved content from selected suggestions)
// ---------------------------------------------------------------------------

export async function improveSkill(
  prevState: ImproveSkillState,
  formData: FormData
): Promise<ImproveSkillState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const skillId = formData.get("skillId") as string;
  const suggestionsJson = formData.get("suggestions") as string;
  const useSuggestedDescription = formData.get("useSuggestedDescription") === "true";
  const suggestedDescription = formData.get("suggestedDescription") as string | null;

  if (!skillId || !suggestionsJson) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  let selectedSuggestions: string[];
  try {
    selectedSuggestions = JSON.parse(suggestionsJson);
  } catch {
    return { error: "Invalid suggestions data" };
  }

  if (selectedSuggestions.length === 0 && !useSuggestedDescription) {
    return { error: "No improvements selected" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, name: true, content: true, authorId: true, slug: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can improve a skill" };
  }

  try {
    const improvedContent = await generateImprovedSkill(
      skill.name,
      skill.content,
      selectedSuggestions,
      useSuggestedDescription,
      suggestedDescription ?? undefined
    );

    return { improvedContent, originalContent: skill.content };
  } catch (error) {
    console.error("Skill improvement failed:", error);
    return { error: "AI improvement service is temporarily unavailable. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Accept Improved Skill (persist the improved content)
// ---------------------------------------------------------------------------

export async function acceptImprovedSkill(
  prevState: AcceptImproveState,
  formData: FormData
): Promise<AcceptImproveState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const skillId = formData.get("skillId") as string;
  const improvedContent = formData.get("improvedContent") as string;

  if (!skillId || !improvedContent) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, authorId: true, slug: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can update a skill" };
  }

  try {
    await db
      .update(skills)
      .set({ content: improvedContent, updatedAt: new Date() })
      .where(eq(skills.id, skillId));

    revalidatePath(`/skills/${skill.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Accept improved skill failed:", error);
    return { error: "Failed to save improved content. Please try again." };
  }
}
