import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

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
