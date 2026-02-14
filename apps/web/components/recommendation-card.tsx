import Link from "next/link";
import type { SkillRecommendation } from "@/lib/skill-recommendations";

export function RecommendationCard({
  recommendation,
}: {
  recommendation: SkillRecommendation;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header: skill name + projected savings badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {recommendation.name}
        </h3>
        <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          {recommendation.projectedWeeklySavings.toFixed(1)}h saved/week
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-sm text-gray-700">
        {recommendation.description}
      </p>

      {/* Personalized reason callout */}
      <div className="mt-3 rounded border-l-4 border-blue-400 bg-blue-50 p-3">
        <p className="text-sm text-blue-800">{recommendation.personalizedReason}</p>
      </div>

      {/* Footer: metadata + view link */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            {recommendation.totalUses}{" "}
            {recommendation.totalUses === 1 ? "use" : "uses"}
          </span>
          {recommendation.averageRating !== null && (
            <span>
              {"⭐"} {(recommendation.averageRating / 100).toFixed(1)}
            </span>
          )}
        </div>
        <Link
          href={`/skills/${recommendation.slug}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          View Skill
        </Link>
      </div>
    </div>
  );
}
