import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema";
import { sql, eq, and, isNotNull } from "drizzle-orm";

export interface UserStats {
  skillsShared: number;
  totalUses: number;
  avgRating: string | null;
  fteDaysSaved: number;
}

/**
 * Get aggregated statistics for a specific user's contributions
 *
 * Aggregates metrics across user's published skills:
 * - skillsShared: Count of published skills authored by user
 * - totalUses: Sum of all uses across their skills
 * - avgRating: Average rating formatted as "4.5" or null if no ratings
 * - fteDaysSaved: Sum of (totalUses * hoursSaved) / 8 for their skills
 *
 * Only counts published skills (publishedVersionId IS NOT NULL)
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  // Handle null db case - return default values
  if (!db) {
    return {
      skillsShared: 0,
      totalUses: 0,
      avgRating: null,
      fteDaysSaved: 0,
    };
  }

  const result = await db
    .select({
      skillsShared: sql<number>`COUNT(DISTINCT ${skills.id})`,
      totalUses: sql<number>`COALESCE(SUM(${skills.totalUses}), 0)`,
      avgRating: sql<string>`AVG(${skills.averageRating})`,
      fteDaysSaved: sql<number>`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}) / 8.0, 0)`,
    })
    .from(skills)
    .where(
      and(
        eq(skills.authorId, userId),
        isNotNull(skills.publishedVersionId),
        eq(skills.status, "published")
      )
    );

  const row = result[0];
  const skillsShared = Number(row?.skillsShared ?? 0);
  const totalUses = Number(row?.totalUses ?? 0);
  const rawFteDays = Number(row?.fteDaysSaved ?? 0);
  const fteDaysSaved = Math.round(rawFteDays * 10) / 10;

  // Parse avgRating: avg() returns string in drizzle-orm
  // averageRating is stored as integer * 100 (e.g., 450 = 4.5 stars)
  let avgRating: string | null = null;
  if (row?.avgRating !== null && row?.avgRating !== undefined) {
    const parsed = parseFloat(row.avgRating);
    if (!isNaN(parsed)) {
      // Divide by 100 to get actual rating value, format to 1 decimal
      avgRating = (parsed / 100).toFixed(1);
    }
  }

  return {
    skillsShared,
    totalUses,
    avgRating,
    fteDaysSaved,
  };
}
