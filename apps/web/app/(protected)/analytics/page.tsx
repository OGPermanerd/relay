import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { OverviewTab } from "@/components/overview-tab";
import { EmployeesTab } from "@/components/employees-tab";
import { SkillsTab } from "@/components/skills-tab";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { CsvExportButton } from "@/components/csv-export-button";
import {
  getOverviewStats,
  getUsageTrend,
  getEmployeeUsage,
  getSkillUsage,
  getGranularity,
  getStartDate,
  type TimeRange,
} from "@/lib/analytics-queries";

interface AnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  const params = await searchParams;
  const range = (params.range || "30d") as TimeRange;
  const startDate = getStartDate(range);
  const granularity = getGranularity(range);

  // Fetch all data in parallel
  const [overviewStats, trendData, employeeData, skillData] = await Promise.all([
    getOverviewStats(tenantId, startDate),
    getUsageTrend(tenantId, startDate, granularity),
    getEmployeeUsage(tenantId, startDate),
    getSkillUsage(tenantId, startDate),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Org-wide usage trends and employee activity</p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded bg-gray-200" />}>
            <TimeRangeSelector />
          </Suspense>
          <CsvExportButton />
        </div>
      </div>

      {/* Tabs */}
      <AnalyticsTabs
        overviewContent={<OverviewTab stats={overviewStats} trendData={trendData} />}
        employeesContent={<EmployeesTab data={employeeData} />}
        skillsContent={<SkillsTab data={skillData} />}
      />
    </div>
  );
}
