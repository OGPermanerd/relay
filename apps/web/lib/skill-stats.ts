import { db } from "@relay/db";
import { usageEvents, ratings, skills } from "@relay/db/schema";
import { sql, eq } from "drizzle-orm";
import { formatRating } from "@relay/db";

export interface SkillStats {
  totalUses: number;
  uniqueUsers: number;
  averageRating: string | null; // Formatted "4.5" or null
  totalRatings: number;
  fteDaysSaved: number; // Rounded to 1 decimal
}

/**
 * Get aggregated usage statistics for a skill
 *
 * Queries:
 * 1. usageEvents - total uses and unique users
 * 2. ratings - total ratings count
 * 3. skills - denormalized values (totalUses, averageRating, hoursSaved)
 *
 * Calculates FTE Days Saved: (totalUses * hoursSaved) / 8
 */
export async function getSkillStats(skillId: string): Promise<SkillStats> {
  // Handle null db case - return all zeros
  if (!db) {
    return {
      totalUses: 0,
      uniqueUsers: 0,
      averageRating: null,
      totalRatings: 0,
      fteDaysSaved: 0,
    };
  }

  // Query 1 - Usage stats from usageEvents
  const usageResult = await db
    .select({
      totalUses: sql<number>`cast(count(*) as integer)`,
      uniqueUsers: sql<number>`cast(count(distinct ${usageEvents.userId}) as integer)`,
    })
    .from(usageEvents)
    .where(eq(usageEvents.skillId, skillId));

  // Query 2 - Rating stats from ratings
  const ratingResult = await db
    .select({
      totalRatings: sql<number>`cast(count(*) as integer)`,
    })
    .from(ratings)
    .where(eq(ratings.skillId, skillId));

  // Query 3 - Get skill for denormalized values
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { hoursSaved: true, totalUses: true, averageRating: true },
  });

  // Calculate FTE Days Saved
  const totalUses = skill?.totalUses ?? 0;
  const hoursSaved = skill?.hoursSaved ?? 1;
  const fteDaysSaved = Math.round(((totalUses * hoursSaved) / 8) * 10) / 10;

  return {
    totalUses,
    uniqueUsers: usageResult?.[0]?.uniqueUsers ?? 0,
    averageRating: formatRating(skill?.averageRating ?? null),
    totalRatings: ratingResult?.[0]?.totalRatings ?? 0,
    fteDaysSaved,
  };
}
