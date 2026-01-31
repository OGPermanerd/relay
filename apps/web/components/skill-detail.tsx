import { StatCard } from "./stat-card";
import Image from "next/image";
import type { SkillStats } from "@/lib/skill-stats";

interface SkillWithAuthor {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  content: string;
  hoursSaved: number | null;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface SkillDetailProps {
  skill: SkillWithAuthor;
  stats: SkillStats;
}

export function SkillDetail({ skill, stats }: SkillDetailProps) {
  const formattedDate = skill.createdAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      {/* Header section */}
      <div className="mb-6">
        <div className="mb-3">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm uppercase text-blue-800">
            {skill.category}
          </span>
        </div>
        <h1 className="mb-4 text-3xl font-bold">{skill.name}</h1>
        {skill.author && (
          <div className="flex items-center gap-3">
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
              <p className="font-medium">{skill.author.name || "Anonymous"}</p>
              <p className="text-sm text-gray-500">Created {formattedDate}</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Uses" value={stats.totalUses} />
        <StatCard label="Unique Users" value={stats.uniqueUsers} />
        <StatCard
          label="Avg Rating"
          value={stats.averageRating ?? "N/A"}
          suffix={stats.totalRatings ? `(${stats.totalRatings})` : undefined}
        />
        <StatCard label="FTE Days Saved" value={stats.fteDaysSaved} />
      </div>

      {/* Description section */}
      <div className="mt-8">
        <h2 className="mb-2 text-xl font-semibold">Description</h2>
        <p className="text-gray-700">{skill.description}</p>
      </div>

      {/* Usage section */}
      {skill.hoursSaved && (
        <div className="mt-6">
          <p className="text-sm text-gray-600">
            Estimated time saved per use: {skill.hoursSaved} hour
            {skill.hoursSaved !== 1 ? "s" : ""}
          </p>
        </div>
      )}

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
