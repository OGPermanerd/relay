import { db } from "@relay/db";
import { usageEvents } from "@relay/db/schema";
import { sql, inArray, gte, and } from "drizzle-orm";

interface DailyUsage {
  date: string;
  count: number;
}

/**
 * Get usage trends for multiple skills in a single query
 *
 * Aggregates usage events by day for the last N days.
 * Returns a map of skillId -> array of daily counts.
 *
 * Uses batch query to avoid N+1 problem with skill cards.
 *
 * @param skillIds - Array of skill IDs to fetch trends for
 * @param days - Number of days to look back (default 14)
 * @returns Map of skillId to array of daily usage counts
 */
export async function getUsageTrends(
  skillIds: string[],
  days: number = 14
): Promise<Map<string, number[]>> {
  // Handle null db or empty skillIds
  if (!db || skillIds.length === 0) {
    return new Map();
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Query all usage events for the skills in the date range
  const results = await db
    .select({
      skillId: usageEvents.skillId,
      date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date::text`,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(usageEvents)
    .where(and(inArray(usageEvents.skillId, skillIds), gte(usageEvents.createdAt, startDate)))
    .groupBy(usageEvents.skillId, sql`date_trunc('day', ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Group by skillId
  const bySkill = new Map<string, DailyUsage[]>();
  for (const row of results) {
    if (!row.skillId) continue;
    const existing = bySkill.get(row.skillId) || [];
    existing.push({ date: row.date, count: row.count });
    bySkill.set(row.skillId, existing);
  }

  // Fill gaps and convert to number arrays
  const trendMap = new Map<string, number[]>();

  for (const skillId of skillIds) {
    const dailyData = bySkill.get(skillId) || [];
    const filled = fillMissingDays(dailyData, days);
    trendMap.set(skillId, filled);
  }

  return trendMap;
}

/**
 * Fill missing days with zero counts
 */
function fillMissingDays(data: DailyUsage[], days: number): number[] {
  const result: number[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.count]));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    result.push(dataMap.get(dateStr) || 0);
  }

  return result;
}
