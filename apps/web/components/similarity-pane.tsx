"use client";

import Link from "next/link";
import type { SimilarSkillResult } from "@/lib/similar-skills";

interface SimilarityPaneProps {
  similarSkills: SimilarSkillResult[];
  onProceed: () => void;
  onCancel: () => void;
  onCreateVariation: (skillId: string) => void;
  onMessageAuthor?: (skill: SimilarSkillResult) => void;
  isPending: boolean;
}

function similarityColor(pct: number): {
  bar: string;
  text: string;
  bg: string;
} {
  if (pct >= 80) return { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" };
  if (pct >= 50) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
}

export function SimilarityPane({
  similarSkills,
  onProceed,
  onCancel,
  onCreateVariation,
  onMessageAuthor,
  isPending,
}: SimilarityPaneProps) {
  if (similarSkills.length === 0) return null;

  return (
    <div className="w-full lg:w-80 flex-shrink-0">
      <div className="rounded-lg border border-amber-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-amber-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h3 className="text-base font-semibold text-gray-900">Similar Skills Found</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {similarSkills.length}
            </span>
          </div>
        </div>

        {/* Skill cards */}
        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto p-3 space-y-3">
          {similarSkills.map((skill) => {
            const pct = skill.similarityPct ?? 0;
            const colors = similarityColor(pct);

            return (
              <div
                key={skill.skillId}
                className="rounded-md border border-gray-200 bg-white p-3 space-y-2"
              >
                {/* Name + similarity */}
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/skills/${skill.skillSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline leading-tight"
                  >
                    {skill.skillName}
                  </Link>
                  {skill.similarityPct != null && (
                    <span className={`text-xs font-semibold whitespace-nowrap ${colors.text}`}>
                      {skill.similarityPct}%
                    </span>
                  )}
                </div>

                {/* Similarity bar */}
                {skill.similarityPct != null && (
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full ${colors.bar}`}
                      style={{ width: `${Math.min(skill.similarityPct, 100)}%` }}
                    />
                  </div>
                )}

                {/* Description */}
                {skill.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {skill.description.length > 100
                      ? skill.description.slice(0, 100) + "..."
                      : skill.description}
                  </p>
                )}

                {/* Category + stats */}
                <div className="flex items-center gap-2 flex-wrap">
                  {skill.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {skill.category}
                    </span>
                  )}
                  {skill.totalUses != null && (
                    <span className="text-xs text-gray-400">
                      {skill.totalUses} {skill.totalUses === 1 ? "use" : "uses"}
                    </span>
                  )}
                  {skill.averageRating != null && (
                    <span className="text-xs text-gray-400">
                      {(skill.averageRating / 100).toFixed(1)} stars
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onCreateVariation(skill.skillId)}
                    disabled={isPending}
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Create as Variation
                  </button>
                  {onMessageAuthor && (
                    <button
                      type="button"
                      onClick={() => onMessageAuthor(skill)}
                      disabled={isPending}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Message Author
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={onProceed}
              disabled={isPending}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isPending ? "Publishing..." : "Publish Anyway"}
            </button>
          </div>
          <p className="text-xs text-center text-gray-400">
            This is just a heads up -- you can always publish your skill.
          </p>
        </div>
      </div>
    </div>
  );
}
