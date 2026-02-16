"use client";

import type { ResumeData } from "@/lib/resume-queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a number with commas, no decimals (hydration-safe, no toLocaleString) */
function formatNumber(value: number): string {
  return value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format an ISO date string to "Mon YYYY" (UTC, hydration-safe) */
function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QualityBadge({ tier }: { tier: string }) {
  if (tier === "Gold") {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        Gold
      </span>
    );
  }
  if (tier === "Silver") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        Silver
      </span>
    );
  }
  if (tier === "Bronze") {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
        Bronze
      </span>
    );
  }
  return null;
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ResumeViewProps {
  data: ResumeData;
  isPublic?: boolean;
}

export function ResumeView({ data, isPublic }: ResumeViewProps) {
  const hasQualityAchievements =
    data.qualityAchievements.gold > 0 ||
    data.qualityAchievements.silver > 0 ||
    data.qualityAchievements.bronze > 0;

  const hasContributionSpan =
    data.contributionSpan.first !== null && data.contributionSpan.latest !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Resume Card */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-6">
          <h2 className="text-2xl font-bold text-gray-900">{data.userName || "Skills Resume"}</h2>
          <p className="mt-1 text-lg text-gray-600">Skills Resume</p>
          <p className="mt-0.5 text-xs text-gray-400">Generated via EverySkill</p>
        </div>

        {/* Impact Summary */}
        <div className="grid grid-cols-2 gap-4 border-b border-gray-200 px-6 py-6 lg:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.skillsAuthored}</p>
            <p className="text-sm text-gray-500">Skills Authored</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(data.totalHoursSaved)}</p>
            <p className="text-sm text-gray-500">Hours Saved</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(data.peopleHelped)}</p>
            <p className="text-sm text-gray-500">People Helped</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">${formatNumber(data.estimatedValue)}</p>
            <p className="text-sm text-gray-500">Estimated Value</p>
          </div>
        </div>

        {/* Quality Achievements */}
        {hasQualityAchievements && (
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Quality Achievements
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.qualityAchievements.gold > 0 && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                  {data.qualityAchievements.gold} Gold
                </span>
              )}
              {data.qualityAchievements.silver > 0 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  {data.qualityAchievements.silver} Silver
                </span>
              )}
              {data.qualityAchievements.bronze > 0 && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                  {data.qualityAchievements.bronze} Bronze
                </span>
              )}
            </div>
          </div>
        )}

        {/* Contribution Timeline */}
        {hasContributionSpan && (
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Contribution Timeline
            </h3>
            <p className="text-sm text-gray-700">
              Active since {formatMonthYear(data.contributionSpan.first!)} &middot; Latest
              contribution {formatMonthYear(data.contributionSpan.latest!)}
            </p>
          </div>
        )}

        {/* Skills List */}
        <div className="px-6 py-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Skills
          </h3>

          {data.skills.length > 0 ? (
            <div className="space-y-3">
              {data.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{skill.name}</span>
                      <QualityBadge tier={skill.qualityTier} />
                      <VisibilityBadge visibility={skill.visibility} />
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {skill.category} &middot; {formatNumber(skill.totalUses)} uses &middot;{" "}
                      {formatNumber(skill.totalHoursSaved)} hours saved
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No skills to display</p>
          )}
        </div>

        {/* Footer (public page only) */}
        {isPublic && (
          <div className="border-t border-gray-200 px-6 py-4 text-center">
            <p className="text-xs text-gray-400">
              View full profile at{" "}
              <a
                href="https://everyskill.ai"
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                everyskill.ai
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
