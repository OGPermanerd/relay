import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";
import { HOURLY_RATE } from "@/lib/ip-valuation";

/**
 * Aggregate stats for a user's published skill portfolio
 */
export interface PortfolioStats {
  skillsAuthored: number;
  totalUses: number;
  totalHoursSaved: number;
  avgRating: string | null;
  portableSkills: number;
  portableHoursSaved: number;
  companySkills: number;
  companyHoursSaved: number;
}

/**
 * Individual skill entry for the portfolio list
 */
export interface PortfolioSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  totalUses: number;
  hoursSaved: number;
  totalHoursSaved: number;
  avgRating: string | null;
  visibility: string;
  createdAt: string;
}

/**
 * Contribution ranking within a tenant
 */
export interface ContributionRanking {
  rank: number;
  totalContributors: number;
  percentile: number;
  label: string;
}

/**
 * Get aggregate portfolio stats for a user's published skills
 *
 * Uses conditional aggregation (FILTER WHERE) to compute overall and
 * per-visibility breakdowns in a single query pass.
 *
 * - skillsAuthored: Count of published skills
 * - totalUses: Sum of total_uses across all published skills
 * - totalHoursSaved: Sum of (total_uses * COALESCE(hours_saved, 1))
 * - avgRating: Average rating / 100, formatted "4.5" (stored as integer * 100)
 * - portableSkills/portableHoursSaved: Same metrics for visibility = 'personal'
 * - companySkills/companyHoursSaved: Same metrics for visibility = 'tenant'
 *
 * @param userId The author whose portfolio stats to retrieve
 */
export async function getPortfolioStats(userId: string): Promise<PortfolioStats> {
  if (!db) {
    return {
      skillsAuthored: 0,
      totalUses: 0,
      totalHoursSaved: 0,
      avgRating: null,
      portableSkills: 0,
      portableHoursSaved: 0,
      companySkills: 0,
      companyHoursSaved: 0,
    };
  }

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::integer AS skills_authored,
      COALESCE(SUM(total_uses), 0)::integer AS total_uses,
      COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)), 0)::double precision AS total_hours_saved,
      AVG(average_rating) AS avg_rating_raw,
      COUNT(*) FILTER (WHERE visibility = 'personal')::integer AS portable_skills,
      COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)) FILTER (WHERE visibility = 'personal'), 0)::double precision AS portable_hours_saved,
      COUNT(*) FILTER (WHERE visibility = 'tenant')::integer AS company_skills,
      COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)) FILTER (WHERE visibility = 'tenant'), 0)::double precision AS company_hours_saved
    FROM skills
    WHERE author_id = ${userId}
      AND published_version_id IS NOT NULL
      AND status = 'published'
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  // Parse avgRating: stored as integer * 100 (e.g., 450 = 4.5 stars)
  let avgRating: string | null = null;
  if (row?.avg_rating_raw != null) {
    const parsed = parseFloat(String(row.avg_rating_raw));
    if (!isNaN(parsed) && parsed > 0) {
      avgRating = (parsed / 100).toFixed(1);
    }
  }

  return {
    skillsAuthored: Number(row?.skills_authored ?? 0),
    totalUses: Number(row?.total_uses ?? 0),
    totalHoursSaved: Number(row?.total_hours_saved ?? 0),
    avgRating,
    portableSkills: Number(row?.portable_skills ?? 0),
    portableHoursSaved: Number(row?.portable_hours_saved ?? 0),
    companySkills: Number(row?.company_skills ?? 0),
    companyHoursSaved: Number(row?.company_hours_saved ?? 0),
  };
}

/**
 * Get list of user's published skills with visibility scope
 *
 * Returns skills ordered by total impact (totalHoursSaved DESC).
 * Serializes createdAt to ISO string to prevent hydration mismatches.
 *
 * @param userId The author whose skills to list
 */
export async function getPortfolioSkills(userId: string): Promise<PortfolioSkill[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      id,
      name,
      slug,
      category,
      COALESCE(total_uses, 0)::integer AS total_uses,
      COALESCE(hours_saved, 1)::integer AS hours_saved,
      (COALESCE(total_uses, 0) * COALESCE(hours_saved, 1))::double precision AS total_hours_saved,
      CASE
        WHEN average_rating IS NOT NULL AND average_rating > 0
          THEN (average_rating / 100.0)::numeric(3,1)::text
        ELSE NULL
      END AS avg_rating,
      visibility,
      created_at
    FROM skills
    WHERE author_id = ${userId}
      AND published_version_id IS NOT NULL
      AND status = 'published'
    ORDER BY total_hours_saved DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    category: String(row.category),
    totalUses: Number(row.total_uses),
    hoursSaved: Number(row.hours_saved),
    totalHoursSaved: Number(row.total_hours_saved),
    avgRating: row.avg_rating ? String(row.avg_rating) : null,
    visibility: String(row.visibility),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}

