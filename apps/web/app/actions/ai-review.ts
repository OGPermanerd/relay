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
import {
  generateSkillReview,
  generateImprovedSkill,
  refineImprovedSkill as refineImprovedSkillAI,
  generateForkDifferentiation,
  REVIEW_MODEL,
} from "@/lib/ai-review";

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
  suggestedTitle?: string;
  suggestedDescription?: string;
};

export type AcceptImproveState = {
  error?: string;
  success?: boolean;
};

export type RefineSkillState = {
  error?: string;
  refinedContent?: string;
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

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
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

    // Extract category scores (without summary/suggestedTitle/suggestedDescription) for the categories field
    const { summary, suggestedTitle, suggestedDescription, ...categories } = reviewOutput;

    await upsertSkillReview({
      skillId,
      tenantId,
      requestedBy: session.user.id,
      categories,
      summary,
      suggestedTitle,
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
  const useSuggestedTitle = formData.get("useSuggestedTitle") === "true";
  const suggestedTitle = formData.get("suggestedTitle") as string | null;

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

  if (selectedSuggestions.length === 0 && !useSuggestedDescription && !useSuggestedTitle) {
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
      suggestedDescription ?? undefined,
      useSuggestedTitle,
      suggestedTitle ?? undefined
    );

    return {
      improvedContent,
      originalContent: skill.content,
      suggestedTitle: useSuggestedTitle ? (suggestedTitle ?? undefined) : undefined,
      suggestedDescription: useSuggestedDescription
        ? (suggestedDescription ?? undefined)
        : undefined,
    };
  } catch (error) {
    console.error("Skill improvement failed:", error);
    return { error: "AI improvement service is temporarily unavailable. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Refine Improved Skill (iterative refinement based on user feedback)
// ---------------------------------------------------------------------------

export async function refineImprovedSkill(
  prevState: RefineSkillState,
  formData: FormData
): Promise<RefineSkillState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const skillId = formData.get("skillId") as string;
  const currentContent = formData.get("currentContent") as string;
  const feedback = formData.get("refinementFeedback") as string;

  if (!skillId || !currentContent || !feedback?.trim()) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, name: true, authorId: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can refine a skill" };
  }

  try {
    const refinedContent = await refineImprovedSkillAI(skill.name, currentContent, feedback.trim());
    return { refinedContent };
  } catch (error) {
    console.error("Skill refinement failed:", error);
    return { error: "AI refinement service is temporarily unavailable. Please try again." };
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
  const suggestedTitle = formData.get("suggestedTitle") as string | null;
  const suggestedDescription = formData.get("suggestedDescription") as string | null;
  const forkedFromId = formData.get("forkedFromId") as string | null;
  const parentContent = formData.get("parentContent") as string | null;

  if (!skillId || !improvedContent) {
    return { error: "Invalid request" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, authorId: true, slug: true, description: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (skill.authorId !== session.user.id) {
    return { error: "Only the skill author can update a skill" };
  }

  try {
    const updateFields: Record<string, unknown> = {
      content: improvedContent,
      updatedAt: new Date(),
    };
    if (suggestedTitle) {
      updateFields.name = suggestedTitle;
    }

    // Fork differentiation: generate summary when this is a fork with parent content
    if (forkedFromId && parentContent) {
      try {
        const diffSummary = await generateForkDifferentiation(parentContent, improvedContent);
        const existingDesc = suggestedDescription || skill.description || "";
        updateFields.description = `**What's different:** ${diffSummary}\n\n${existingDesc}`;
      } catch (diffError) {
        // Non-fatal — log and skip differentiation
        console.error("Fork differentiation generation failed:", diffError);
        if (suggestedDescription) {
          updateFields.description = suggestedDescription;
        }
      }
    } else if (suggestedDescription) {
      updateFields.description = suggestedDescription;
    }

    await db.update(skills).set(updateFields).where(eq(skills.id, skillId));

    revalidatePath(`/skills/${skill.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Accept improved skill failed:", error);
    return { error: "Failed to save improved content. Please try again." };
  }
}
