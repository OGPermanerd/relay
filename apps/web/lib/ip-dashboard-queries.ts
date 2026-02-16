import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

// =============================================================================
// Constants
// =============================================================================

/** Minimum total_uses for a single-author skill to be considered "high" risk */
export const HIGH_USAGE_THRESHOLD = 10;

/** Minimum total_uses for a single-author skill to be considered "critical" risk */
export const CRITICAL_USAGE_THRESHOLD = 50;

// =============================================================================
// Types
// =============================================================================

/**
 * Hero statistics for the IP dashboard KPI cards
 * All values are all-time cumulative (no date filtering)
 */
export interface IpDashboardStats {
  totalSkillsCaptured: number;
  totalUses: number;
  totalHoursSaved: number;
  activeContributors: number;
}

/**
 * Single data point in the quality trend time series
 * All series are normalized to 0-100 scale for consistent charting
 */
export interface QualityTrendPoint {
  date: string; // YYYY-MM format
  avgRating: number | null; // normalized 0-100 from ratings 1-5 scale, null if no data
  sentimentPct: number | null; // 0-100% positive feedback, null if no data
  benchmarkScore: number | null; // 0-100 from benchmark_results, null if no data
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get all-time IP dashboard hero statistics
 *
 * Returns cumulative KPIs: total skills captured, total uses, hours saved,
 * and active contributors. All scoped to the given tenant.
 *
 * @param tenantId - Tenant ID to filter by
 * @returns Hero statistics for KPI cards
 */
export async function getIpDashboardStats(tenantId: string): Promise<IpDashboardStats> {
  if (!db) {
    return { totalSkillsCaptured: 0, totalUses: 0, totalHoursSaved: 0, activeContributors: 0 };
  }

  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::integer FROM skills WHERE tenant_id = ${tenantId} AND status = 'published') AS total_skills,
      (SELECT COUNT(*)::integer FROM usage_events WHERE tenant_id = ${tenantId}) AS total_uses,
      (SELECT COALESCE(SUM(COALESCE(hours_saved, 1) * total_uses), 0)::double precision
       FROM skills WHERE tenant_id = ${tenantId} AND status = 'published') AS total_hours_saved,
      (SELECT COUNT(DISTINCT author_id)::integer FROM skills WHERE tenant_id = ${tenantId} AND author_id IS NOT NULL AND status = 'published') AS active_contributors
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  return {
    totalSkillsCaptured: Number(row?.total_skills ?? 0),
    totalUses: Number(row?.total_uses ?? 0),
    totalHoursSaved: Number(row?.total_hours_saved ?? 0),
    activeContributors: Number(row?.active_contributors ?? 0),
  };
}

/**
 * Get monthly quality trend data for the IP dashboard chart
 *
 * Returns three series normalized to 0-100 scale:
 * - avgRating: Average skill rating (1-5 stars * 20 = 0-100)
 * - sentimentPct: Percentage of positive feedback (thumbs_up / total thumbs)
 * - benchmarkScore: Average benchmark quality score (already 0-100)
 *
 * Each month may have null for any series if no data exists for that period.
 *
 * @param tenantId - Tenant ID to filter by
 * @param startDate - Start date for the trend window
 * @returns Array of monthly quality data points, sorted ascending by date
 */