/**
 * Get user's contribution ranking within their tenant
 *
 * Uses CTEs with RANK() and PERCENT_RANK() window functions.
 * Only counts tenant-visible skills (visibility = 'tenant') for ranking,
 * matching leaderboard behavior where personal skills are private.
 *
 * Label logic:
 * - Teams > 20: Percentile-based ("Top 5%", "Top 10%", etc.)
 * - Teams <= 20: Absolute rank ("1st of 12", "2nd of 12", etc.)
 * - No published skills: "No published skills yet"
 *
 * @param userId The user to rank
 * @param tenantId The tenant scope for ranking
 */
export async function getContributionRanking(
  userId: string,
  tenantId: string
): Promise<ContributionRanking> {
  if (!db) {
    return { rank: 0, totalContributors: 0, percentile: 0, label: "" };
  }

  const result = await db.execute(sql`
    WITH contributor_stats AS (
      SELECT
        s.author_id AS user_id,
        COUNT(DISTINCT s.id) AS skills_shared,
        COALESCE(SUM(s.total_uses * COALESCE(s.hours_saved, 1)) / 8.0, 0) AS fte_days_saved
      FROM skills s
      WHERE s.tenant_id = ${tenantId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        AND s.visibility = 'tenant'
      GROUP BY s.author_id
    ),
    ranked AS (
      SELECT
        user_id,
        skills_shared,
        fte_days_saved,
        RANK() OVER (ORDER BY fte_days_saved DESC, skills_shared DESC) AS rank,
        PERCENT_RANK() OVER (ORDER BY fte_days_saved DESC, skills_shared DESC) AS pct_rank,
        COUNT(*) OVER () AS total_contributors
      FROM contributor_stats
    )
    SELECT
      rank::integer,
      total_contributors::integer,
      pct_rank::double precision AS percentile
    FROM ranked
    WHERE user_id = ${userId}
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  // User has no published tenant-visible skills
  if (!row) {
    // Still need total contributors for context
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT author_id)::integer AS total
      FROM skills
      WHERE tenant_id = ${tenantId}
        AND published_version_id IS NOT NULL
        AND status = 'published'
        AND visibility = 'tenant'
    `);
    const countRows = countResult as unknown as Record<string, unknown>[];
    const total = Number(countRows[0]?.total ?? 0);

    return {
      rank: 0,
      totalContributors: total,
      percentile: 0,
      label: "No published skills yet",
    };
  }

  const rank = Number(row.rank);
  const totalContributors = Number(row.total_contributors);
  // PERCENT_RANK returns 0 for rank 1, 1 for last — invert to get "top X%"
  const rawPercentile = Number(row.percentile);
  // Convert to "top percentage" (rank 1 = 0% from top, last = 100% from top)
  const topPercentage = rawPercentile * 100;

  let label: string;
  if (totalContributors > 20) {
    // Percentile-based labels
    if (topPercentage <= 5) {
      label = "Top 5%";
    } else if (topPercentage <= 10) {
      label = "Top 10%";
    } else if (topPercentage <= 15) {
      label = "Top 15%";
    } else if (topPercentage <= 25) {
      label = "Top 25%";
    } else if (topPercentage <= 50) {
      label = "Top 50%";
    } else {
      label = "Bottom Half";
    }
  } else {
    // Absolute rank for small teams
    label = `${formatOrdinal(rank)} of ${totalContributors}`;
  }

  return {
    rank,
    totalContributors,
    percentile: Math.round((1 - rawPercentile) * 100), // 0-100 where 100 = top
    label,
  };
}

/**
 * Format a number as an ordinal string (1st, 2nd, 3rd, 4th, etc.)
 */
function formatOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = n % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${n}${suffix}`;
}

// =============================================================================
// Impact Timeline
// =============================================================================

/**
 * A single event in the user's impact timeline.
 * Events come from skill creations, forks, and implemented suggestions.
 * cumulativeHoursSaved is computed via PostgreSQL window function.
 */
export interface TimelineEvent {
  date: string; // ISO date string
  eventType: "creation" | "fork" | "suggestion";
  skillName: string;
  hoursImpact: number;
  cumulativeHoursSaved: number;
}

/**
 * Get the user's impact timeline — a chronological list of contribution events
 * with a running cumulative total of hours saved.
 *
 * Uses UNION ALL to combine three event sources:
 * 1. Original skill creations (forked_from_id IS NULL)
 * 2. Fork creations (forked_from_id IS NOT NULL)
 * 3. Implemented suggestions from skill_feedback
 *
 * A SUM() OVER (ORDER BY event_date ROWS UNBOUNDED PRECEDING) window function
 * computes the running cumulative hours saved across all event types.
 *
 * @param userId The user whose timeline to retrieve
 */
export async function getImpactTimeline(userId: string): Promise<TimelineEvent[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    WITH events AS (
      SELECT
        created_at AS event_date,
        'creation' AS event_type,
        name AS skill_name,
        (total_uses * COALESCE(hours_saved, 1))::double precision AS hours_impact
      FROM skills
      WHERE author_id = ${userId}
        AND forked_from_id IS NULL
        AND published_version_id IS NOT NULL
        AND status = 'published'

      UNION ALL

      SELECT
        created_at AS event_date,
        'fork' AS event_type,
        name AS skill_name,
        (total_uses * COALESCE(hours_saved, 1))::double precision AS hours_impact
      FROM skills
      WHERE author_id = ${userId}
        AND forked_from_id IS NOT NULL
        AND published_version_id IS NOT NULL
        AND status = 'published'

      UNION ALL

      SELECT
        COALESCE(reviewed_at, created_at) AS event_date,
        'suggestion' AS event_type,
        'Suggestion' AS skill_name,
        0::double precision AS hours_impact
      FROM skill_feedback
      WHERE user_id = ${userId}
        AND feedback_type = 'suggestion'
        AND status = 'accepted'
        AND implemented_by_skill_id IS NOT NULL
    )
    SELECT
      event_date,
      event_type,
      skill_name,
      hours_impact,
      SUM(hours_impact) OVER (ORDER BY event_date ROWS UNBOUNDED PRECEDING) AS cumulative_hours_saved
    FROM events
    ORDER BY event_date ASC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    date: new Date(String(row.event_date)).toISOString(),
    eventType: String(row.event_type) as "creation" | "fork" | "suggestion",
    skillName: String(row.skill_name),
    hoursImpact: Number(row.hours_impact ?? 0),
    cumulativeHoursSaved: Number(row.cumulative_hours_saved ?? 0),
  }));
}

// =============================================================================
// Impact Calculator Stats
// =============================================================================

/**
 * Aggregate stats for the impact calculator card display.
 * Shows total value contributed and breakdown by contribution type.
 */
export interface ImpactCalculatorStats {
  totalHoursSaved: number;
  estimatedCostSaved: number; // totalHoursSaved * HOURLY_RATE
  skillsCreated: number;
  skillsForked: number;
  suggestionsImplemented: number;
}

/**
 * Get aggregate impact calculator stats for a user.
 *
 * Two queries:
 * 1. Skills query — uses FILTER (WHERE) conditional aggregation to count
 *    original creations vs forks in a single pass
 * 2. Suggestions query — counts accepted suggestions with implementations
 *
 * estimatedCostSaved = totalHoursSaved * HOURLY_RATE ($150/hr)
 *
 * @param userId The user whose impact stats to retrieve
 */
export async function getImpactCalculatorStats(userId: string): Promise<ImpactCalculatorStats> {
  if (!db) {
    return {
      totalHoursSaved: 0,
      estimatedCostSaved: 0,
      skillsCreated: 0,
      skillsForked: 0,
      suggestionsImplemented: 0,
    };
  }

  const [skillsResult, suggestionsResult] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)), 0)::double precision AS total_hours_saved,
        COUNT(*) FILTER (WHERE forked_from_id IS NULL)::integer AS skills_created,
        COUNT(*) FILTER (WHERE forked_from_id IS NOT NULL)::integer AS skills_forked
      FROM skills
      WHERE author_id = ${userId}
        AND published_version_id IS NOT NULL
        AND status = 'published'
    `),
    db.execute(sql`
      SELECT COUNT(*)::integer AS suggestions_implemented
      FROM skill_feedback
      WHERE user_id = ${userId}
        AND feedback_type = 'suggestion'
        AND status = 'accepted'
        AND implemented_by_skill_id IS NOT NULL
    `),
  ]);

  const skillsRows = skillsResult as unknown as Record<string, unknown>[];
  const suggestionsRows = suggestionsResult as unknown as Record<string, unknown>[];

  const skillsRow = skillsRows[0];
  const suggestionsRow = suggestionsRows[0];

  const totalHoursSaved = Number(skillsRow?.total_hours_saved ?? 0);

  return {
    totalHoursSaved,
    estimatedCostSaved: totalHoursSaved * HOURLY_RATE,
    skillsCreated: Number(skillsRow?.skills_created ?? 0),
    skillsForked: Number(skillsRow?.skills_forked ?? 0),
    suggestionsImplemented: Number(suggestionsRow?.suggestions_implemented ?? 0),
  };
}
