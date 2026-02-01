"use client";

import Link from "next/link";
import { Sparkline } from "./sparkline";
import { SkillAccordionContent } from "./skill-accordion-content";
import { InstallButton } from "./install-button";
import type { SkillTableRow } from "./skills-table";

interface SkillsTableRowProps {
  skill: SkillTableRow & {
    description: string;
    category: string;
    tags?: string[] | null;
  };
  trend: number[];
  isExpanded: boolean;
  onToggle: () => void;
  isCopied: boolean;
  onInstall: () => void;
  rowIndex: number;
}

/**
 * Individual table row with expand/collapse accordion and install button
 *
 * Features:
 * - Clickable row to toggle expansion
 * - Quick install icon in row
 * - Accordion content with full details when expanded
 * - Visual highlight when expanded (ring)
 */
export function SkillsTableRow({
  skill,
  trend,
  isExpanded,
  onToggle,
  isCopied,
  onInstall,
  rowIndex,
}: SkillsTableRowProps) {
  // Calculate FTE Days Saved: (totalUses * hoursSaved) / 8
  const daysSaved = ((skill.totalUses * (skill.hoursSaved ?? 1)) / 8).toFixed(1);

  // Format date as "MMM D, YYYY" (e.g., "Jan 15, 2026")
  const dateAdded = skill.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Row background: alternating + expanded state
  const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50";
  const expandedStyles = isExpanded ? "ring-1 ring-blue-200" : "";

  return (
    <>
      {/* Main data row */}
      <tr
        onClick={onToggle}
        className={`${rowBg} ${expandedStyles} cursor-pointer transition-colors hover:bg-blue-50`}
      >
        <td className="whitespace-nowrap px-4 py-3">
          <Link
            href={`/skills/${skill.slug}`}
            className="text-sm font-medium text-gray-900 hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
          >
            {skill.name}
          </Link>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
          {daysSaved}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
          {skill.totalUses.toLocaleString()}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-600">
          {dateAdded}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
          {skill.author?.name || "Anonymous"}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <div className="inline-block">
            <Sparkline data={trend} />
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <InstallButton
            skillName={skill.name}
            isCopied={isCopied}
            onCopy={onInstall}
            variant="icon"
          />
        </td>
      </tr>

      {/* Accordion content (conditionally rendered) */}
      {isExpanded && (
        <SkillAccordionContent
          skill={{
            id: skill.id,
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            category: skill.category,
            tags: skill.tags ?? undefined,
          }}
          onInstall={onInstall}
          isCopied={isCopied}
        />
      )}
    </>
  );
}
