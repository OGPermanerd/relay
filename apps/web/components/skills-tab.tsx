"use client";

import { useState } from "react";
import Link from "next/link";
import { SkillAnalyticsModal } from "./skill-analytics-modal";

interface EmployeeBreakdown {
  userId: string;
  userName: string | null;
  usageCount: number;
}

interface SkillRow {
  skillId: string;
  name: string;
  category: string;
  authorName: string | null;
  usageCount: number;
  uniqueUsers: number;
  hoursSaved: number;
  employeeBreakdown: EmployeeBreakdown[];
}

interface SkillsTabProps {
  data: SkillRow[];
}

// Rank badge colors: gold, silver, bronze, then muted
const RANK_COLORS = [
  "bg-yellow-100 text-yellow-800 border-yellow-300",
  "bg-gray-100 text-gray-600 border-gray-300",
  "bg-orange-100 text-orange-700 border-orange-300",
];

export function SkillsTab({ data }: SkillsTabProps) {
  const [selectedSkill, setSelectedSkill] = useState<SkillRow | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No skill usage data for this period</p>
      </div>
    );
  }

  // Data is already sorted by usage count from the query
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((skill, index) => (
          <div
            key={skill.skillId}
            onClick={() => setSelectedSkill(skill)}
            className="relative cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Rank badge */}
            <div
              className={`absolute -top-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${
                index < 3 ? RANK_COLORS[index] : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              {index + 1}
            </div>

            {/* Skill info */}
            <div className="ml-4">
              <Link
                href={`/skills/${skill.skillId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-gray-900 hover:text-blue-600"
              >
                {skill.name}
              </Link>
              <p className="text-sm text-gray-500">{skill.category}</p>
              {skill.authorName && <p className="text-xs text-gray-400">by {skill.authorName}</p>}
            </div>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">{skill.usageCount}</p>
                <p className="text-xs text-gray-500">Uses</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{skill.uniqueUsers}</p>
                <p className="text-xs text-gray-500">Users</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">{skill.hoursSaved.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Hours</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSkill && (
        <SkillAnalyticsModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}
    </>
  );
}
