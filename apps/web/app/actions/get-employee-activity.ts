"use server";

import { auth } from "@/auth";
import { getEmployeeActivity, getStartDate, type TimeRange } from "@/lib/analytics-queries";

export interface ActivityEvent {
  date: string;
  skillName: string;
  skillId: string;
  action: string;
  hoursSaved: number;
}

/**
 * Fetch employee activity for drill-down modal
 *
 * @param userId - The user ID to fetch activity for
 * @param range - Time range filter (7d, 30d, 90d, 1y)
 * @returns Array of activity events
 */
export async function fetchEmployeeActivity(
  userId: string,
  range: TimeRange
): Promise<ActivityEvent[]> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) throw new Error("Unauthorized");

  const startDate = getStartDate(range);
  const activity = await getEmployeeActivity(tenantId, userId, startDate);

  // Map the result to ensure consistent types
  return activity.map((event) => ({
    date: event.date,
    skillName: event.skillName ?? "Unknown Skill",
    skillId: event.skillId ?? "",
    action: event.action,
    hoursSaved: event.hoursSaved,
  }));
}
