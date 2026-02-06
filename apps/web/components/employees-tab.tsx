"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  useEmployeeSortState,
  type EmployeeSortColumn,
  type SortDirection,
} from "@/hooks/use-analytics-sort";
import { EmployeeDetailModal } from "./employee-detail-modal";

interface EmployeeRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  skillsUsed: number;
  usageFrequency: number;
  hoursSaved: number;
  lastActive: string; // ISO date string
  topSkill: string | null;
}

interface EmployeesTabProps {
  data: EmployeeRow[];
}

/**
 * Sortable employees table with drill-down modal
 *
 * Displays per-employee usage metrics with all columns sortable.
 * Click a row to open the detail modal with activity history.
 */
export function EmployeesTab({ data }: EmployeesTabProps) {
  const { sortBy, sortDir, toggleSort } = useEmployeeSortState();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() ?? "";
          bVal = b.name?.toLowerCase() ?? "";
          break;
        case "email":
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case "skillsUsed":
          aVal = a.skillsUsed;
          bVal = b.skillsUsed;
          break;
        case "usageFrequency":
          aVal = a.usageFrequency;
          bVal = b.usageFrequency;
          break;
        case "hoursSaved":
          aVal = a.hoursSaved;
          bVal = b.hoursSaved;
          break;
        case "lastActive":
          aVal = new Date(a.lastActive).getTime();
          bVal = new Date(b.lastActive).getTime();
          break;
        case "topSkill":
          aVal = a.topSkill?.toLowerCase() ?? "";
          bVal = b.topSkill?.toLowerCase() ?? "";
          break;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortBy, sortDir]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No employee usage data for this period</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader
                column="name"
                label="Name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                column="email"
                label="Email"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                column="skillsUsed"
                label="Skills Used"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                column="usageFrequency"
                label="Frequency"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                column="hoursSaved"
                label="Hours Saved"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortHeader
                column="lastActive"
                label="Last Active"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                column="topSkill"
                label="Top Skill"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedData.map((employee) => (
              <tr
                key={employee.id}
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
                    <Link
                      href={`/users/${employee.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {employee.name || "Unknown"}
                    </Link>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {employee.email}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {employee.skillsUsed}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {employee.usageFrequency}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                  {employee.hoursSaved.toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {new Date(employee.lastActive).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {employee.topSkill || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}

/**
 * Inline sortable column header for employee table
 */
function SortHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: {
  column: EmployeeSortColumn;
  label: string;
  sortBy: EmployeeSortColumn;
  sortDir: SortDirection;
  onSort: (col: EmployeeSortColumn) => void;
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
