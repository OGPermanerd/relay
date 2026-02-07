import { eq } from "drizzle-orm";
import { db } from "../client";
import { skills } from "../schema";

/**
 * Delete a skill by ID.
 * Detaches any forks (sets forkedFromId = null) before deleting.
 * Cascades: skill_versions, ratings, skill_reviews, skill_embeddings.
 * usage_events are preserved (no FK constraint).
 */
export async function deleteSkill(skillId: string): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: "Database not configured" };
  }

  // Detach forks first
  await db.update(skills).set({ forkedFromId: null }).where(eq(skills.forkedFromId, skillId));

  // Delete the skill (cascades versions/ratings/reviews/embeddings)
  const deleted = await db
    .delete(skills)
    .where(eq(skills.id, skillId))
    .returning({ id: skills.id });

  if (deleted.length === 0) {
    return { success: false, error: "Skill not found" };
  }

  return { success: true };
}
