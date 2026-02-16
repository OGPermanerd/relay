"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import {
  getIpDashboardStats,
  getSkillValuationData,
  getIpRiskEmployees,
  getAtRiskSkillAlerts,
  getQualityTrends,
} from "@/lib/ip-dashboard-queries";
import { computeSkillValuations } from "@/lib/ip-valuation";
import type { IpReportData } from "@/lib/ip-valuation";

/**
 * Fetch all data needed for IP report export (PDF/CSV).
 *
 * Requires authenticated admin session. Fetches stats, skill valuations,
 * risk employees, risk alerts, and quality trends in parallel, then
 * computes replacement costs and total IP value.
 *
 * @returns Complete IP report data payload
 * @throws Error if unauthorized or not admin
 */
export async function fetchIpReportData(): Promise<IpReportData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isAdmin(session)) throw new Error("Forbidden");
  const tenantId = session.user.tenantId;
  if (!tenantId) throw new Error("Unauthorized");

  const [stats, rawSkills, riskEmployees, riskAlerts, trends] = await Promise.all([
    getIpDashboardStats(tenantId),
    getSkillValuationData(tenantId),
    getIpRiskEmployees(tenantId),
    getAtRiskSkillAlerts(tenantId),
    getQualityTrends(tenantId, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
  ]);

  const skills = computeSkillValuations(rawSkills);
  const totalValue = skills.reduce((sum, s) => sum + s.replacementCost, 0);

  return { totalValue, stats, skills, riskEmployees, riskAlerts, trends };
}
