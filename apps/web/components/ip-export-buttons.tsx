"use client";

import { useState } from "react";
import { fetchIpReportData } from "@/app/actions/export-ip-report";

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Format a number with commas, no decimals (hydration-safe) */
function formatCurrency(value: number): string {
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Escape a value for safe CSV inclusion */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Download a blob as a file */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IpExportButtons() {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // -----------------------------------------------------------------------
  // CSV Export
  // -----------------------------------------------------------------------
  const handleCsvExport = async () => {
    setIsExportingCsv(true);
    try {
      const data = await fetchIpReportData();

      if (data.skills.length === 0) {
        alert("No skill data to export.");
        return;
      }

      const headers = [
        "Skill Name",
        "Author",
        "Category",
        "Total Uses",
        "Hours Saved/Use",
        "Total Hours Saved",
        "Replacement Cost",
        "Risk Level",
        "Average Rating",
      ];

      const rows = data.skills.map((s) => [
        escapeCSV(s.name),
        escapeCSV(s.authorName || "Unknown"),
        escapeCSV(s.category || "Uncategorized"),
        String(s.totalUses),
        s.hoursSaved.toFixed(2),
        (s.totalUses * s.hoursSaved).toFixed(2),
        s.replacementCost.toFixed(0),
        s.riskLevel || "none",
        s.averageRating != null ? (s.averageRating / 100).toFixed(1) : "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `ip-report-${today}.csv`);
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  // -----------------------------------------------------------------------
  // PDF Export
  // -----------------------------------------------------------------------
  const handlePdfExport = async () => {
    setIsExportingPdf(true);
    try {
      const data = await fetchIpReportData();
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      let y = 20;

      // -- Title --
      doc.setFontSize(20);
      doc.text("IP Report \u2014 EverySkill", 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated ${today}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 14;

      // -- Executive Summary --
      doc.setFontSize(14);
      doc.text("Executive Summary", 14, y);
      y += 8;
      doc.setFontSize(10);

      const totalHoursSaved = data.skills.reduce((sum, s) => sum + s.totalUses * s.hoursSaved, 0);
      const summaryLines = [
        `Total Estimated IP Value: $${formatCurrency(data.totalValue)}`,
        `Skills Captured: ${data.stats.totalSkillsCaptured}`,
        `Total Uses: ${formatCurrency(data.stats.totalUses)}`,
        `Hours Saved: ${totalHoursSaved.toFixed(1)}`,
        `Active Contributors: ${data.stats.activeContributors}`,
      ];
      for (const line of summaryLines) {
        doc.text(line, 14, y);
        y += 6;
      }
      y += 6;

      // -- Top Skills by Estimated Value --
      doc.setFontSize(14);
      doc.text("Top Skills by Estimated Value", 14, y);
      y += 4;

      const topSkills = [...data.skills]
        .sort((a, b) => b.replacementCost - a.replacementCost)
        .slice(0, 20);

      autoTable(doc, {
        startY: y,
        head: [["Skill", "Author", "Uses", "Hrs Saved", "Est. Value", "Risk"]],
        body: topSkills.map((s) => [
          s.name,
          s.authorName || "Unknown",
          String(s.totalUses),
          (s.totalUses * s.hoursSaved).toFixed(1),
          `$${formatCurrency(s.replacementCost)}`,
          s.riskLevel || "none",
        ]),
        headStyles: { fillColor: [11, 22, 36] },
        styles: { fontSize: 9 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable?.finalY ?? doc.internal.pageSize.getHeight() - 20;
      y += 10;

      // -- Risk Assessment --
      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.text("Risk Assessment", 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`At-Risk Skills: ${data.riskAlerts.length}`, 14, y);
      y += 6;
      doc.text(`Employees with Concentrated IP: ${data.riskEmployees.length}`, 14, y);
      y += 6;

      if (data.riskAlerts.length > 0) {
        const riskSkills = data.riskAlerts.slice(0, 10);
        autoTable(doc, {
          startY: y,
          head: [["Skill", "Author", "Uses", "Risk Level"]],
          body: riskSkills.map((a) => [
            a.skillName,
            a.authorName || "Unknown",
            String(a.totalUses),
            a.riskLevel === "critical" ? "Critical" : "High",
          ]),
          headStyles: { fillColor: [11, 22, 36] },
          styles: { fontSize: 9 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY ?? y + 40;
        y += 10;
      }

      // -- Quality Trends --
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 20;
      }

      if (data.trends.length > 0) {
        doc.setFontSize(14);
        doc.text("Quality Trends", 14, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [["Month", "Avg Rating", "Sentiment %", "Benchmark"]],
          body: data.trends.map((t) => [
            t.date,
            t.avgRating != null ? t.avgRating.toFixed(1) : "--",
            t.sentimentPct != null ? t.sentimentPct.toFixed(1) + "%" : "--",
            t.benchmarkScore != null ? t.benchmarkScore.toFixed(1) : "--",
          ]),
          headStyles: { fillColor: [11, 22, 36] },
          styles: { fontSize: 9 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY ?? y + 40;
        y += 10;
      }

      // -- Contributor Highlights --
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 20;
      }

      if (data.riskEmployees.length > 0) {
        doc.setFontSize(14);
        doc.text("Contributor Highlights", 14, y);
        y += 4;

        const topEmployees = data.riskEmployees.slice(0, 10);
        autoTable(doc, {
          startY: y,
          head: [["Name", "Email", "At-Risk Skills", "Total At-Risk Uses"]],
          body: topEmployees.map((e) => [
            e.name || "Unknown",
            e.email,
            String(e.atRiskSkillCount),
            String(e.totalAtRiskUses),
          ]),
          headStyles: { fillColor: [11, 22, 36] },
          styles: { fontSize: 9 },
        });
      }

      // Save PDF
      doc.save(`ip-report-${today}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handlePdfExport}
        disabled={isExportingPdf}
        className={buttonClass}
      >
        {isExportingPdf ? (
          <>
            <SpinnerIcon />
            Exporting...
          </>
        ) : (
          <>
            <DownloadIcon />
            Export PDF
          </>
        )}
      </button>
      <button
        type="button"
        onClick={handleCsvExport}
        disabled={isExportingCsv}
        className={buttonClass}
      >
        {isExportingCsv ? (
          <>
            <SpinnerIcon />
            Exporting...
          </>
        ) : (
          <>
            <DownloadIcon />
            Export CSV
          </>
        )}
      </button>
    </div>
  );
}
