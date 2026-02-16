"use client";

import Link from "next/link";
import type { SkillValuation } from "@/lib/ip-valuation";

// ---------------------------------------------------------------------------
// Risk Badge (matches ip-risk-section.tsx styling)
// ---------------------------------------------------------------------------

const RISK_STYLES = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
} as const;

function RiskBadge({ level }: { level: "critical" | "high" | null }) {
  if (!level) {
    return <span className="text-xs text-gray-400">&mdash;</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLES[level]}`}
    >
      {level === "critical" ? "Critical" : "High"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Format a number with commas, no decimals (hydration-safe) */
function formatCurrency(value: number): string {
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IpValuationTableProps {
  skills: SkillValuation[];
}

const MAX_VISIBLE = 20;

export function IpValuationTable({ skills }: IpValuationTableProps) {
  // Sort by replacement cost descending, show top 20
  const sorted = [...skills].sort((a, b) => b.replacementCost - a.replacementCost);
  const visible = sorted.slice(0, MAX_VISIBLE);

  if (skills.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No skill valuation data available</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Skill Name
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Author
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Category
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Total Uses
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Hours Saved
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Est. Replacement Cost
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                Risk Level
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.map((skill) => (
              <tr key={skill.skillId} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/skills/${skill.slug}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    {skill.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {skill.authorName || "Unknown"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {skill.category || "Uncategorized"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {skill.totalUses}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {(skill.totalUses * skill.hoursSaved).toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                  ${formatCurrency(skill.replacementCost)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RiskBadge level={skill.riskLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skills.length > MAX_VISIBLE && (
        <p className="mt-2 text-xs text-gray-400">
          Showing top {MAX_VISIBLE} of {skills.length} skills. Export CSV for complete data.
        </p>
      )}
    </div>
  );
}
