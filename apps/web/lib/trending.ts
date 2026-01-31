import { db } from "@relay/db";
import { sql } from "drizzle-orm";

/**
 * Trending skill with time-decay score
 */
export interface TrendingSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  recentUses: number;
  trendingScore: number;
  totalUses: number;
}

/**
 * Get trending skills using Hacker News-style time-decay algorithm
 *
 * Formula: score = (recentUses - 1) / (ageHours + 2)^1.8
 * - recentUses - 1: Subtracting 1 to avoid initial spike bias
 * - ageHours + 2: Add 2 to prevent division by zero for brand new skills
 * - ^1.8: Gravity factor - higher values cause faster decay
 *
 * Source: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
 *
 * Requirements:
 * - Only published skills (publishedVersionId IS NOT NULL)
 * - At least 3 uses in the last 7 days
 * - Ordered by trending score descending
 *
 * @param limit - Maximum number of skills to return (default 10)
 * @returns Array of trending skills with scores
 */
export async function getTrendingSkills(limit: number = 10): Promise<TrendingSkill[]> {
  // Handle null db case - return empty array
  if (!db) {
    return [];
  }

  const results = await db.execute(sql`
    WITH skill_recent_usage AS (
      SELECT
        ue.skill_id,
        COUNT(*) as recent_uses,
        EXTRACT(EPOCH FROM (NOW() - MIN(s.created_at))) / 3600 as age_hours
      FROM usage_events ue
      JOIN skills s ON s.id = ue.skill_id
      WHERE ue.created_at >= NOW() - INTERVAL '7 days'
        AND s.published_version_id IS NOT NULL
      GROUP BY ue.skill_id
      HAVING COUNT(*) >= 3
    )
    SELECT
      s.id,
      s.name,
      s.slug,
      s.description,
      s.category,
      sru.recent_uses::integer as recent_uses,
      ((sru.recent_uses - 1) / POWER(sru.age_hours + 2, 1.8))::double precision as trending_score,
      s.total_uses
    FROM skill_recent_usage sru
    JOIN skills s ON s.id = sru.skill_id
    ORDER BY trending_score DESC
    LIMIT ${limit}
  `);

  // Map raw results to TrendingSkill type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (results as any[]).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    category: String(row.category),
    recentUses: Number(row.recent_uses),
    trendingScore: Number(row.trending_score),
    totalUses: Number(row.total_uses),
  }));
}
