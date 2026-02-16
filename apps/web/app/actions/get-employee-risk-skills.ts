"use server";

import { auth } from "@/auth";
import { getEmployeeAtRiskSkills } from "@/lib/ip-dashboard-queries";

/**
 * Server action: Fetch at-risk skills for a specific employee
 *
 * Used by the IP risk drill-down modal to load an individual employee's
 * at-risk skills on demand (not pre-fetched on page load).
 *
 * @param userId - The user ID to fetch at-risk skills for
 * @returns Array of at-risk skills for the given employee
 */
export async function fetchEmployeeRiskSkills(userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) throw new Error("Unauthorized");

  return getEmployeeAtRiskSkills(tenantId, userId);
}
