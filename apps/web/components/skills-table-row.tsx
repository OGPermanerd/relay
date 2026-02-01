"use client";

import { useRef, KeyboardEvent, FocusEvent } from "react";
import Link from "next/link";
import { useSwipeable } from "react-swipeable";
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
  onCollapse: () => void;
  onFocus: () => void;
  tabIndex: 0 | -1;
  onKeyDown: (e: KeyboardEvent) => void;
  registerRef: (el: HTMLTableRowElement | null) => void;
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
  onCollapse,
  onFocus,
  tabIndex,
  onKeyDown,
  registerRef,
  isCopied,
  onInstall,
  rowIndex,
}: SkillsTableRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const accordionId = `accordion-${skill.id}`;

  // Swipe handlers for mobile install gesture
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => onInstall(),
    onSwipedRight: () => onInstall(),
    delta: 80, // Minimum swipe distance
    preventScrollOnSwipe: true,
    trackMouse: false, // Only touch, not mouse drag
  });

  // Handle blur - collapse when focus leaves the row (unless focus moves to accordion content)
  const handleBlur = (e: FocusEvent<HTMLTableRowElement>) => {
    // Check if focus is moving to accordion content or staying within the row
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const accordionElement = document.getElementById(accordionId);

    // Don't collapse if focus moves to:
    // 1. Inside the current row
    // 2. Inside the accordion content for this row
    if (rowRef.current?.contains(relatedTarget) || accordionElement?.contains(relatedTarget)) {
      return;
    }

    onCollapse();
  };

  // Combined ref callback
  const setRef = (el: HTMLTableRowElement | null) => {
    (rowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
    registerRef(el);
  };
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
        {...swipeHandlers}
        ref={setRef}
        tabIndex={tabIndex}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? accordionId : undefined}
        onClick={onToggle}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        className={`${rowBg} ${expandedStyles} cursor-pointer transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset`}
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
          id={accordionId}
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
