"use client";

import { StatCard } from "./stat-card";
import { QualityTrendChart } from "./quality-trend-chart";
import { IpRiskSection } from "./ip-risk-section";
import { IpValuationTable } from "./ip-valuation-table";
import { IpExportButtons } from "./ip-export-buttons";
import type {
  IpDashboardStats,
  QualityTrendPoint,
  AtRiskSkillAlert,
  IpRiskEmployee,
} from "@/lib/ip-dashboard-queries";
import type { SkillValuation } from "@/lib/ip-valuation";

// ---------------------------------------------------------------------------
// Icons for stat cards
// ---------------------------------------------------------------------------

const DatabaseIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75"
    />
  </svg>
);

const ChartBarIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const UserGroupIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
    />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Format a number with commas (hydration-safe, no toLocaleString on numbers) */
function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IpDashboardViewProps {
  stats: IpDashboardStats;
  trendData: QualityTrendPoint[];
  riskEmployees: IpRiskEmployee[];
  atRiskAlerts: AtRiskSkillAlert[];
  totalIpValue: number;
  skills: SkillValuation[];
}

export function IpDashboardView({
  stats,
  trendData,
  riskEmployees,
  atRiskAlerts,
  totalIpValue,
  skills,
}: IpDashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* Hero Stat Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Estimated IP Value"
          value={`$${formatNumber(totalIpValue)}`}
          icon={<CurrencyIcon />}
        />
        <StatCard
          label="Skills Captured"
          value={stats.totalSkillsCaptured}
          icon={<DatabaseIcon />}
        />
        <StatCard
          label="Total Uses"
          value={formatNumber(stats.totalUses)}
          icon={<ChartBarIcon />}
        />
        <StatCard
          label="Hours Saved"
          value={stats.totalHoursSaved.toFixed(1)}
          icon={<ClockIcon />}
        />
        <StatCard
          label="Active Contributors"
          value={stats.activeContributors}
          icon={<UserGroupIcon />}
        />
      </div>

      {/* IP Valuation Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">IP Valuation</h3>
          <IpExportButtons />
        </div>
        <IpValuationTable skills={skills} />
      </div>

      {/* IP Risk Section (alerts + employee risk table) */}
      <IpRiskSection riskEmployees={riskEmployees} atRiskAlerts={atRiskAlerts} />

      {/* Quality Trends Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-medium text-gray-500">Quality Trends</h3>
        <QualityTrendChart data={trendData} />
      </div>
    </div>
  );
}
