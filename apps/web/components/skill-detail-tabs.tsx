"use client";

import { useState, type ReactNode } from "react";

interface SkillDetailTabsProps {
  children: ReactNode;
  aiReviewContent: ReactNode;
  suggestionsContent?: ReactNode;
  suggestionCount?: number;
  trainingContent?: ReactNode;
  trainingExampleCount?: number;
  showTrainingTab?: boolean;
}

type TabKey = "details" | "ai-review" | "suggestions" | "training";

export function SkillDetailTabs({
  children,
  aiReviewContent,
  suggestionsContent = null,
  suggestionCount,
  trainingContent = null,
  trainingExampleCount,
  showTrainingTab = false,
}: SkillDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "ai-review", label: "AI Review" },
    {
      key: "suggestions",
      label:
        suggestionCount && suggestionCount > 0 ? `Suggestions (${suggestionCount})` : "Suggestions",
    },
    ...(showTrainingTab
      ? [
          {
            key: "training" as TabKey,
            label:
              trainingExampleCount && trainingExampleCount > 0
                ? `Training (${trainingExampleCount})`
                : "Training",
          },
        ]
      : []),
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
      <div
        role="tabpanel"
        id="tabpanel-suggestions"
        aria-labelledby="tab-suggestions"
        hidden={activeTab !== "suggestions"}
      >
        {suggestionsContent}
      </div>
      <div
        role="tabpanel"
        id="tabpanel-training"
        aria-labelledby="tab-training"
        hidden={activeTab !== "training"}
      >
        {trainingContent}
      </div>
    </div>
  );
}
