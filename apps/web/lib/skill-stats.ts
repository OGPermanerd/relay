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
  hoursSavedSource: "user" | "creator"; // Indicates which estimate is used
  hoursSavedEstimate: number; // The value used for FTE calculation
}

/**
 * Get aggregated usage statistics for a skill
 *
 * Queries:
 * 1. usageEvents - total uses and unique users
 * 2. ratings - total ratings count
 * 3. skills - denormalized values (totalUses, averageRating, hoursSaved)
 * 4. ratings - average user-submitted hours saved estimate
 *
 * Calculates FTE Days Saved: (totalUses * effectiveHoursSaved) / 8
 * Uses user estimates when available, otherwise creator estimate
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
      hoursSavedSource: "creator",
      hoursSavedEstimate: 0,
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

  // Query 4 - Average user-submitted hours saved estimate
  const timeEstimateResult = await db
    .select({
      avgHoursSaved: sql<string>`avg(${ratings.hoursSavedEstimate})`,
      countWithEstimate: sql<number>`cast(count(${ratings.hoursSavedEstimate}) as integer)`,
    })
    .from(ratings)
    .where(eq(ratings.skillId, skillId));

  const userAvgHours = timeEstimateResult?.[0]?.avgHoursSaved
    ? parseFloat(timeEstimateResult[0].avgHoursSaved)
    : null;
  const countWithEstimate = timeEstimateResult?.[0]?.countWithEstimate ?? 0;

  // Use user estimates if at least one exists, otherwise creator estimate
  // Round to nearest 0.1 hour
  const rawHoursSaved =
    countWithEstimate > 0 && userAvgHours !== null ? userAvgHours : (skill?.hoursSaved ?? 1);
  const effectiveHoursSaved = Math.round(rawHoursSaved * 10) / 10;

  const hoursSavedSource: "user" | "creator" =
    countWithEstimate > 0 && userAvgHours !== null ? "user" : "creator";

  // Calculate FTE Days Saved
  const totalUses = skill?.totalUses ?? 0;
  const fteDaysSaved = Math.round(((totalUses * effectiveHoursSaved) / 8) * 10) / 10;

  return {
    totalUses,
    uniqueUsers: usageResult?.[0]?.uniqueUsers ?? 0,
    averageRating: formatRating(skill?.averageRating ?? null),
    totalRatings: ratingResult?.[0]?.totalRatings ?? 0,
    fteDaysSaved,
    hoursSavedSource,
    hoursSavedEstimate: effectiveHoursSaved,
  };
}
