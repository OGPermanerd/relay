"use client";

import Link from "next/link";
import { FTE_HOURS_PER_YEAR } from "@/lib/constants";

// Define interfaces inline to avoid pulling server code into client bundle
interface SkillsUsedStats {
  totalSkills: number;
  totalHoursSaved: number;
  totalActions: number;
  mostUsedSkill: string | null;
}

interface SkillsCreatedStats {
  skillsPublished: number;
  hoursSavedByOthers: number;
  uniqueUsers: number;
  avgRating: number | null;
}

interface MiniLeverageWidgetProps {
  skillsUsedStats: SkillsUsedStats;
  skillsCreatedStats: SkillsCreatedStats;
}

export function MiniLeverageWidget({
  skillsUsedStats,
  skillsCreatedStats,
}: MiniLeverageWidgetProps) {
  const totalHoursSaved = skillsUsedStats.totalHoursSaved + skillsCreatedStats.hoursSavedByOthers;
  const fteYears = (totalHoursSaved / FTE_HOURS_PER_YEAR).toFixed(2);
  const hasData = skillsUsedStats.totalActions > 0 || skillsCreatedStats.skillsPublished > 0;

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Your Impact</h3>
        <Link
          href="/leverage"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          View full details
        </Link>
      </div>
      {hasData ? (
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <p className="text-2xl font-bold text-blue-600">{skillsUsedStats.totalSkills}</p>
            <p className="text-xs text-gray-500">Skills used</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">
              {skillsCreatedStats.skillsPublished}
            </p>
            <p className="text-xs text-gray-500">Skills created</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{fteYears}</p>
            <p className="text-xs text-gray-500">FTE years saved</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          Start using and sharing skills to see your impact here.
        </p>
      )}
    </div>
  );
}
