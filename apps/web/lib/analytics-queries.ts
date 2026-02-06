import { db } from "@relay/db";
import { sql } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export type TimeRange = "7d" | "30d" | "90d" | "1y";

export type Granularity = "day" | "week" | "month";

/**
 * Overview statistics for the org-wide analytics dashboard
 */
export interface OverviewStats {
  totalHoursSaved: number;
  activeEmployees: number;
  skillsDeployed: number;
  deploymentsThisPeriod: number;
  mostUsedSkill: string | null;
  highestSaver: string | null;
}

/**
 * Single data point in the usage trend time series
 */
export interface UsageTrendPoint {
  date: string; // ISO date string
  hoursSaved: number;
}

/**
 * Employee usage data for the analytics table
 */
export interface EmployeeUsageRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  skillsUsed: number;
  usageFrequency: number;
  hoursSaved: number;
  lastActive: string; // ISO date string
  topSkill: string | null;
}

/**
 * Employee breakdown entry for skill usage
 */
export interface EmployeeBreakdownEntry {
  userId: string;
  userName: string | null;
  usageCount: number;
}

/**
 * Skill usage data for the leaderboard
 */
export interface SkillUsageRow {
  skillId: string;
  name: string;
  category: string;
  authorName: string | null;
  usageCount: number;
  uniqueUsers: number;
  hoursSaved: number;
  employeeBreakdown: EmployeeBreakdownEntry[];
}

/**
 * Export data row for CSV download
 */
export interface ExportDataRow {
  date: string;
  employeeName: string | null;
  employeeEmail: string;
  skillName: string | null;
  category: string | null;
  action: string;
  hoursSaved: number;
}

/**
 * Single activity entry for employee drill-down modal
 */
export interface EmployeeActivityEntry {
  date: string; // ISO date string
  skillName: string | null;
  skillId: string | null;
  action: string;
  hoursSaved: number;
}

/**
 * Single data point in the skill trend time series
 */
