import { eq, sql, and, inArray } from "drizzle-orm";
import { db } from "../client";
import { skills, ratings, usageEvents } from "../schema";
import { updateSkillRating } from "./skill-metrics";

/**
 * Merge source skill into target skill.
 * Moves forks, usage events, and non-duplicate ratings to target,
 * then deletes source. Recalculates target aggregates after.
 */
export async function mergeSkills(
  sourceId: string,
  targetId: string
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: "Database not configured" };
  }

  if (sourceId === targetId) {
    return { success: false, error: "Cannot merge a skill into itself" };
  }

  // Validate both skills exist
  const [source, target] = await Promise.all([
    db.query.skills.findFirst({ where: eq(skills.id, sourceId), columns: { id: true } }),
    db.query.skills.findFirst({ where: eq(skills.id, targetId), columns: { id: true } }),
  ]);

  if (!source) return { success: false, error: "Source skill not found" };
  if (!target) return { success: false, error: "Target skill not found" };

  await db.transaction(async (tx) => {
    // 1. Move forks from source to target
    await tx
      .update(skills)
      .set({ forkedFromId: targetId })
      .where(eq(skills.forkedFromId, sourceId));

    // 2. Move usage events from source to target
    await tx
      .update(usageEvents)
      .set({ skillId: targetId })
      .where(eq(usageEvents.skillId, sourceId));

    // 3. Move ratings: skip duplicates (same userId already rated target)
    const existingTargetRaters = await tx
      .select({ userId: ratings.userId })
      .from(ratings)
      .where(eq(ratings.skillId, targetId));

    const targetRaterIds = existingTargetRaters.map((r) => r.userId);

    if (targetRaterIds.length > 0) {
      // Delete source ratings where user already rated target (avoid duplicates)
      await tx
        .delete(ratings)
        .where(and(eq(ratings.skillId, sourceId), inArray(ratings.userId, targetRaterIds)));
    }

    // Move remaining source ratings to target
    await tx.update(ratings).set({ skillId: targetId }).where(eq(ratings.skillId, sourceId));

    // 4. Delete source skill (cascades versions/reviews/embeddings)
    await tx.delete(skills).where(eq(skills.id, sourceId));

    // 5. Recalculate target totalUses from usage_events
    const [usageCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(usageEvents)
      .where(eq(usageEvents.skillId, targetId));

    await tx
      .update(skills)
      .set({ totalUses: usageCount.count, updatedAt: new Date() })
      .where(eq(skills.id, targetId));
  });

  // Recalculate average rating outside transaction
  await updateSkillRating(targetId);

  return { success: true };
}
