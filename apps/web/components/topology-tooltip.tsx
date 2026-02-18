"use client";

import type { TopologyNode } from "@everyskill/db";

interface TopologyTooltipProps {
  node: TopologyNode | null;
  x: number;
  y: number;
}

export function TopologyTooltip({ node, x, y }: TopologyTooltipProps) {
  if (!node) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">{node.name}</p>
        {node.authored && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            Yours
          </span>
        )}
        {!node.authored && node.used && (
          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            Used
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">{node.category}</p>
      {node.communityLabel && <p className="mt-1 text-xs text-blue-600">{node.communityLabel}</p>}
      <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
        <span>{node.totalUses} uses</span>
        {node.averageRating != null && <span>{node.averageRating.toFixed(1)} rating</span>}
      </div>
      {node.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
