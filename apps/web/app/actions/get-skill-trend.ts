"use server";

import { auth } from "@/auth";
import {
  getSkillTrend,
  getStartDate,
  getGranularity,
  type TimeRange,
} from "@/lib/analytics-queries";

export interface SkillTrendPoint {
  date: string;
  usageCount: number;
}

export async function fetchSkillTrend(
  skillId: string,
  range: TimeRange
): Promise<SkillTrendPoint[]> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const startDate = getStartDate(range);
  const granularity = getGranularity(range);
  const trend = await getSkillTrend(skillId, startDate, granularity);
  return trend;
}
