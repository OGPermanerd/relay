"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";
import type { ReactNode } from "react";

const TABS = ["browse", "leverage"] as const;

const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  browse: "Browse Skills",
  leverage: "My Leverage",
};

interface HomeTabsProps {
  browseContent: ReactNode;
  leverageContent: ReactNode;
}

export function HomeTabs({ browseContent, leverageContent }: HomeTabsProps) {
  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(TABS).withDefault("browse")
  );

  return (
    <div>
      {/* Tab buttons */}
      <div className="mb-6 flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "browse" ? browseContent : leverageContent}
    </div>
  );
}
