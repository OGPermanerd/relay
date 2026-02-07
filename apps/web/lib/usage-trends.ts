import { db } from "@everyskill/db";
import { usageEvents, skills } from "@everyskill/db/schema";
import { sql, inArray, gte, and, eq } from "drizzle-orm";

interface DailyDaysSaved {
  date: string;
  daysSaved: number;
}

/**
 * Get cumulative days saved trends for multiple skills in a single query
 *
 * Calculates cumulative "days saved" (uses * hoursSaved / 8) over the last N days.
 * Returns a map of skillId -> array of cumulative days saved values (monotonically increasing).
 *
 * Uses batch query to avoid N+1 problem with skill cards.
 *
 * @param skillIds - Array of skill IDs to fetch trends for
 * @param days - Number of days to look back (default 14)
 * @returns Map of skillId to array of cumulative days saved values
 */
export async function getUsageTrends(
  skillIds: string[],
  days: number = 14
): Promise<Map<string, number[]>> {
  // Handle null db or empty skillIds
  if (!db || skillIds.length === 0) {
    return new Map();
  }

  // Use a fixed reference date (start of today in UTC) to avoid hydration mismatches
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  // Query usage events joined with skills to calculate days saved per day
  // Formula: count * hoursSaved / 8 = days saved
  const results = await db
    .select({
      skillId: usageEvents.skillId,
      date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date::text`,
      daysSaved: sql<number>`cast(count(*) * coalesce(${skills.hoursSaved}, 1) / 8.0 as float)`,
    })
    .from(usageEvents)
    .innerJoin(skills, eq(usageEvents.skillId, skills.id))
    .where(and(inArray(usageEvents.skillId, skillIds), gte(usageEvents.createdAt, startDate)))
    .groupBy(
      usageEvents.skillId,
      sql`date_trunc('day', ${usageEvents.createdAt})`,
      skills.hoursSaved
    )
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Group by skillId
  const bySkill = new Map<string, DailyDaysSaved[]>();
  for (const row of results) {
    if (!row.skillId) continue;
    const existing = bySkill.get(row.skillId) || [];
    existing.push({ date: row.date, daysSaved: row.daysSaved });
    bySkill.set(row.skillId, existing);
  }

  // Fill gaps and convert to number arrays using consistent date
  const trendMap = new Map<string, number[]>();

  for (const skillId of skillIds) {
    const dailyData = bySkill.get(skillId) || [];
    const filled = fillMissingDays(dailyData, days, today);
    trendMap.set(skillId, filled);
  }

  return trendMap;
}

/**
 * Fill missing days and convert to cumulative values
 * Returns monotonically increasing values representing total hours saved over time
 */
function fillMissingDays(data: DailyDaysSaved[], days: number, referenceDate: Date): number[] {
  const daily: number[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.daysSaved]));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    daily.push(dataMap.get(dateStr) || 0);
  }

  // Convert to cumulative sum (monotonically increasing)
  const cumulative: number[] = [];
  let total = 0;
  for (const value of daily) {
    total += value;
    cumulative.push(total);
  }

  return cumulative;
}
