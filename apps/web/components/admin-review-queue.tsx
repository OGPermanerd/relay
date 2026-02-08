"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = [
  { label: "Awaiting Review", value: "ai_reviewed" },
  { label: "Pending AI", value: "pending_review" },
  { label: "Rejected", value: "rejected" },
  { label: "Changes Requested", value: "changes_requested" },
  { label: "All", value: "" },
];

const CATEGORY_OPTIONS = [
  { label: "All", value: "" },
  { label: "Prompt", value: "prompt" },
  { label: "Workflow", value: "workflow" },
  { label: "Agent", value: "agent" },
  { label: "MCP", value: "mcp" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  ai_reviewed: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  changes_requested: "bg-orange-100 text-orange-700",
  published: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  ai_reviewed: "AI Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
  published: "Published",
};

const CATEGORY_COLORS: Record<string, string> = {
  prompt: "bg-blue-100 text-blue-700",
  workflow: "bg-purple-100 text-purple-700",
  agent: "bg-green-100 text-green-700",
  mcp: "bg-orange-100 text-orange-700",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// =============================================================================
// Types
// =============================================================================

export interface ReviewQueueSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  authorName: string | null;
  authorId: string | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

interface AdminReviewQueueProps {
  skills: ReviewQueueSkill[];
  total: number;
  page: number;
  pageSize: number;
  currentFilters: {
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Format date as "MMM D, YYYY" using UTC to avoid hydration mismatches */
function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

// =============================================================================
// Component
// =============================================================================

export function AdminReviewQueue({
  skills,
  total,
  page,
  pageSize,
  currentFilters,
}: AdminReviewQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(currentFilters.status ?? "ai_reviewed");
  const [category, setCategory] = useState(currentFilters.category ?? "");
  const [dateFrom, setDateFrom] = useState(currentFilters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(currentFilters.dateTo ?? "");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined> = {}) => {
      const params = new URLSearchParams(searchParams.toString());

      const merged: Record<string, string | undefined> = {
        status: overrides.status !== undefined ? overrides.status : status,
        category: overrides.category !== undefined ? overrides.category : category,
        dateFrom: overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom,
        dateTo: overrides.dateTo !== undefined ? overrides.dateTo : dateTo,
        page: overrides.page !== undefined ? overrides.page : "1",
      };

      for (const [key, val] of Object.entries(merged)) {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      }

      return `/admin/reviews?${params.toString()}`;
    },
    [searchParams, status, category, dateFrom, dateTo]
  );

  function applyFilters() {
    router.push(buildUrl({ page: "1" }));
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="status-filter" className="block text-xs font-medium text-gray-500 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category-filter" className="block text-xs font-medium text-gray-500 mb-1">
            Category
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date-from" className="block text-xs font-medium text-gray-500 mb-1">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="date-to" className="block text-xs font-medium text-gray-500 mb-1">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={applyFilters}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Apply
        </button>
      </div>

      {/* Table */}
      {skills.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500">No skills awaiting review</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Skill Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Author
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Updated
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {skills.map((skill) => (
                <tr key={skill.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/admin/reviews/${skill.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {skill.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[skill.category] || "bg-gray-100 text-gray-700"}`}
                    >
                      {skill.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {skill.authorName ?? "Unknown"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[skill.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[skill.status] || skill.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDate(skill.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/admin/reviews/${skill.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed">
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-400 cursor-not-allowed">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
