import { db } from "@relay/db";
import { skills, usageEvents } from "@relay/db/schema";
import { sql, gte, eq } from "drizzle-orm";

export interface PlatformStatTrends {
  fteDaysTrend: number[];
  usesTrend: number[];
  downloadsTrend: number[];
}

/**
 * Get 14-day cumulative trend data per metric for platform stat sparklines.
 *
 * Queries usage_events joined to skills for the last 14 days, grouped by day.
 * Returns cumulative arrays (monotonically increasing) for FTE days, uses, and downloads.
 */
export async function getPlatformStatTrends(): Promise<PlatformStatTrends> {
  if (!db) {
    return { fteDaysTrend: [], usesTrend: [], downloadsTrend: [] };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 14);

  const dailyResults = await db
    .select({
      date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date::text`,
      daysSaved: sql<number>`cast(sum(coalesce(${skills.hoursSaved}, 1)) / 8.0 as float)`,
      uses: sql<number>`count(*)`,
    })
    .from(usageEvents)
    .innerJoin(skills, eq(usageEvents.skillId, skills.id))
    .where(gte(usageEvents.createdAt, startDate))
    .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Fill missing days
  const dataMap = new Map(
    dailyResults.map((d) => [d.date, { daysSaved: d.daysSaved, uses: Number(d.uses) }])
  );

  const dailyDays: number[] = [];
  const dailyUses: number[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const entry = dataMap.get(dateStr);
    dailyDays.push(entry?.daysSaved || 0);
    dailyUses.push(entry?.uses || 0);
  }

  // Convert to cumulative sums
  const fteDaysTrend: number[] = [];
  const usesTrend: number[] = [];
  let totalDays = 0;
  let totalUses = 0;
  for (let i = 0; i < dailyDays.length; i++) {
    totalDays += dailyDays[i];
    totalUses += dailyUses[i];
    fteDaysTrend.push(totalDays);
    usesTrend.push(totalUses);
  }

  // Downloads same as uses
  return { fteDaysTrend, usesTrend, downloadsTrend: usesTrend };
}
