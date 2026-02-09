"use server";

import { auth } from "@/auth";
import { db, ratings, skills } from "@everyskill/db";
import { updateSkillRating } from "@everyskill/db/services/skill-metrics";
import { createNotification } from "@everyskill/db/services/notifications";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

// Zod schema for rating form validation
const ratingSchema = z.object({
  skillId: z.string().min(1, "Skill ID is required"),
  skillSlug: z.string().min(1, "Skill slug is required"),
  rating: z.coerce
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1 star")
    .max(5, "Rating must be at most 5 stars"),
  comment: z
    .string()
    .max(2000, "Comment must be 2000 characters or less")
    .optional()
    .transform((val) => val || null),
  hoursSavedEstimate: z.coerce
    .number()
    .int("Hours saved must be a whole number")
    .min(0, "Hours saved cannot be negative")
    .max(1000, "Hours saved must be 1000 or less")
    .optional()
    .transform((val) => val || null),
});

export type RatingState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

export async function submitRating(
  prevState: RatingState,
  formData: FormData
): Promise<RatingState> {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to submit a rating" };
  }

  // Parse and validate form data
  const parsed = ratingSchema.safeParse({
    skillId: formData.get("skillId"),
    skillSlug: formData.get("skillSlug"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
    hoursSavedEstimate: formData.get("hoursSavedEstimate"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { skillId, skillSlug, rating, comment, hoursSavedEstimate } = parsed.data;

  // Check database availability
  if (!db) {
    return {
      message: "Database not configured. Please contact support.",
    };
  }

  try {
    // Check for existing rating by this user for this skill
    const existingRating = await db.query.ratings.findFirst({
      where: and(eq(ratings.skillId, skillId), eq(ratings.userId, session.user.id)),
    });

    if (existingRating) {
      // Update existing rating
      await db
        .update(ratings)
        .set({
          rating,
          comment,
          hoursSavedEstimate,
        })
        .where(eq(ratings.id, existingRating.id));
    } else {
      // Insert new rating
      await db.insert(ratings).values({
        tenantId: DEFAULT_TENANT_ID,
        skillId,
        userId: session.user.id,
        rating,
        comment,
        hoursSavedEstimate,
      });

      // Notify skill author (fire-and-forget, don't block the response)
      const skill = await db.query.skills.findFirst({
        where: eq(skills.id, skillId),
        columns: { authorId: true, name: true },
      });

      if (skill?.authorId && skill.authorId !== session.user.id) {
        const raterName = session.user.name || "Someone";
        const stars = rating === 1 ? "1 star" : `${rating} stars`;
        const commentExcerpt = comment
          ? ` — "${comment.slice(0, 100)}${comment.length > 100 ? "..." : ""}"`
          : "";

        createNotification({
          tenantId: DEFAULT_TENANT_ID,
          userId: skill.authorId,
          type: "skill_rated",
          title: `New rating on ${skill.name}`,
          message: `${raterName} gave ${skill.name} ${stars}${commentExcerpt}`,
          actionUrl: `/skills/${skillSlug}`,
        }).catch(() => {
          // Swallow notification errors — rating already saved
        });
      }
    }

    // Recalculate skill's average rating
    await updateSkillRating(skillId);

    // Revalidate relevant paths
    revalidatePath("/skills");
    revalidatePath(`/skills/${skillSlug}`);

    return {
      success: true,
      message: existingRating ? "Rating updated successfully" : "Rating submitted successfully",
    };
  } catch (error) {
    // Log error for debugging but don't expose details to user
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to submit rating:", error);
    }
    return {
      message: "Failed to submit rating. Please try again.",
    };
  }
}
