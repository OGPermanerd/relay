"use client";

import { useState } from "react";
import { useTimeRange } from "./time-range-selector";
import { fetchExportData, type ExportDataRow } from "@/app/actions/export-analytics";

interface CsvExportButtonProps {
  className?: string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function CsvExportButton({ className = "" }: CsvExportButtonProps) {
  const range = useTimeRange();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await fetchExportData(range);

      if (data.length === 0) {
        alert("No data to export for this time range");
        return;
      }

      // Build CSV content
      const headers = [
        "Date",
        "Employee Name",
        "Employee Email",
        "Skill Name",
        "Category",
        "Action",
        "Hours Saved",
      ];
      const rows = data.map((row: ExportDataRow) => [
        escapeCSV(row.date),
        escapeCSV(row.employeeName ?? "Unknown"),
        escapeCSV(row.employeeEmail),
        escapeCSV(row.skillName ?? "Unknown"),
        escapeCSV(row.category ?? "Uncategorized"),
        escapeCSV(row.action),
        row.hoursSaved.toFixed(2),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      // Generate filename with date
      const today = new Date().toISOString().split("T")[0];
      const filename = `relay-analytics-${today}.csv`;

      // Download via blob
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {isExporting ? (
        <>
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Export CSV
        </>
      )}
    </button>
  );
}
