"use client";

import { useEffect, useMemo, useRef } from "react";
import { announceToScreenReader } from "@/lib/accessibility";
import { useSortState } from "@/hooks/use-sort-state";
import { useExpandedRows } from "@/hooks/use-expanded-rows";
import { useClipboardCopy } from "@/hooks/use-clipboard-copy";
import { generateMcpConfig } from "@/lib/mcp-config";
import { SortableColumnHeader } from "./sortable-column-header";
import { SkillsTableRow } from "./skills-table-row";

export interface SkillTableRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags?: string[] | null;
  totalUses: number;
  hoursSaved: number | null;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
  } | null;
}

export interface SkillsTableProps {
  skills: SkillTableRow[];
  usageTrends: Map<string, number[]>;
}

/**
 * Interactive skills table with sorting and accordion rows
 *
 * Columns:
 * 1. Skill Name - left aligned, sortable
 * 2. Days Saved - right aligned, sortable (totalUses * hoursSaved / 8)
 * 3. Installs - right aligned, sortable (totalUses)
 * 4. Date Added - right aligned, sortable (MMM D, YYYY format)
 * 5. Author - left aligned, sortable
 * 6. Sparkline - center aligned (not sortable)
 * 7. Install - center aligned (quick install button)
 *
 * Client Component with:
 * - URL-persisted sort state via nuqs
 * - Expandable rows with accordion content
 * - One-click install with clipboard copy
 */
// Human-readable column names for screen reader announcements
const COLUMN_LABELS: Record<string, string> = {
  name: "Skill Name",
  days_saved: "Days Saved",
  installs: "Installs",
  date: "Date Added",
  author: "Author",
};

export function SkillsTable({ skills, usageTrends }: SkillsTableProps) {
  const { sortBy, sortDir, toggleSort } = useSortState();
  const { toggleRow, isExpanded } = useExpandedRows();
  const { copyToClipboard, isCopied } = useClipboardCopy();

  // Track if this is the initial render to avoid announcing on page load
  const isInitialMount = useRef(true);

  // Announce sort changes to screen readers (not on initial load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const columnLabel = COLUMN_LABELS[sortBy] || sortBy;
    const direction = sortDir === "asc" ? "ascending" : "descending";
    announceToScreenReader(`Table sorted by ${columnLabel}, ${direction}`);
  }, [sortBy, sortDir]);

  // Client-side sort
  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "days_saved": {
          const aDays = (a.totalUses * (a.hoursSaved ?? 1)) / 8;
          const bDays = (b.totalUses * (b.hoursSaved ?? 1)) / 8;
          comparison = aDays - bDays;
          break;
        }
        case "installs":
          comparison = a.totalUses - b.totalUses;
          break;
        case "date":
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case "author":
          comparison = (a.author?.name ?? "").localeCompare(b.author?.name ?? "");
          break;
      }
      return sortDir === "desc" ? -comparison : comparison;
    });
  }, [skills, sortBy, sortDir]);

  if (skills.length === 0) {
    return <p className="text-gray-500">No skills found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortableColumnHeader
              column="name"
              label="Skill Name"
              currentSort={sortBy}
              direction={sortDir}
              onSort={toggleSort}
              align="left"
            />
            <SortableColumnHeader
              column="days_saved"
              label="Days Saved"
              currentSort={sortBy}
              direction={sortDir}
              onSort={toggleSort}
              align="right"
            />
            <SortableColumnHeader
              column="installs"
              label="Installs"
              currentSort={sortBy}
              direction={sortDir}
              onSort={toggleSort}
              align="right"
            />
            <SortableColumnHeader
              column="date"
              label="Date Added"
              currentSort={sortBy}
              direction={sortDir}
              onSort={toggleSort}
              align="right"
            />
            <SortableColumnHeader
              column="author"
              label="Author"
              currentSort={sortBy}
              direction={sortDir}
              onSort={toggleSort}
              align="left"
            />
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Sparkline
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
            >
              Install
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedSkills.map((skill, index) => (
            <SkillsTableRow
              key={skill.id}
              skill={skill}
              trend={usageTrends.get(skill.id) || []}
              isExpanded={isExpanded(skill.id)}
              onToggle={() => toggleRow(skill.id)}
              isCopied={isCopied(skill.id)}
              onInstall={() => copyToClipboard(skill.id, generateMcpConfig(skill))}
              rowIndex={index}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