export interface SkillTrendPoint {
  date: string; // ISO date string
  usageCount: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get appropriate granularity for a time range
 * - 7d/30d: daily data points
 * - 90d: weekly data points
 * - 1y: monthly data points
 */
export function getGranularity(range: TimeRange): Granularity {
  switch (range) {
    case "7d":
    case "30d":
      return "day";
    case "90d":
      return "week";
    case "1y":
      return "month";
  }
}

/**
 * Calculate start date from a time range
 */
export function getStartDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

/**
 * Fill missing dates in time series with zero values
 */
function fillMissingDates(
  data: { date: string; value: number }[],
  startDate: Date,
  granularity: Granularity
): { date: string; value: number }[] {
  const dataMap = new Map(data.map((d) => [d.date, d.value]));
  const result: { date: string; value: number }[] = [];
  const now = new Date();

  // Set time to start of day in UTC
  const current = new Date(startDate.toISOString().split("T")[0] + "T00:00:00.000Z");
  const end = new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    result.push({ date: dateStr, value: dataMap.get(dateStr) || 0 });

    // Advance to next period
    switch (granularity) {
      case "day":
        current.setDate(current.getDate() + 1);
        break;
      case "week":
        current.setDate(current.getDate() + 7);
        break;
      case "month":
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return result;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get overview statistics for the org-wide analytics dashboard
 *
 * Returns aggregate stats including total hours saved, active employees,
 * skills deployed, and highlights (most used skill, highest saver).
 * Uses COALESCE fallback chain: rating estimate -> creator estimate -> 1.
 *
 * @param orgId - Organization ID to filter by
 * @param startDate - Start date for time filtering
 * @returns Overview statistics
 */
export async function getOverviewStats(orgId: string, startDate: Date): Promise<OverviewStats> {
  if (!db) {
    return {
      totalHoursSaved: 0,
      activeEmployees: 0,
      skillsDeployed: 0,
      deploymentsThisPeriod: 0,
      mostUsedSkill: null,
      highestSaver: null,
    };
  }

  const startDateStr = startDate.toISOString();
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0)::double precision AS total_hours_saved,
      COUNT(DISTINCT ue.user_id)::integer AS active_employees,
      COUNT(DISTINCT ue.skill_id)::integer AS skills_deployed,
      COUNT(*)::integer AS deployments_this_period,
      (
        SELECT s2.name
        FROM usage_events ue2
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        LEFT JOIN users u2 ON u2.id = ue2.user_id
        WHERE ue2.user_id IS NOT NULL
          AND u2.email LIKE '%@' || (SELECT split_part(u3.email, '@', 2) FROM users u3 WHERE u3.id = ${orgId} LIMIT 1)
          AND ue2.created_at >= ${startDateStr}
        GROUP BY ue2.skill_id, s2.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS most_used_skill,
      (
        SELECT u4.name
        FROM usage_events ue3
        LEFT JOIN skills s3 ON s3.id = ue3.skill_id
        LEFT JOIN ratings r3 ON r3.skill_id = ue3.skill_id AND r3.user_id = ue3.user_id
        LEFT JOIN users u4 ON u4.id = ue3.user_id
        WHERE ue3.user_id IS NOT NULL
          AND u4.email LIKE '%@' || (SELECT split_part(u5.email, '@', 2) FROM users u5 WHERE u5.id = ${orgId} LIMIT 1)
          AND ue3.created_at >= ${startDateStr}
        GROUP BY ue3.user_id, u4.name
        ORDER BY SUM(COALESCE(r3.hours_saved_estimate, s3.hours_saved, 1)) DESC
        LIMIT 1
      ) AS highest_saver
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    LEFT JOIN users u ON u.id = ue.user_id
    WHERE ue.user_id IS NOT NULL
      AND u.email LIKE '%@' || (SELECT split_part(u6.email, '@', 2) FROM users u6 WHERE u6.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  return {
    totalHoursSaved: Number(row?.total_hours_saved ?? 0),
    activeEmployees: Number(row?.active_employees ?? 0),
    skillsDeployed: Number(row?.skills_deployed ?? 0),
    deploymentsThisPeriod: Number(row?.deployments_this_period ?? 0),
    mostUsedSkill: row?.most_used_skill ? String(row.most_used_skill) : null,
    highestSaver: row?.highest_saver ? String(row.highest_saver) : null,
  };
}

/**
 * Get usage trend time series for the org
 *
 * Returns hours saved per time period (day/week/month) for charting.
 * Fills missing periods with zero values.
 *
 * @param orgId - Organization ID to filter by
 * @param startDate - Start date for time filtering
 * @param granularity - Time grouping: day, week, or month
 * @returns Array of usage trend data points
 */
export async function getUsageTrend(
  orgId: string,
  startDate: Date,
  granularity: Granularity
): Promise<UsageTrendPoint[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();
  const gran = sql.raw(`'${granularity}'`);
  const result = await db.execute(sql`
    SELECT
      date_trunc(${gran}, ue.created_at)::date::text AS date,
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0)::double precision AS hours_saved
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    LEFT JOIN users u ON u.id = ue.user_id
    WHERE ue.user_id IS NOT NULL
      AND u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
    GROUP BY date_trunc(${gran}, ue.created_at)
    ORDER BY date_trunc(${gran}, ue.created_at)
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const rawData = rows.map((row) => ({
    date: String(row.date),
    value: Number(row.hours_saved),
  }));

  const filledData = fillMissingDates(rawData, startDate, granularity);

  return filledData.map((d) => ({
    date: d.date,
    hoursSaved: d.value,
  }));
}

/**
 * Get per-employee usage data for the analytics table
 *
 * Returns usage metrics for each employee in the org, including
 * skills used, usage frequency, hours saved, and top skill.
 *
 * @param orgId - Organization ID to filter by
 * @param startDate - Start date for time filtering
 * @returns Array of employee usage rows
 */
export async function getEmployeeUsage(
  orgId: string,
  startDate: Date
): Promise<EmployeeUsageRow[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.image,
      COUNT(DISTINCT ue.skill_id)::integer AS skills_used,
      COUNT(*)::integer AS usage_frequency,
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0)::double precision AS hours_saved,
      MAX(ue.created_at) AS last_active,
      (
        SELECT s2.name
        FROM usage_events ue2
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.user_id = u.id
          AND ue2.created_at >= ${startDateStr}
        GROUP BY ue2.skill_id, s2.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS top_skill
    FROM users u
    JOIN usage_events ue ON ue.user_id = u.id
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
    GROUP BY u.id, u.name, u.email, u.image
    ORDER BY hours_saved DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name ? String(row.name) : null,
    email: String(row.email),
    image: row.image ? String(row.image) : null,
    skillsUsed: Number(row.skills_used),
    usageFrequency: Number(row.usage_frequency),
    hoursSaved: Number(row.hours_saved),
    lastActive: new Date(String(row.last_active)).toISOString(),
    topSkill: row.top_skill ? String(row.top_skill) : null,
  }));
}

/**
 * Get skill usage data for the leaderboard
 *
 * Returns usage metrics for each skill used by the org, including
 * usage count, unique users, hours saved, and employee breakdown.
 *
 * @param orgId - Organization ID to filter by
 * @param startDate - Start date for time filtering
 * @returns Array of skill usage rows
 */
export async function getSkillUsage(orgId: string, startDate: Date): Promise<SkillUsageRow[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();

  // First, get the main skill stats
  const mainResult = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name,
      s.category,
      author.name AS author_name,
      COUNT(*)::integer AS usage_count,
      COUNT(DISTINCT ue.user_id)::integer AS unique_users,
      (COUNT(*) * COALESCE(s.hours_saved, 1))::double precision AS hours_saved
    FROM usage_events ue
    JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN users author ON author.id = s.author_id
    LEFT JOIN users u ON u.id = ue.user_id
    WHERE ue.user_id IS NOT NULL
      AND u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
    GROUP BY s.id, s.name, s.category, author.name
    ORDER BY usage_count DESC
  `);

  const mainRows = mainResult as unknown as Record<string, unknown>[];

  // Then, get employee breakdown for each skill
  const skillIds = mainRows.map((row) => String(row.skill_id));

  if (skillIds.length === 0) {
    return [];
  }

  const skillIdList = sql.join(
    skillIds.map((id) => sql`${id}`),
    sql`, `
  );
  const breakdownResult = await db.execute(sql`
    SELECT
      ue.skill_id,
      ue.user_id,
      u.name AS user_name,
      COUNT(*)::integer AS usage_count
    FROM usage_events ue
    JOIN users u ON u.id = ue.user_id
    WHERE ue.skill_id IN (${skillIdList})
      AND u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
    GROUP BY ue.skill_id, ue.user_id, u.name
    ORDER BY usage_count DESC
  `);

  const breakdownRows = breakdownResult as unknown as Record<string, unknown>[];

  // Group breakdown by skill
  const breakdownBySkill = new Map<string, EmployeeBreakdownEntry[]>();
  for (const row of breakdownRows) {
    const skillId = String(row.skill_id);
    const entry: EmployeeBreakdownEntry = {
      userId: String(row.user_id),
      userName: row.user_name ? String(row.user_name) : null,
      usageCount: Number(row.usage_count),
    };
    const existing = breakdownBySkill.get(skillId) || [];
    existing.push(entry);
    breakdownBySkill.set(skillId, existing);
  }

  return mainRows.map((row) => ({
    skillId: String(row.skill_id),
    name: String(row.name),
    category: String(row.category),
    authorName: row.author_name ? String(row.author_name) : null,
    usageCount: Number(row.usage_count),
    uniqueUsers: Number(row.unique_users),
    hoursSaved: Number(row.hours_saved),
    employeeBreakdown: breakdownBySkill.get(String(row.skill_id)) || [],
  }));
}

/**
 * Get full dataset for CSV export
 *
 * Returns all usage events with details for export.
 *
 * @param orgId - Organization ID to filter by
 * @param startDate - Start date for time filtering
 * @returns Array of export data rows
 */
export async function getExportData(orgId: string, startDate: Date): Promise<ExportDataRow[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();
  const result = await db.execute(sql`
    SELECT
      ue.created_at AS date,
      u.name AS employee_name,
      u.email AS employee_email,
      s.name AS skill_name,
      s.category,
      ue.tool_name AS action,
      COALESCE(r.hours_saved_estimate, s.hours_saved, 1)::double precision AS hours_saved
    FROM usage_events ue
    LEFT JOIN users u ON u.id = ue.user_id
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.user_id IS NOT NULL
      AND u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
    ORDER BY ue.created_at DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    date: new Date(String(row.date)).toISOString(),
    employeeName: row.employee_name ? String(row.employee_name) : null,
    employeeEmail: String(row.employee_email),
    skillName: row.skill_name ? String(row.skill_name) : null,
    category: row.category ? String(row.category) : null,
    action: String(row.action),
    hoursSaved: Number(row.hours_saved),
  }));
}

/**
 * Get recent activity for a specific employee (drill-down modal)
 *
 * Returns recent usage events for one employee, ordered by date.
 *
 * @param userId - User ID to get activity for
 * @param startDate - Start date for time filtering
 * @returns Array of activity entries
 */
export async function getEmployeeActivity(
  userId: string,
  startDate: Date
): Promise<EmployeeActivityEntry[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();
  const result = await db.execute(sql`
    SELECT
      ue.created_at AS date,
      s.name AS skill_name,
      ue.skill_id,
      ue.tool_name AS action,
      COALESCE(r.hours_saved_estimate, s.hours_saved, 1)::double precision AS hours_saved
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.user_id = ${userId}
      AND ue.created_at >= ${startDateStr}
    ORDER BY ue.created_at DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  return rows.map((row) => ({
    date: new Date(String(row.date)).toISOString(),
    skillName: row.skill_name ? String(row.skill_name) : null,
    skillId: row.skill_id ? String(row.skill_id) : null,
    action: String(row.action),
    hoursSaved: Number(row.hours_saved),
  }));
}

/**
 * Get usage trend time series for a specific skill (drill-down modal)
 *
 * Returns usage count per time period for one skill.
 * Fills missing periods with zero values.
 *
 * @param skillId - Skill ID to get trend for
 * @param startDate - Start date for time filtering
 * @param granularity - Time grouping: day, week, or month
 * @returns Array of skill trend data points
 */
export async function getSkillTrend(
  skillId: string,
  startDate: Date,
  granularity: Granularity
): Promise<SkillTrendPoint[]> {
  if (!db) {
    return [];
  }

  const startDateStr = startDate.toISOString();
  const gran = sql.raw(`'${granularity}'`);
  const result = await db.execute(sql`
    SELECT
      date_trunc(${gran}, ue.created_at)::date::text AS date,
      COUNT(*)::integer AS usage_count
    FROM usage_events ue
    WHERE ue.skill_id = ${skillId}
      AND ue.created_at >= ${startDateStr}
    GROUP BY date_trunc(${gran}, ue.created_at)
    ORDER BY date_trunc(${gran}, ue.created_at)
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const rawData = rows.map((row) => ({
    date: String(row.date),
    value: Number(row.usage_count),
  }));

  const filledData = fillMissingDates(rawData, startDate, granularity);

  return filledData.map((d) => ({
    date: d.date,
    usageCount: d.value,
  }));
}
