"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";

const SKILL_TYPES = ["all", "claude-skill", "ai-prompt", "other"] as const;
type SkillType = (typeof SKILL_TYPES)[number];

const TYPE_LABELS: Record<SkillType, string> = {
  all: "All",
  "claude-skill": "Claude Skill",
  "ai-prompt": "AI Prompt",
  other: "Other",
};

/**
 * Skill type filter buttons with URL synchronization
 *
 * Maps to database categories:
 * - Claude Skill = "agent"
 * - AI Prompt = "prompt"
 * - Other = "workflow", "mcp"
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

  return (
    <div className="flex items-center gap-1">
      {SKILL_TYPES.map((type) => {
        const isActive = (skillType || "all") === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleClick(type)}
            disabled={isPending}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } disabled:opacity-50`}
          >
            {TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}
