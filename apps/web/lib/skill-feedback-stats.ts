import { db } from "@everyskill/db";
import { skillFeedback } from "@everyskill/db/schema";
import { eq, sql, gte, and } from "drizzle-orm";

export interface SkillFeedbackStats {
  totalFeedback: number;
  positivePct: number | null;
  last30DaysTotal: number;
  last30DaysPositivePct: number | null;
  feedbackTrend: number[]; // 14-day trend of daily feedback count
}

/**
 * Get feedback statistics for a skill's detail page.
 *
 * Returns all-time and last-30-day thumbs up/down counts + percentages,
 * plus a 14-day daily feedback count trend for sparklines.
 */
export async function getSkillFeedbackStats(skillId: string): Promise<SkillFeedbackStats> {
  if (!db) {
    return {
      totalFeedback: 0,
      positivePct: null,
      last30DaysTotal: 0,
      last30DaysPositivePct: null,
      feedbackTrend: [],
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const thumbsFilter = and(
    eq(skillFeedback.skillId, skillId),
    sql`${skillFeedback.feedbackType} IN ('thumbs_up', 'thumbs_down')`
  );

  // Run all-time, last-30-day, and 14-day trend queries in parallel
  const [allTimeResult, last30Result, trendResults] = await Promise.all([
    // All-time thumbs counts
    db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        positive: sql<number>`cast(count(*) filter (where ${skillFeedback.feedbackType} = 'thumbs_up') as integer)`,
      })
      .from(skillFeedback)
      .where(thumbsFilter),

    // Last 30 days thumbs counts
    db
      .select({
        total: sql<number>`cast(count(*) as integer)`,
        positive: sql<number>`cast(count(*) filter (where ${skillFeedback.feedbackType} = 'thumbs_up') as integer)`,
      })
      .from(skillFeedback)
      .where(and(thumbsFilter, gte(skillFeedback.createdAt, thirtyDaysAgo))),

    // 14-day daily feedback count trend
    (() => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      return db
        .select({
          date: sql<string>`date_trunc('day', ${skillFeedback.createdAt})::date::text`,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(skillFeedback)
        .where(
          and(
            eq(skillFeedback.skillId, skillId),
            sql`${skillFeedback.feedbackType} IN ('thumbs_up', 'thumbs_down')`,
            gte(skillFeedback.createdAt, fourteenDaysAgo)
          )
        )
        .groupBy(sql`date_trunc('day', ${skillFeedback.createdAt})`)
        .orderBy(sql`date_trunc('day', ${skillFeedback.createdAt})`);
    })(),
  ]);

  const allTime = allTimeResult[0] ?? { total: 0, positive: 0 };
  const last30 = last30Result[0] ?? { total: 0, positive: 0 };

  // Build 14-day trend with missing days filled as 0
  const trendMap = new Map(trendResults.map((d) => [d.date, d.count]));
  const feedbackTrend: number[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    feedbackTrend.push(trendMap.get(dateStr) ?? 0);
  }

  return {
    totalFeedback: allTime.total,
    positivePct: allTime.total > 0 ? Math.round((allTime.positive / allTime.total) * 100) : null,
    last30DaysTotal: last30.total,
    last30DaysPositivePct:
      last30.total > 0 ? Math.round((last30.positive / last30.total) * 100) : null,
    feedbackTrend,
  };
}
