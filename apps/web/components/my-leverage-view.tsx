"use client";

import { useState, useCallback } from "react";
import { StatCard } from "@/components/stat-card";
import { loadMoreUsage } from "@/app/actions/my-leverage";

interface SerializedTimelineEntry {
  skillId: string | null;
  skillName: string | null;
  category: string | null;
  action: string;
  timestamp: string; // ISO string (serialized from Date)
  hoursSaved: number;
}

interface CreatedSkillEntry {
  skillId: string;
  name: string;
  category: string;
  totalUses: number;
  hoursPerUse: number;
  totalHoursSaved: number;
  uniqueUsers: number;
  avgRating: number | null;
}

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

interface MyLeverageViewProps {
  skillsUsed: SerializedTimelineEntry[];
  skillsUsedStats: SkillsUsedStats;
  skillsCreated: CreatedSkillEntry[];
  skillsCreatedStats: SkillsCreatedStats;
  skillsUsedTotal: number;
}

function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

const ACTION_COLORS: Record<string, string> = {
  search: "bg-purple-100 text-purple-700",
  list: "bg-green-100 text-green-700",
  deploy: "bg-blue-100 text-blue-700",
  install: "bg-orange-100 text-orange-700",
};

function ActionBadge({ action }: { action: string }) {
  const colorClass = ACTION_COLORS[action] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {action}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {category}
    </span>
  );
}

export function MyLeverageView({
  skillsUsed: initialSkillsUsed,
  skillsUsedStats,
  skillsCreated,
  skillsCreatedStats,
  skillsUsedTotal,
}: MyLeverageViewProps) {
  const [items, setItems] = useState<SerializedTimelineEntry[]>(initialSkillsUsed);
  const [loading, setLoading] = useState(false);
  const hasMore = items.length < skillsUsedTotal;

  const handleLoadMore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadMoreUsage(items.length);
      if (result.items) {
        setItems((prev) => [...prev, ...result.items]);
      }
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  const hasUsageData = skillsUsedStats.totalActions > 0;
  const hasCreatedData = skillsCreatedStats.skillsPublished > 0;

  return (
    <div className="space-y-8">
      {/* Skills Used Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Skills Used</h2>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Skills Used" value={skillsUsedStats.totalSkills} />
          <StatCard label="FTE Hours Saved" value={skillsUsedStats.totalHoursSaved.toFixed(1)} />
          <StatCard label="Total Actions" value={skillsUsedStats.totalActions} />
          <StatCard label="Most Used" value={skillsUsedStats.mostUsedSkill || "None yet"} />
        </div>

        {/* Timeline List */}
        {hasUsageData ? (
          <div className="space-y-2">
            {items.map((entry, index) => (
              <div
                key={`${entry.skillId}-${entry.timestamp}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">
                    {entry.skillName || "Unknown Skill"}
                  </span>
                  <ActionBadge action={entry.action} />
                  {entry.category && <CategoryBadge category={entry.category} />}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{entry.hoursSaved.toFixed(1)}h saved</span>
                  <span>{formatRelativeDate(entry.timestamp)}</span>
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-gray-500">Start using skills via MCP to see your leverage here</p>
          </div>
        )}
      </section>

      {/* Skills Created Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Skills Created</h2>

        {/* Stats Grid */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Skills Published" value={skillsCreatedStats.skillsPublished} />
          <StatCard
            label="Hours Saved by Others"
            value={skillsCreatedStats.hoursSavedByOthers.toFixed(1)}
          />
          <StatCard label="Unique Users" value={skillsCreatedStats.uniqueUsers} />
          <StatCard
            label="Avg Rating"
            value={
              skillsCreatedStats.avgRating != null ? skillsCreatedStats.avgRating.toFixed(1) : "N/A"
            }
          />
        </div>

        {/* Created Skills List */}
        {hasCreatedData ? (
          <div className="space-y-2">
            {skillsCreated.map((skill) => (
              <div
                key={skill.skillId}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{skill.name}</span>
                  <CategoryBadge category={skill.category} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{skill.totalUses} uses</span>
                  <span>{skill.totalHoursSaved.toFixed(1)}h saved</span>
                  <span>{skill.uniqueUsers} users</span>
                  <span>
                    {skill.avgRating != null
                      ? `${skill.avgRating.toFixed(1)} rating`
                      : "No ratings"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-gray-500">Publish skills to see how others benefit from your work</p>
          </div>
        )}
      </section>
    </div>
  );
}
