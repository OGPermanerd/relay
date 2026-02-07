import { db } from "@everyskill/db";
import { usageEvents, skills } from "@everyskill/db/schema";
import { sql, eq, gte, and } from "drizzle-orm";

export interface SkillDetailTrends {
  usesTrend: number[];
  usersTrend: number[];
  daysSavedTrend: number[];
}

/**
 * Get cumulative trend data for a skill's detail page
 *
 * Returns 14-day cumulative trends for:
 * - Total uses (monotonically increasing)
 * - Unique users (monotonically increasing)
 * - FTE days saved (monotonically increasing)
 *
 * @param skillId - The skill ID to fetch trends for
 * @returns Cumulative trend arrays for sparklines
 */
export async function getSkillDetailTrends(skillId: string): Promise<SkillDetailTrends> {
  if (!db) {
    return { usesTrend: [], usersTrend: [], daysSavedTrend: [] };
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 14);

  // Get skill's hoursSaved for days saved calculation
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { hoursSaved: true },
  });
  const hoursSaved = skill?.hoursSaved ?? 1;

  // Get daily uses and unique users
  const dailyResults = await db
    .select({
      date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date::text`,
      uses: sql<number>`cast(count(*) as integer)`,
      users: sql<number>`cast(count(distinct ${usageEvents.userId}) as integer)`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.skillId, skillId), gte(usageEvents.createdAt, startDate)))
    .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Build data map
  const dataMap = new Map(dailyResults.map((d) => [d.date, { uses: d.uses, users: d.users }]));

  // Fill missing days and calculate cumulative values
  const usesTrend: number[] = [];
  const usersTrend: number[] = [];
  const daysSavedTrend: number[] = [];

  let cumulativeUses = 0;
  let cumulativeUsers = 0;
  let cumulativeDaysSaved = 0;

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayData = dataMap.get(dateStr) || { uses: 0, users: 0 };
    cumulativeUses += dayData.uses;
    cumulativeUsers += dayData.users;
    cumulativeDaysSaved += (dayData.uses * hoursSaved) / 8;

    usesTrend.push(cumulativeUses);
    usersTrend.push(cumulativeUsers);
    daysSavedTrend.push(cumulativeDaysSaved);
  }

  return { usesTrend, usersTrend, daysSavedTrend };
}
