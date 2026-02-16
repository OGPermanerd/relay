import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

/**
 * Leaderboard entry representing a contributor's ranking
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  skillsShared: number;
  totalUses: number;
  avgRating: string | null; // Formatted "4.5" or null
  fteDaysSaved: number;
  latestContributionDate: Date | null; // Date of most recent skill publication
}

/**
 * Get contributor leaderboard ranked by FTE Days Saved
 *
 * Uses PostgreSQL RANK() window function to rank contributors.
 * Only includes contributors with at least one published skill.
 *
 * Ranking criteria:
 * 1. Primary: FTE Days Saved (descending)
 * 2. Secondary: Skills Shared (descending) - for tie-breaking
 *
 * RANK() creates gaps for ties (1, 1, 3) which is acceptable for leaderboards.
 *
 * @param limit Maximum number of entries to return (default: 10)
 * @returns Array of LeaderboardEntry sorted by rank
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  // Handle null db case - return empty array
  if (!db) {
    return [];
  }

  // CTE with RANK() window function for contributor rankings
  // - LEFT JOIN to include all users, filter to those with published skills
  // - avg_rating stored as integer * 100, divide by 100 for display
  // - FTE Days Saved = (total_uses * hours_saved) / 8
  const result = await db.execute(sql`
    WITH contributor_stats AS (
      SELECT
        u.id as user_id,
        u.name,
        u.image,
        COUNT(DISTINCT s.id) as skills_shared,
        COALESCE(SUM(s.total_uses), 0) as total_uses,
        COALESCE(AVG(s.average_rating), 0) as avg_rating,
        COALESCE(SUM(s.total_uses * s.hours_saved) / 8.0, 0) as fte_days_saved,
        MAX(s.created_at) as latest_contribution_date
      FROM users u
      LEFT JOIN skills s ON s.author_id = u.id
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        AND s.visibility IN ('global_approved', 'tenant')
      GROUP BY u.id, u.name, u.image
    )
    SELECT
      RANK() OVER (ORDER BY fte_days_saved DESC, skills_shared DESC) as rank,
      user_id,
      name,
      image,
      skills_shared::integer,
      total_uses::integer,
      CASE
        WHEN avg_rating > 0 THEN (avg_rating / 100)::numeric(3,1)::text
        ELSE NULL
      END as avg_rating,
      ROUND(fte_days_saved::numeric, 1)::double precision as fte_days_saved,
      latest_contribution_date::date as latest_contribution_date
    FROM contributor_stats
    WHERE skills_shared > 0
    ORDER BY rank
    LIMIT ${limit}
  `);

  // Map raw results to LeaderboardEntry type
  // db.execute returns RowList which is array-like, cast to array for mapping
  return (result as unknown as Record<string, unknown>[]).map((row) => ({
    rank: Number(row.rank),
    userId: String(row.user_id),
    name: String(row.name ?? "Anonymous"),
    image: row.image ? String(row.image) : null,
    skillsShared: Number(row.skills_shared),
    totalUses: Number(row.total_uses),
    avgRating: row.avg_rating ? String(row.avg_rating) : null,
    fteDaysSaved: Number(row.fte_days_saved),
    latestContributionDate: row.latest_contribution_date
      ? new Date(String(row.latest_contribution_date))
      : null,
  }));
}
