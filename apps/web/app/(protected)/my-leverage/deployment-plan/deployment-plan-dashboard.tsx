"use client";

import Link from "next/link";
import type { SkillRecommendation } from "@/lib/skill-recommendations";
import { AdoptionRoadmapChart, type ProjectionPoint } from "@/components/adoption-roadmap-chart";

// ---------------------------------------------------------------------------
// Projection computation
// ---------------------------------------------------------------------------

function computeCumulativeProjection(
  recommendations: SkillRecommendation[],
  weeksToProject: number = 12
): ProjectionPoint[] {
  // Sort by projectedWeeklySavings descending (highest ROI first)
  const sorted = [...recommendations].sort(
    (a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings
  );

  const points: ProjectionPoint[] = [];
  let cumulativeFteDays = 0;

  for (let week = 1; week <= weeksToProject; week++) {
    // 1 new skill every 2 weeks
    const skillsAdoptedByWeek = Math.min(Math.ceil(week / 2), sorted.length);

    // Weekly hours saved = sum of projectedWeeklySavings for adopted skills
    let weeklyHoursSaved = 0;
    for (let i = 0; i < skillsAdoptedByWeek; i++) {
      weeklyHoursSaved += sorted[i].projectedWeeklySavings;
    }

    // Convert to FTE days (8 hours per FTE day)
    const fteDaysThisWeek = weeklyHoursSaved / 8;
    cumulativeFteDays += fteDaysThisWeek;

    // Round to 1 decimal place
    const rounded = Math.round(cumulativeFteDays * 10) / 10;

    points.push({
      week,
      cumulativeFteDays: rounded,
      label: "Week " + week,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Dashboard component
// ---------------------------------------------------------------------------

interface DeploymentPlanDashboardProps {
  recommendations: SkillRecommendation[];
}

export function DeploymentPlanDashboard({ recommendations }: DeploymentPlanDashboardProps) {
  const projectionData = computeCumulativeProjection(recommendations);

  // Sort by projectedWeeklySavings descending for the ranked list
  const sorted = [...recommendations].sort(
    (a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings
  );

  // KPI values
  const totalWeeklySavings = recommendations.reduce((sum, r) => sum + r.projectedWeeklySavings, 0);
  const totalFteDays12Weeks =
    projectionData.length > 0 ? projectionData[projectionData.length - 1].cumulativeFteDays : 0;
  const skillCount = recommendations.length;

  return (
    <div className="space-y-8">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Projected Weekly Savings</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totalWeeklySavings.toFixed(1)} hrs/week
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">12-Week FTE Days Saved</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totalFteDays12Weeks.toFixed(1)} FTE days
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-500">Skills in Plan</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{skillCount}</p>
        </div>
      </div>

      {/* Cumulative FTE Projection Chart */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Cumulative FTE Days Saved</h2>
        <p className="mt-1 text-sm text-gray-600">
          Projected savings over 12 weeks with staggered skill adoption (1 new skill every 2 weeks)
        </p>
        <div className="mt-4">
          <AdoptionRoadmapChart data={projectionData} height={320} />
        </div>
      </div>

      {/* Ranked Adoption List */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Adoption Roadmap</h2>
        <p className="mt-1 text-sm text-gray-600">
          Skills ranked by impact -- adopt in this order for maximum ROI
        </p>
        <div className="mt-4 space-y-6">
          {sorted.map((rec, index) => (
            <div
              key={rec.skillId}
              className="relative ml-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              {/* Step number badge */}
              <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {index + 1}
              </div>

              {/* Start Here callout for first skill */}
              {index === 0 && (
                <div className="mb-3 rounded border-l-4 border-green-400 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-800">
                    Start here -- biggest time savings
                  </p>
                </div>
              )}

              {/* Skill details */}
              <h3 className="font-semibold text-gray-900">{rec.name}</h3>

              <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                {rec.projectedWeeklySavings.toFixed(1)} hrs/week saved
              </span>

              {rec.matchedCategories.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  Matched categories: {rec.matchedCategories.join(", ")}
                </p>
              )}

              <p className="mt-2 text-sm text-gray-700">{rec.personalizedReason}</p>

              <Link
                href={"/skills/" + rec.slug}
                className="mt-3 inline-block text-sm text-blue-600 hover:underline"
              >
                View Skill
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
