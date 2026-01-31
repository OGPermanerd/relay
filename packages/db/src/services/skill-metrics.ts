import { eq, sql, avg } from "drizzle-orm";
import { db } from "../client";
import { skills, ratings } from "../schema";

/**
 * Increment the totalUses counter for a skill
 * Called when a usage event is recorded for this skill
 *
 * Uses SQL increment to avoid race conditions:
 * totalUses = totalUses + 1
 */
export async function incrementSkillUses(skillId: string): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping incrementSkillUses");
    return;
  }

  await db
    .update(skills)
    .set({
      totalUses: sql`COALESCE(${skills.totalUses}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId));
}

/**
 * Recalculate and update the averageRating for a skill
 * Called after a rating is added or modified
 *
 * Calculates average from all ratings and stores as integer (rating * 100)
 * e.g., 4.5 stars stored as 450
 */
export async function updateSkillRating(skillId: string): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping updateSkillRating");
    return;
  }

  // Calculate average rating for this skill
  const result = await db
    .select({
      avgRating: avg(ratings.rating),
    })
    .from(ratings)
    .where(eq(ratings.skillId, skillId));

  const avgRating = result[0]?.avgRating;

  // Update skill with new average (multiply by 100 for precision)
  await db
    .update(skills)
    .set({
      averageRating: avgRating ? Math.round(Number(avgRating) * 100) : null,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId));
}

/**
 * Get formatted rating display value
 * Converts stored integer (e.g., 450) to display string (e.g., "4.5")
 */
export function formatRating(storedRating: number | null): string | null {
  if (storedRating === null) return null;
  return (storedRating / 100).toFixed(1);
}
