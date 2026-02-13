"use client";

import { useRef, KeyboardEvent, FocusEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkline } from "./sparkline";
import { SkillAccordionContent } from "./skill-accordion-content";
import { InstallButton } from "./install-button";
import { RelativeTime } from "@/components/relative-time";
import type { SkillTableRow } from "./skills-table";
import { FTE_HOURS_PER_YEAR } from "@/lib/constants";

interface SkillsTableRowProps {
  skill: SkillTableRow & {
    description: string;
    category: string;
    tags?: string[] | null;
  };
  trend: number[];
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onFocus: () => void;
  tabIndex: 0 | -1;
  onKeyDown: (e: KeyboardEvent) => void;
  registerRef: (el: HTMLTableRowElement | null) => void;
  rowIndex: number;
}

/**
 * Individual table row with expand/collapse accordion and install button
 *
 * Features:
 * - Hover over row to expand accordion
 * - Click row to navigate to skill detail page
 * - Quick install icon in row (opens platform modal)
 * - Accordion content with full details when expanded
 * - Visual highlight when expanded (ring)
 */
export function SkillsTableRow({
  skill,
  trend,
  isExpanded,
  onExpand,
  onCollapse,
  onFocus,
  tabIndex,
  onKeyDown,
  registerRef,
  rowIndex,
}: SkillsTableRowProps) {
  const router = useRouter();
  const rowRef = useRef<HTMLTableRowElement>(null);
  const accordionId = `accordion-${skill.id}`;

  // Handle mouse leave - don't collapse if moving to accordion content
  const handleMouseLeave = (e: MouseEvent<HTMLTableRowElement>) => {
    const relatedTarget = e.relatedTarget;
    const accordionElement = document.getElementById(accordionId);

    // Don't collapse if mouse moves to accordion content
    // Check that relatedTarget is a Node before calling contains
    if (relatedTarget instanceof Node && accordionElement?.contains(relatedTarget)) {
      return;
    }

    onCollapse();
  };

  // Handle blur - collapse when focus leaves the row (unless focus moves to accordion content)
  const handleBlur = (e: FocusEvent<HTMLTableRowElement>) => {
    const relatedTarget = e.relatedTarget;
    const accordionElement = document.getElementById(accordionId);

    // Don't collapse if focus moves to:
    // 1. Inside the current row
    // 2. Inside the accordion content for this row
    if (relatedTarget instanceof Node) {
      if (rowRef.current?.contains(relatedTarget) || accordionElement?.contains(relatedTarget)) {
        return;
      }
    }

    onCollapse();
  };

  // Combined ref callback
  const setRef = (el: HTMLTableRowElement | null) => {
    (rowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
    registerRef(el);
  };
  // Calculate FTE Years Saved: (totalUses * hoursSaved) / FTE_HOURS_PER_YEAR
  const yearsSaved = ((skill.totalUses * (skill.hoursSaved ?? 1)) / FTE_HOURS_PER_YEAR).toFixed(2);

  // Row background: alternating + expanded state
  const rowBg = rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50";
  const expandedStyles = isExpanded ? "ring-1 ring-blue-200" : "";

  // Convert averageRating (stored as int * 100, e.g. 425 = 4.25) to display value
  const rating = skill.averageRating ? skill.averageRating / 100 : null;

  return (
    <>
      {/* Main data row */}
      <tr
        ref={setRef}
        tabIndex={tabIndex}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? accordionId : undefined}
        onClick={() => router.push(`/skills/${skill.slug}`)}
        onMouseEnter={onExpand}
        onMouseLeave={handleMouseLeave}
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
          {skill.loomUrl && (
            <span className="ml-2 inline-flex items-center text-blue-500" title="Has demo video">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <div className="inline-block">
            <Sparkline data={trend} />
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600">
          {yearsSaved}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600">
          {String(skill.totalUses)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-600">
          <RelativeTime date={skill.createdAt} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
          {skill.author ? (
            <Link
              href={`/users/${skill.author.id}`}
              className="hover:text-blue-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {skill.author.name || "Anonymous"}
            </Link>
          ) : (
            "Anonymous"
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          {rating ? (
            <div className="inline-flex items-center gap-1">
              <span className="text-sm text-gray-600">{rating.toFixed(1)}</span>
              <svg
                className="h-4 w-4 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-center">
          <InstallButton
            variant="icon"
            skill={{ id: skill.id, name: skill.name, slug: skill.slug, category: skill.category }}
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
          onMouseEnter={onExpand}
          onMouseLeave={onCollapse}
          onClick={() => router.push(`/skills/${skill.slug}`)}
        />
      )}
    </>
  );
}