export async function getQualityTrends(
  tenantId: string,
  startDate: Date
): Promise<QualityTrendPoint[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();

  // Query 1: Ratings by month (normalize 1-5 to 0-100 by multiplying by 20)
  const ratingsResult = await db.execute(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           (AVG(rating) * 20)::double precision AS avg_rating_pct
    FROM ratings
    WHERE tenant_id = ${tenantId} AND created_at >= ${startDateStr}
    GROUP BY date_trunc('month', created_at)
    ORDER BY month
  `);

  // Query 2: Feedback sentiment by month (thumbs_up percentage)
  const sentimentResult = await db.execute(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           CASE WHEN COUNT(*) FILTER (WHERE feedback_type IN ('thumbs_up','thumbs_down')) > 0
             THEN (COUNT(*) FILTER (WHERE feedback_type = 'thumbs_up') * 100.0 /
                   COUNT(*) FILTER (WHERE feedback_type IN ('thumbs_up','thumbs_down')))::double precision
             ELSE NULL
           END AS sentiment_pct
    FROM skill_feedback
    WHERE tenant_id = ${tenantId} AND created_at >= ${startDateStr}
    GROUP BY date_trunc('month', created_at)
    ORDER BY month
  `);

  // Query 3: Benchmark quality by month
  const benchmarkResult = await db.execute(sql`
    SELECT to_char(date_trunc('month', br.created_at), 'YYYY-MM') AS month,
           AVG(bres.quality_score)::double precision AS avg_benchmark
    FROM benchmark_runs br
    JOIN benchmark_results bres ON bres.benchmark_run_id = br.id
    WHERE br.tenant_id = ${tenantId} AND br.created_at >= ${startDateStr}
      AND bres.quality_score IS NOT NULL
    GROUP BY date_trunc('month', br.created_at)
    ORDER BY month
  `);

  // Cast results
  const ratingsRows = ratingsResult as unknown as Record<string, unknown>[];
  const sentimentRows = sentimentResult as unknown as Record<string, unknown>[];
  const benchmarkRows = benchmarkResult as unknown as Record<string, unknown>[];

  // Merge results by month
  const monthMap = new Map<
    string,
    { avgRating: number | null; sentimentPct: number | null; benchmarkScore: number | null }
  >();

  for (const row of ratingsRows) {
    const month = String(row.month);
    const existing = monthMap.get(month) || {
      avgRating: null,
      sentimentPct: null,
      benchmarkScore: null,
    };
    existing.avgRating = Number(row.avg_rating_pct);
    monthMap.set(month, existing);
  }

  for (const row of sentimentRows) {
    const month = String(row.month);
    const existing = monthMap.get(month) || {
      avgRating: null,
      sentimentPct: null,
      benchmarkScore: null,
    };
    existing.sentimentPct = row.sentiment_pct != null ? Number(row.sentiment_pct) : null;
    monthMap.set(month, existing);
  }

  for (const row of benchmarkRows) {
    const month = String(row.month);
    const existing = monthMap.get(month) || {
      avgRating: null,
      sentimentPct: null,
      benchmarkScore: null,
    };
    existing.benchmarkScore = Number(row.avg_benchmark);
    monthMap.set(month, existing);
  }

  // Sort by date ascending and return
  const sortedMonths = Array.from(monthMap.keys()).sort();
  return sortedMonths.map((month) => {
    const data = monthMap.get(month)!;
    return {
      date: month,
      avgRating: data.avgRating,
      sentimentPct: data.sentimentPct,
      benchmarkScore: data.benchmarkScore,
    };
  });
}

// =============================================================================
// IP Risk Analysis Types
// =============================================================================

/**
 * A single at-risk skill alert: single-author, high-usage, no forks
 */
export interface AtRiskSkillAlert {
  skillId: string;
  skillName: string;
  category: string;
  authorId: string;
  authorName: string | null;
  totalUses: number;
  hoursSavedPerUse: number;
  riskLevel: "critical" | "high";
}

/**
 * An employee ranked by IP concentration risk
 */
export interface IpRiskEmployee {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  atRiskSkillCount: number;
  totalAtRiskUses: number;
  totalAtRiskHoursSaved: number;
  highestRiskSeverity: number; // 3=critical, 2=high, 1=medium
  riskLevel: "critical" | "high" | "medium";
}

/**
 * A single at-risk skill for an individual employee drill-down
 */
export interface EmployeeAtRiskSkill {
  skillId: string;
  skillName: string;
  slug: string;
  category: string;
  totalUses: number;
  hoursSavedPerUse: number;
  riskLevel: "critical" | "high";
}

// =============================================================================
// IP Risk Analysis Query Functions
// =============================================================================

/**
 * Get top at-risk skill alerts for the IP dashboard
 *
 * Returns published skills that are single-author, high-usage, and have no
 * published forks -- representing concentrated IP risk.
 *
 * @param tenantId - Tenant ID to filter by
 * @returns Up to 20 at-risk skill alerts, ordered by total uses descending
 */
