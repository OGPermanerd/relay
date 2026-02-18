"use client";

export interface TopologyControlState {
  showEdges: boolean;
  sizeByUsage: boolean;
  colorByCommunity: boolean;
  highlightMine: boolean;
  focusCommunity: number | null;
}

interface TopologyControlsProps {
  state: TopologyControlState;
  onChange: (state: TopologyControlState) => void;
  communities: { communityId: number; label: string | null; memberCount: number }[];
}

export function TopologyControls({ state, onChange, communities }: TopologyControlsProps) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={state.highlightMine}
          onChange={(e) => onChange({ ...state, highlightMine: e.target.checked })}
          className="rounded border-gray-300"
        />
        Highlight my skills
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={state.showEdges}
          onChange={(e) => onChange({ ...state, showEdges: e.target.checked })}
          className="rounded border-gray-300"
        />
        Show edges
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={state.sizeByUsage}
          onChange={(e) => onChange({ ...state, sizeByUsage: e.target.checked })}
          className="rounded border-gray-300"
        />
        Size by usage
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={state.colorByCommunity}
          onChange={(e) => onChange({ ...state, colorByCommunity: e.target.checked })}
          className="rounded border-gray-300"
        />
        Color by community
      </label>
      {communities.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Focus community</label>
          <select
            value={state.focusCommunity ?? ""}
            onChange={(e) =>
              onChange({ ...state, focusCommunity: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
          >
            <option value="">All</option>
            {communities.map((c) => (
              <option key={c.communityId} value={c.communityId}>
                {c.label || `Community ${c.communityId + 1}`} ({c.memberCount})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
