"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const VIEWS = ["cards", "graph"] as const;

const TopologyGraph = dynamic(
  () => import("./topology-graph").then((m) => ({ default: m.TopologyGraph })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-500">Loading graph visualization...</div>
      </div>
    ),
  }
);

interface CommunitiesViewToggleProps {
  cardsContent: ReactNode;
}

export function CommunitiesViewToggle({ cardsContent }: CommunitiesViewToggleProps) {
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("cards"));

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setView("cards")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "cards"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => setView("graph")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === "graph"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Graph
        </button>
      </div>

      {view === "graph" ? <TopologyGraph /> : cardsContent}
    </div>
  );
}