export async function getAtRiskSkillAlerts(tenantId: string): Promise<AtRiskSkillAlert[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.category,
      s.author_id,
      u.name AS author_name,
      s.total_uses,
      COALESCE(s.hours_saved, 1) AS hours_saved_per_use
    FROM skills s
    JOIN users u ON u.id = s.author_id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.author_id IS NOT NULL
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    ORDER BY s.total_uses DESC
    LIMIT 20
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    skillId: String(row.skill_id),
    skillName: String(row.skill_name),
    category: String(row.category),
    authorId: String(row.author_id),
    authorName: row.author_name ? String(row.author_name) : null,
    totalUses: Number(row.total_uses),
    hoursSavedPerUse: Number(row.hours_saved_per_use),
    riskLevel:
      Number(row.total_uses) >= CRITICAL_USAGE_THRESHOLD
        ? ("critical" as const)
        : ("high" as const),
  }));
}

/**
 * Get employees ranked by IP concentration risk
 *
 * Groups at-risk skills by author and ranks employees by their total
 * at-risk usage exposure. Uses numeric severity for correct MAX aggregation.
 *
 * @param tenantId - Tenant ID to filter by
 * @returns Employees sorted by total at-risk uses descending
 */
export async function getIpRiskEmployees(tenantId: string): Promise<IpRiskEmployee[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.image,
      COUNT(*)::integer AS at_risk_skill_count,
      SUM(s.total_uses)::integer AS total_at_risk_uses,
      SUM(COALESCE(s.hours_saved, 1) * s.total_uses)::double precision AS total_at_risk_hours_saved,
      MAX(CASE
        WHEN s.total_uses >= ${CRITICAL_USAGE_THRESHOLD} THEN 3
        WHEN s.total_uses >= ${HIGH_USAGE_THRESHOLD} THEN 2
        ELSE 1
      END)::integer AS highest_risk_severity
    FROM skills s
    JOIN users u ON u.id = s.author_id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.author_id IS NOT NULL
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    GROUP BY u.id, u.name, u.email, u.image
    ORDER BY total_at_risk_uses DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => {
    const severity = Number(row.highest_risk_severity);
    return {
      userId: String(row.id),
      name: row.name ? String(row.name) : null,
      email: String(row.email),
      image: row.image ? String(row.image) : null,
      atRiskSkillCount: Number(row.at_risk_skill_count),
      totalAtRiskUses: Number(row.total_at_risk_uses),
      totalAtRiskHoursSaved: Number(row.total_at_risk_hours_saved),
      highestRiskSeverity: severity,
      riskLevel:
        severity === 3
          ? ("critical" as const)
          : severity === 2
            ? ("high" as const)
            : ("medium" as const),
    };
  });
}

/**
 * Get at-risk skills for a specific employee (drill-down)
 *
 * Returns the individual at-risk skills owned by a given user,
 * for display in the employee drill-down modal.
 *
 * @param tenantId - Tenant ID to filter by
 * @param userId - The user/author to get at-risk skills for
 * @returns At-risk skills for the given employee, ordered by total uses descending
 */
export async function getEmployeeAtRiskSkills(
  tenantId: string,
  userId: string
): Promise<EmployeeAtRiskSkill[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.slug,
      s.category,
      s.total_uses,
      COALESCE(s.hours_saved, 1) AS hours_saved_per_use
    FROM skills s
    WHERE s.tenant_id = ${tenantId}
      AND s.author_id = ${userId}
      AND s.status = 'published'
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    ORDER BY s.total_uses DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    skillId: String(row.skill_id),
    skillName: String(row.skill_name),
    slug: String(row.slug),
    category: String(row.category),
    totalUses: Number(row.total_uses),
    hoursSavedPerUse: Number(row.hours_saved_per_use),
    riskLevel:
      Number(row.total_uses) >= CRITICAL_USAGE_THRESHOLD
        ? ("critical" as const)
        : ("high" as const),
  }));
}
