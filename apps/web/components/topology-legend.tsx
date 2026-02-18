"use client";

import { COMMUNITY_COLORS } from "./topology-graph";

interface TopologyLegendProps {
  communities: { communityId: number; label: string | null; memberCount: number }[];
  colorByCommunity: boolean;
  userStats: { authored: number; used: number };
}

export function TopologyLegend({ communities, colorByCommunity, userStats }: TopologyLegendProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
      {/* User skills summary */}
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Your skills
      </p>
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-700">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 bg-gray-200" />
          <span>Highlighted ring = yours</span>
          <span className="text-gray-400">({userStats.authored + userStats.used})</span>
        </div>
        {userStats.authored > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 pl-5">
            {userStats.authored} authored
          </div>
        )}
        {userStats.used > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 pl-5">
            {userStats.used} used
          </div>
        )}
      </div>

      {/* Community colors */}
      {colorByCommunity && communities.length > 0 && (
        <>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Communities
          </p>
          <div className="flex flex-col gap-1">
            {communities.slice(0, 8).map((c, i) => (
              <div key={c.communityId} className="flex items-center gap-2 text-xs text-gray-700">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] }}
                />
                <span>{c.label || `Community ${c.communityId + 1}`}</span>
                <span className="text-gray-400">({c.memberCount})</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Size scale */}
      <div className="mt-2 border-t border-gray-100 pt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Node size
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
          <span>Low usage</span>
          <span className="inline-block h-4 w-4 rounded-full bg-gray-400" />
          <span>High usage</span>
        </div>
      </div>
    </div>
  );
}
