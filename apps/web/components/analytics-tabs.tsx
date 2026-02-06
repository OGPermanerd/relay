"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";
import type { ReactNode } from "react";

const TABS = ["overview", "employees", "skills"] as const;
type AnalyticsTab = (typeof TABS)[number];

const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  employees: "Employees",
  skills: "Skills",
};

interface AnalyticsTabsProps {
  overviewContent: ReactNode;
  employeesContent: ReactNode;
  skillsContent: ReactNode;
}

export function AnalyticsTabs({
  overviewContent,
  employeesContent,
  skillsContent,
}: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("overview")
  );

  const content: Record<AnalyticsTab, ReactNode> = {
    overview: overviewContent,
    employees: employeesContent,
    skills: skillsContent,
  };

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
      {content[activeTab as AnalyticsTab]}
    </div>
  );
}
