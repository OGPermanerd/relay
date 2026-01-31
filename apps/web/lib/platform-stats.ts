import { db } from "@relay/db";
import { skills, users } from "@relay/db/schema";
import { sql, eq, isNotNull } from "drizzle-orm";

export interface PlatformStats {
  totalContributors: number;
  totalDownloads: number;
  totalUses: number;
  totalFteDaysSaved: number;
}

/**
 * Get platform-wide aggregated statistics
 *
 * Aggregates metrics across all published skills:
 * - totalContributors: Count of unique users who have published at least one skill
 * - totalDownloads: Sum of all skill uses (same as totalUses)
 * - totalUses: Sum of all skill uses
 * - totalFteDaysSaved: Sum of (totalUses * hoursSaved) / 8 across all skills
 *
 * Only counts published skills (publishedVersionId IS NOT NULL)
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  // Handle null db case - return all zeros
  if (!db) {
    return {
      totalContributors: 0,
      totalDownloads: 0,
      totalUses: 0,
      totalFteDaysSaved: 0,
    };
  }

  // Run two parallel queries
  const [skillStats, userStats] = await Promise.all([
    // Query 1: Aggregate skill metrics from published skills
    db
      .select({
        totalUses: sql<number>`COALESCE(SUM(${skills.totalUses}), 0)`,
        totalFteDays: sql<number>`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}) / 8.0, 0)`,
      })
      .from(skills)
      .where(isNotNull(skills.publishedVersionId)),

    // Query 2: Count unique contributors with published skills
    db
      .select({
        totalContributors: sql<number>`COUNT(DISTINCT ${users.id})`,
      })
      .from(users)
      .innerJoin(skills, eq(skills.authorId, users.id))
      .where(isNotNull(skills.publishedVersionId)),
  ]);

  const totalUses = Number(skillStats[0]?.totalUses ?? 0);
  const rawFteDays = Number(skillStats[0]?.totalFteDays ?? 0);
  const totalFteDaysSaved = Math.round(rawFteDays * 10) / 10;
  const totalContributors = Number(userStats[0]?.totalContributors ?? 0);

  return {
    totalContributors,
    totalDownloads: totalUses,
    totalUses,
    totalFteDaysSaved,
  };
}
