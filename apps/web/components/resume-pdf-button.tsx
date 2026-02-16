"use client";

import { useState } from "react";
import type { ResumeData } from "@/lib/resume-queries";

// ---------------------------------------------------------------------------
// Icons (inline — same patterns as ip-export-buttons.tsx)
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
// Helpers
// ---------------------------------------------------------------------------

/** Format a number with commas, no decimals (hydration-safe) */
function formatNumber(value: number): string {
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ResumePdfButtonProps {
  data: ResumeData;
}

export function ResumePdfButton({ data }: ResumePdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const today = new Date().toISOString().split("T")[0];
      let y = 20;

      // -- Header --
      doc.setFontSize(22);
      doc.text(data.userName || "Skills Resume", 14, y);
      y += 9;
      doc.setFontSize(12);
      doc.setTextColor(120, 120, 120);
      doc.text("Skills Resume", 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Generated ${today}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 14;

      // -- Impact Summary --
      doc.setFontSize(14);
      doc.text("Impact Summary", 14, y);
      y += 8;
      doc.setFontSize(10);

      const summaryLines = [
        `Skills Authored: ${data.skillsAuthored}`,
        `Hours Saved: ${formatNumber(data.totalHoursSaved)}`,
        `People Helped: ${formatNumber(data.peopleHelped)}`,
        `Estimated Value: $${formatNumber(data.estimatedValue)}`,
      ];
      for (const line of summaryLines) {
        doc.text(line, 14, y);
        y += 6;
      }
      y += 4;

      // -- Quality Achievements --
      const { gold, silver, bronze } = data.qualityAchievements;
      if (gold > 0 || silver > 0 || bronze > 0) {
        const parts: string[] = [];
        if (gold > 0) parts.push(`Gold: ${gold}`);
        if (silver > 0) parts.push(`Silver: ${silver}`);
        if (bronze > 0) parts.push(`Bronze: ${bronze}`);
        doc.text(`Quality Achievements: ${parts.join(", ")}`, 14, y);
        y += 10;
      }

      // -- Skills Table --
      doc.setFontSize(14);
      doc.text("Skills", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["Skill", "Category", "Uses", "Hours Saved", "Quality"]],
        body: data.skills.map((s) => [
          s.name,
          s.category,
          String(s.totalUses),
          formatNumber(s.totalHoursSaved),
          s.qualityTier === "No Badge" || s.qualityTier === "Unrated" ? "-" : s.qualityTier,
        ]),
        headStyles: { fillColor: [11, 22, 36] },
        styles: { fontSize: 9 },
      });

      // -- Footer --
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalY = (doc as any).lastAutoTable?.finalY ?? doc.internal.pageSize.getHeight() - 30;
      const footerY = Math.min(finalY + 15, doc.internal.pageSize.getHeight() - 10);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("Generated via EverySkill - everyskill.ai", 14, footerY);

      doc.save(`skills-resume-${today}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownloadPdf}
      disabled={isExporting}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isExporting ? (
        <>
          <SpinnerIcon />
          Exporting...
        </>
      ) : (
        <>
          <DownloadIcon />
          Download PDF
        </>
      )}
    </button>
  );
}
