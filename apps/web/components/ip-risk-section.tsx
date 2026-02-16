"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  useIpRiskSortState,
  type IpRiskSortColumn,
  type SortDirection,
} from "@/hooks/use-analytics-sort";
import { fetchEmployeeRiskSkills } from "@/app/actions/get-employee-risk-skills";
import type {
  AtRiskSkillAlert,
  IpRiskEmployee,
  EmployeeAtRiskSkill,
} from "@/lib/ip-dashboard-queries";

// Inline threshold constants to avoid importing the server-only queries module
// at runtime. These must stay in sync with ip-dashboard-queries.ts.
const HIGH_USAGE_THRESHOLD = 10;
const CRITICAL_USAGE_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Risk Badge
// ---------------------------------------------------------------------------

const RISK_STYLES = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
} as const;

function RiskBadge({ level }: { level: "critical" | "high" | "medium" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLES[level]}`}
    >
      {level === "critical" ? "Critical" : level === "high" ? "High" : "Medium"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const WarningIcon = ({ className }: { className?: string }) => (
  <svg
    className={className || "h-5 w-5"}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface IpRiskSectionProps {
  riskEmployees: IpRiskEmployee[];
  atRiskAlerts: AtRiskSkillAlert[];
}

export function IpRiskSection({ riskEmployees, atRiskAlerts }: IpRiskSectionProps) {
  const { sortBy, sortDir, toggleSort } = useIpRiskSortState();
  const [selectedEmployee, setSelectedEmployee] = useState<IpRiskEmployee | null>(null);

  // Client-side sort
  const sortedEmployees = useMemo(() => {
    return [...riskEmployees].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() ?? "";
          bVal = b.name?.toLowerCase() ?? "";
          break;
        case "atRiskSkillCount":
          aVal = a.atRiskSkillCount;
          bVal = b.atRiskSkillCount;
          break;
        case "totalAtRiskUses":
          aVal = a.totalAtRiskUses;
          bVal = b.totalAtRiskUses;
          break;
        case "totalAtRiskHoursSaved":
          aVal = a.totalAtRiskHoursSaved;
          bVal = b.totalAtRiskHoursSaved;
          break;
        case "riskLevel":
          aVal = a.highestRiskSeverity;
          bVal = b.highestRiskSeverity;
          break;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [riskEmployees, sortBy, sortDir]);

  const MAX_VISIBLE_ALERTS = 5;
  const visibleAlerts = atRiskAlerts.slice(0, MAX_VISIBLE_ALERTS);
  const remainingAlertCount = Math.max(0, atRiskAlerts.length - MAX_VISIBLE_ALERTS);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section 1: Key Person Dependency Alerts                           */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-500">Key Person Dependency Alerts</h3>
          <span
            className="text-xs text-gray-400"
            title={`Skills with ${CRITICAL_USAGE_THRESHOLD}+ uses are critical risk; ${HIGH_USAGE_THRESHOLD}+ uses are high risk`}
          >
            (single-author, high-usage, no forks)
          </span>
        </div>

        {atRiskAlerts.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <div className="text-center">
              <WarningIcon className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No key person dependency risks detected</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.skillId}
                  className={`rounded-lg border p-4 ${
                    alert.riskLevel === "critical"
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <WarningIcon
                        className={`h-5 w-5 flex-shrink-0 ${
                          alert.riskLevel === "critical" ? "text-red-500" : "text-amber-500"
                        }`}
                      />
                      <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {alert.skillName}
                      </span>
                    </div>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <div className="mt-2 space-y-1 pl-7">
                    <p className="text-xs text-gray-600">
                      Sole author:{" "}
                      <span className="font-medium">{alert.authorName || "Unknown"}</span>
                    </p>
                    <p className="text-xs text-gray-600">
                      {alert.totalUses} uses &middot; {alert.hoursSavedPerUse.toFixed(1)} hrs/use
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {remainingAlertCount > 0 && (
              <p className="text-xs text-gray-500">
                and {remainingAlertCount} more at-risk skill{remainingAlertCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 2: Employee IP Concentration Risk Table                   */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-500">
          IP Concentration Risk by Employee
        </h3>

        {riskEmployees.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <p className="text-sm text-gray-500">No employees with concentrated IP risk</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <RiskSortHeader
                    column="name"
                    label="Employee"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <RiskSortHeader
                    column="atRiskSkillCount"
                    label="At-Risk Skills"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <RiskSortHeader
                    column="totalAtRiskUses"
                    label="Total At-Risk Uses"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <RiskSortHeader
                    column="totalAtRiskHoursSaved"
                    label="Hours at Risk"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <RiskSortHeader
                    column="riskLevel"
                    label="Risk Level"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedEmployees.map((employee) => (
                  <tr
                    key={employee.userId}
                    onClick={() => setSelectedEmployee(employee)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        {employee.image ? (
                          <Image
                            src={employee.image}
                            alt=""
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                            {employee.name?.charAt(0) || employee.email.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">
                          {employee.name || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {employee.atRiskSkillCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {employee.totalAtRiskUses}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {employee.totalAtRiskHoursSaved.toFixed(1)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <RiskBadge level={employee.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section 3: Drill-Down Modal                                       */}
      {/* ----------------------------------------------------------------- */}
      {selectedEmployee && (
        <RiskDrillDownModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drill-Down Modal
// ---------------------------------------------------------------------------

function RiskDrillDownModal({
  employee,
  onClose,
}: {
  employee: IpRiskEmployee;
  onClose: () => void;
}) {
  const [skills, setSkills] = useState<EmployeeAtRiskSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchEmployeeRiskSkills(employee.userId)
      .then(setSkills)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [employee.userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-4">
            {employee.image ? (
              <Image src={employee.image} alt="" width={48} height={48} className="rounded-full" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-medium text-gray-600">
                {employee.name?.charAt(0) || employee.email.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{employee.name || "Unknown"}</h2>
              <p className="text-sm text-gray-500">{employee.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-900">{employee.atRiskSkillCount}</p>
            <p className="text-sm text-gray-500">At-Risk Skills</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-2xl font-bold text-gray-900">{employee.totalAtRiskUses}</p>
            <p className="text-sm text-gray-500">Total Uses</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-2xl font-bold text-red-600">
              {employee.totalAtRiskHoursSaved.toFixed(1)}
            </p>
            <p className="text-sm text-gray-500">Hours at Risk</p>
          </div>
        </div>

        {/* At-Risk Skills List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-500">At-Risk Skills</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <SpinnerIcon />
            </div>
          ) : skills.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No at-risk skills found</p>
          ) : (
            <div className="space-y-2">
              {skills.map((skill) => (
                <div
                  key={skill.skillId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/skills/${skill.slug}`}
                        className="truncate text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {skill.skillName}
                      </Link>
                      <RiskBadge level={skill.riskLevel} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{skill.category}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {skill.totalUses} uses
                    </span>
                    <p className="text-xs text-gray-400">
                      {skill.hoursSavedPerUse.toFixed(1)} hrs/use
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable Column Header
// ---------------------------------------------------------------------------

function RiskSortHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: {
  column: IpRiskSortColumn;
  label: string;
  sortBy: IpRiskSortColumn;
  sortDir: SortDirection;
  onSort: (col: IpRiskSortColumn) => void;
  align?: "left" | "right";
}) {
  const isActive = column === sortBy;
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${alignClass}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-gray-700"
      >
        <span>{label}</span>
        <svg
          className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-gray-300"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          {isActive && sortDir === "asc" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          )}
        </svg>
      </button>
    </th>
  );
}
