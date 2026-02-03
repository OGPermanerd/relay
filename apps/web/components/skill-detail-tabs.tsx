"use client";

import { useState, type ReactNode } from "react";

interface SkillDetailTabsProps {
  children: ReactNode;
  aiReviewContent: ReactNode;
}

type TabKey = "details" | "ai-review";

export function SkillDetailTabs({ children, aiReviewContent }: SkillDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "ai-review", label: "AI Review" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div role="tablist" className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        id="tabpanel-details"
        aria-labelledby="tab-details"
        hidden={activeTab !== "details"}
      >
        {children}
      </div>
      <div
        role="tabpanel"
        id="tabpanel-ai-review"
        aria-labelledby="tab-ai-review"
        hidden={activeTab !== "ai-review"}
      >
        {aiReviewContent}
      </div>
    </div>
  );
}
