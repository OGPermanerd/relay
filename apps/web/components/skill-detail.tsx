import { StatCard } from "./stat-card";
import Image from "next/image";
import Link from "next/link";
import type { SkillStats } from "@/lib/skill-stats";
import type { SkillDetailTrends } from "@/lib/skill-detail-trends";
import type { LoomOEmbedResponse } from "@/lib/loom";
import { calculateQualityScore } from "@/lib/quality-score";
import { QualityBadge } from "./quality-badge";
import { QualityBreakdown } from "./quality-breakdown";
import { ForkAttribution } from "./fork-attribution";
import { DriftIndicator } from "./drift-indicator";
import { LoomEmbed } from "./loom-embed";
import { RelativeTime } from "@/components/relative-time";
import { FTE_DAYS_PER_YEAR } from "@/lib/constants";

interface SkillWithAuthor {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  content: string;
  hoursSaved: number | null;
  totalUses: number;
  averageRating: number | null;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface ParentSkillInfo {
  id: string;
  name: string;
  slug: string;
  author: { id: string; name: string | null } | null;
}

interface SkillDetailProps {
  skill: SkillWithAuthor;
  stats: SkillStats;
  trends: SkillDetailTrends;
  forkCount?: number;
  parentSkill?: ParentSkillInfo | null;
  driftStatus?: "diverged" | "current" | "unknown";
  compareSlug?: string;
  loomVideoId?: string | null;
  loomEmbed?: LoomOEmbedResponse | null;
}

export function SkillDetail({
  skill,
  stats,
  trends,
  forkCount,
  parentSkill,
  driftStatus,
  compareSlug,
  loomVideoId,
  loomEmbed,
}: SkillDetailProps) {
  // Calculate quality score for badge and breakdown
  const { score, tier, breakdown } = calculateQualityScore({
    totalUses: skill.totalUses,
    averageRating: skill.averageRating,
    totalRatings: stats.totalRatings,
    hasDescription: Boolean(skill.description),
    hasCategory: Boolean(skill.category),
  });

  return (
    <div>
      {/* Header section */}
      <div className="mb-6">
        <div className="mb-3">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm uppercase text-blue-800">
            {skill.category || "Uncategorized"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{skill.name}</h1>
          <QualityBadge tier={tier} size="md" />
        </div>
        {parentSkill && <ForkAttribution parentSkill={parentSkill} />}
        {driftStatus && <DriftIndicator driftStatus={driftStatus} compareSlug={compareSlug} />}
        <QualityBreakdown breakdown={breakdown} tier={tier} score={score} />
        {skill.author && (
          <div className="mt-4 flex items-center gap-3">
            <Link href={`/users/${skill.author.id}`} className="flex items-center gap-3 group">
              {skill.author.image ? (
                <Image
                  src={skill.author.image}
                  alt={skill.author.name || "Author"}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {skill.author.name?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <div>
                <p className="font-medium group-hover:text-blue-600 transition-colors">
                  {skill.author.name || "Anonymous"}
                </p>
                <p className="text-sm text-gray-500">
                  Created <RelativeTime date={skill.createdAt} />
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="FTE Years Saved"
          value={(Number(stats.fteDaysSaved) / FTE_DAYS_PER_YEAR).toFixed(2)}
          trendData={trends.daysSavedTrend}
          trendColor="#10b981"
        />
        <StatCard
          label="Total Uses"
          value={stats.totalUses}
          trendData={trends.usesTrend}
          trendColor="#3b82f6"
        />
        <StatCard
          label="Unique Users"
          value={stats.uniqueUsers}
          trendData={trends.usersTrend}
          trendColor="#8b5cf6"
        />
        <StatCard
          label="Avg Rating"
          value={stats.averageRating ?? "N/A"}
          suffix={stats.totalRatings ? `(${stats.totalRatings})` : undefined}
        />
        {forkCount != null && forkCount > 0 && <StatCard label="Forks" value={forkCount} />}
      </div>

      {/* Demo Video section (Loom embed) */}
      {loomVideoId && (
        <div className="mt-8">
          <h2 className="mb-2 text-xl font-semibold">Demo Video</h2>
          <LoomEmbed
            videoId={loomVideoId}
            title={loomEmbed?.title}
            duration={loomEmbed?.duration}
          />
        </div>
      )}

      {/* Description section */}
      <div className="mt-8">
        <h2 className="mb-2 text-xl font-semibold">Description</h2>
        <p className="text-gray-700">{skill.description || "No description provided."}</p>
      </div>

      {/* Usage section */}
      <div className="mt-6">
        <p className="text-sm text-gray-600">
          Estimated time saved per use: {stats.hoursSavedEstimate} hour
          {stats.hoursSavedEstimate !== 1 ? "s" : ""}{" "}
          <span className="text-gray-400">
            (
            {stats.hoursSavedSource === "user"
              ? `avg of ${stats.totalRatings} user estimate${stats.totalRatings !== 1 ? "s" : ""}`
              : "creator estimate"}
            )
          </span>
        </p>
      </div>

      {/* Content section */}
      <div className="mt-8">
        <h2 className="mb-2 text-xl font-semibold">Skill Content</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-900 p-4 text-gray-100">
          <code>{skill.content}</code>
        </pre>
      </div>

      {/* Visual separator for page-level additions (rating form, reviews) */}
      <div className="mt-8 border-t border-gray-200" />
    </div>
  );
}
