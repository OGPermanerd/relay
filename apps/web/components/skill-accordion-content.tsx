"use client";

import { InstallButton } from "./install-button";

interface SkillAccordionContentProps {
  skill: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    tags?: string[];
  };
  onInstall: () => void;
  isCopied: boolean;
}

/**
 * Accordion content for expanded skill rows
 *
 * Displays:
 * - Category badge
 * - Description (or placeholder if empty)
 * - Tags (if present)
 * - Install button (full variant)
 *
 * Uses preview card style with blue-50 background for expanded state
 */
export function SkillAccordionContent({ skill, onInstall, isCopied }: SkillAccordionContentProps) {
  return (
    <tr className="bg-blue-50">
      <td colSpan={6} className="px-4 py-3">
        <div className="rounded-lg border border-blue-100 bg-white p-4">
          {/* Category badge */}
          <span className="text-xs font-medium uppercase text-blue-600">{skill.category}</span>

          {/* Description */}
          <p className="mt-2 text-sm text-gray-700">
            {skill.description || "No description provided."}
          </p>

          {/* Tags */}
          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Install button */}
          <div className="mt-4">
            <InstallButton
              skillName={skill.name}
              isCopied={isCopied}
              onCopy={onInstall}
              variant="full"
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
