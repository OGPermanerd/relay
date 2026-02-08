import { db } from "@everyskill/db";
import { skills, usageEvents } from "@everyskill/db/schema";
import { sql, gte, eq, and } from "drizzle-orm";

export interface TotalStats {
  totalDaysSaved: number;
  trendData: number[];
}

/**
 * Get total days saved across all skills and the aggregated cumulative trend data
 *
 * @returns Total days saved and 14-day cumulative trend data (monotonically increasing)
 */
export async function getTotalStats(): Promise<TotalStats> {
  if (!db) {
    return { totalDaysSaved: 0, trendData: [] };
  }

  // Get total days saved across all skills
  const totalResult = await db
    .select({
      totalDaysSaved: sql<number>`coalesce(sum(${skills.totalUses} * coalesce(${skills.hoursSaved}, 1) / 8.0), 0)`,
    })
    .from(skills)
    .where(eq(skills.status, "published"));

  const totalDaysSaved = Math.round(totalResult[0]?.totalDaysSaved || 0);

  // Get aggregated daily days saved for last 14 days
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 14);

  const dailyResults = await db
    .select({
      date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date::text`,
      daysSaved: sql<number>`cast(sum(coalesce(${skills.hoursSaved}, 1)) / 8.0 as float)`,
    })
    .from(usageEvents)
    .innerJoin(skills, eq(usageEvents.skillId, skills.id))
    .where(and(gte(usageEvents.createdAt, startDate), eq(skills.status, "published")))
    .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Fill missing days and convert to cumulative
  const dataMap = new Map(dailyResults.map((d) => [d.date, d.daysSaved]));
  const daily: number[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    daily.push(dataMap.get(dateStr) || 0);
  }

  // Convert to cumulative sum (monotonically increasing)
  const trendData: number[] = [];
  let total = 0;
  for (const value of daily) {
    total += value;
    trendData.push(total);
  }

  return { totalDaysSaved, trendData };
}
