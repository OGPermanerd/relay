"use client";

import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { ImpactTimelineChart } from "@/components/impact-timeline-chart";
import { ImpactCalculator } from "@/components/impact-calculator";
import type {
  PortfolioStats,
  PortfolioSkill,
  ContributionRanking,
  TimelineEvent,
  ImpactCalculatorStats,
} from "@/lib/portfolio-queries";

interface PortfolioViewProps {
  stats: PortfolioStats;
  skills: PortfolioSkill[];
  ranking: ContributionRanking;
  timeline: TimelineEvent[];
  impactStats: ImpactCalculatorStats;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "personal") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Portable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      Company
    </span>
  );
}

export function PortfolioView({
  stats,
  skills,
  ranking,
  timeline,
  impactStats,
}: PortfolioViewProps) {
  const hasSkills = stats.skillsAuthored > 0;
  const rankingSubtitle =
    ranking.rank === 0
      ? "No ranking yet"
      : ranking.totalContributors > 20
        ? `${ranking.label} of contributors`
        : `Ranked ${ranking.label}`;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Portfolio</h1>
          <p className="mt-1 text-sm text-gray-500">{rankingSubtitle}</p>
        </div>
        <Link
          href="/portfolio/resume"
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Skills Resume
        </Link>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Skills Authored" value={stats.skillsAuthored} />
        <StatCard label="Total Uses" value={stats.totalUses.toLocaleString()} />
        <StatCard label="Hours Saved" value={stats.totalHoursSaved.toFixed(1)} />
        <StatCard label="Contribution Rank" value={ranking.rank === 0 ? "N/A" : ranking.label} />
      </div>

      {/* Portable vs Company IP Breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Portable Skills Card */}
        <div className="rounded-lg border-l-4 border-green-500 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs text-green-700">
              P
            </span>
            <h3 className="text-lg font-semibold text-gray-900">Portable Skills</h3>
          </div>
          <p className="mb-4 text-sm text-gray-500">Skills you own regardless of employer</p>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.portableSkills}</p>
              <p className="text-sm text-gray-500">skills</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.portableHoursSaved.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500">hours saved</p>
            </div>
          </div>
        </div>

        {/* Company Skills Card */}
        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
              C
            </span>
            <h3 className="text-lg font-semibold text-gray-900">Company Skills</h3>
          </div>
          <p className="mb-4 text-sm text-gray-500">Skills owned by your organization</p>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.companySkills}</p>
              <p className="text-sm text-gray-500">skills</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.companyHoursSaved.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500">hours saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Timeline */}
      <ImpactTimelineChart data={timeline} />

      {/* Impact Calculator */}
      <ImpactCalculator stats={impactStats} />

      {/* Skills List */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Skills</h2>

        {hasSkills ? (
          <div className="space-y-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={`/skills/${skill.slug}`}
                    className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {skill.name}
                  </Link>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {skill.category}
                  </span>
                  <VisibilityBadge visibility={skill.visibility} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{skill.totalUses.toLocaleString()} uses</span>
                  <span>{skill.totalHoursSaved.toFixed(1)}h saved</span>
                  <span>
                    {skill.avgRating != null ? `${skill.avgRating} rating` : "No ratings"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-gray-500">
              You haven&apos;t published any skills yet. Create your first skill to start building
              your portfolio.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
