import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { IpDashboardView } from "@/components/ip-dashboard-view";
import { TimeRangeSelector } from "@/components/time-range-selector";
import {
  getIpDashboardStats,
  getQualityTrends,
  getIpRiskEmployees,
  getAtRiskSkillAlerts,
} from "@/lib/ip-dashboard-queries";
import { getStartDate, type TimeRange } from "@/lib/analytics-queries";

export const metadata = { title: "IP Dashboard | EverySkill" };

interface IpDashboardPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function IpDashboardPage({ searchParams }: IpDashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!isAdmin(session)) {
    redirect("/leverage");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  const params = await searchParams;
  const range = (params.range || "30d") as TimeRange;
  const startDate = getStartDate(range);

  // Hero stats are all-time (no date filter); quality trends use the time range
  // Risk data is also all-time (not date-filtered)
  const [stats, trendData, riskEmployees, atRiskAlerts] = await Promise.all([
    getIpDashboardStats(tenantId),
    getQualityTrends(tenantId, startDate),
    getIpRiskEmployees(tenantId),
    getAtRiskSkillAlerts(tenantId),
  ]);

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded bg-gray-200" />}>
          <TimeRangeSelector />
        </Suspense>
      </div>
      <IpDashboardView
        stats={stats}
        trendData={trendData}
        riskEmployees={riskEmployees}
        atRiskAlerts={atRiskAlerts}
      />
    </>
  );
}
