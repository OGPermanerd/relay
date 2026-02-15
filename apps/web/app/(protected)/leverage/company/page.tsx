import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OverviewTab } from "@/components/overview-tab";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { CsvExportButton } from "@/components/csv-export-button";
import {
  getOverviewStats,
  getUsageTrend,
  getGranularity,
  getStartDate,
  type TimeRange,
} from "@/lib/analytics-queries";

export const metadata = { title: "My Company | EverySkill" };

interface CompanyPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function LeverageCompanyPage({ searchParams }: CompanyPageProps) {
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

  const [overviewStats, trendData] = await Promise.all([
    getOverviewStats(tenantId, startDate),
    getUsageTrend(tenantId, startDate, granularity),
  ]);

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-4">
        <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded bg-gray-200" />}>
          <TimeRangeSelector />
        </Suspense>
        <CsvExportButton />
      </div>
      <OverviewTab stats={overviewStats} trendData={trendData} />
    </>
  );
}
