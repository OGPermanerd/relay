"use client";

import { InstallButton } from "./install-button";
import { LoomEmbed } from "./loom-embed";
import { extractLoomVideoId } from "@/lib/loom";

interface SkillAccordionContentProps {
  id: string;
  skill: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    tags?: string[];
    loomUrl?: string | null;
  };
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

/**
 * Accordion content for expanded skill rows
 *
 * Displays:
 * - Category badge
 * - Description (or placeholder if empty)
 * - Tags (if present)
 * - Install button (full variant, opens platform modal)
 *
 * Uses preview card style with blue-50 background for expanded state
 */
export function SkillAccordionContent({
  id,
  skill,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: SkillAccordionContentProps) {
  return (
    <tr
      id={id}
      className="cursor-pointer bg-blue-50"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <td colSpan={8} className="px-4 py-3">
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

          {/* Loom video thumbnail */}
          {skill.loomUrl &&
            (() => {
              const videoId = extractLoomVideoId(skill.loomUrl!);
              return videoId ? (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <LoomEmbed videoId={videoId} />
                </div>
              ) : null;
            })()}

          {/* Install button - stopPropagation is handled internally by InstallButton */}
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <InstallButton
              variant="full"
              skill={{ id: skill.id, name: skill.name, slug: skill.slug, category: skill.category }}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
