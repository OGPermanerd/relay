"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  CATEGORY_ACTIVE_COLORS,
  CATEGORY_INACTIVE_COLORS,
} from "@/lib/categories";

const SKILL_TYPES = ["all", ...CATEGORIES] as const;
type SkillType = (typeof SKILL_TYPES)[number];

/**
 * Skill type filter buttons with URL synchronization
 *
 * Maps directly to database categories:
 * - productivity, wiring, doc-production, data-viz, code
 */
export function SkillTypeFilter() {
  const [skillType, setSkillType] = useQueryState(
    "type",
    parseAsStringEnum(SKILL_TYPES as unknown as string[])
      .withDefault("all" as SkillType)
      .withOptions({ shallow: false })
  );
  const [isPending, startTransition] = useTransition();

  const handleClick = (type: SkillType) => {
    startTransition(() => {
      if (type === "all") {
        setSkillType(null); // Clear from URL when default
      } else {
        setSkillType(type);
      }
    });
  };

  const active = (skillType || "all") as SkillType;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {/* All button */}
      <button
        type="button"
        onClick={() => handleClick("all")}
        disabled={isPending}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          active === "all"
            ? "bg-gray-800 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        } disabled:opacity-50`}
      >
        All
      </button>

      {/* Category buttons */}
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        const style = CATEGORY_STYLES[cat];
        const colorClass = isActive ? CATEGORY_ACTIVE_COLORS[cat] : CATEGORY_INACTIVE_COLORS[cat];

        return (
          <button
            key={cat}
            type="button"
            onClick={() => handleClick(cat)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${colorClass} disabled:opacity-50`}
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={style.iconPath} />
            </svg>
            {CATEGORY_LABELS[cat]}
          </button>
        );
      })}
    </div>
  );
}
