import { db } from "@relay/db";
import { skills, usageEvents } from "@relay/db/schema";
import { sql, gte, eq } from "drizzle-orm";

export interface TotalStats {
  totalDaysSaved: number;
  trendData: number[];
}

/**
 * Get total days saved across all skills and the aggregated trend data
 *
 * @returns Total days saved and 14-day trend data
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
    .from(skills);

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
    .where(gte(usageEvents.createdAt, startDate))
    .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Fill missing days with zeros
  const dataMap = new Map(dailyResults.map((d) => [d.date, d.daysSaved]));
  const trendData: number[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    // Multiply by 10 for sparkline visibility
    trendData.push((dataMap.get(dateStr) || 0) * 10);
  }

  return { totalDaysSaved, trendData };
}
