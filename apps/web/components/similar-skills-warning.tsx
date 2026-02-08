"use client";

import Link from "next/link";
import type { SimilarSkillResult } from "@/lib/similar-skills";

interface SimilarSkillsWarningProps {
  similarSkills: SimilarSkillResult[];
  onProceed: () => void;
  onCancel: () => void;
  onCreateVariation?: (skillId: string) => void;
  isPending?: boolean;
}

export function SimilarSkillsWarning({
  similarSkills,
  onProceed,
  onCancel,
  onCreateVariation,
  isPending = false,
}: SimilarSkillsWarningProps) {
  if (similarSkills.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-amber-600"
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
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-amber-800">Similar skills found</h3>
          <p className="mt-1 text-sm text-amber-700">
            These existing skills look similar to what you&apos;re creating:
          </p>

          <ul className="mt-4 space-y-3">
            {similarSkills.map((skill) => (
              <li
                key={skill.skillId}
                className="group relative rounded-md border border-amber-200 bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/skills/${skill.skillSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-amber-900 hover:text-amber-700 hover:underline"
                  >
                    {skill.skillName}
                  </Link>
                  <div className="flex items-center gap-2">
                    {skill.similarityPct != null && (
                      <span className="text-sm text-gray-500">{skill.similarityPct}% match</span>
                    )}
                    {onCreateVariation && (
                      <button
                        type="button"
                        onClick={() => onCreateVariation(skill.skillId)}
                        disabled={isPending}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        Create as Variation
                      </button>
                    )}
                  </div>
                </div>

                {/* Hover popup with skill details */}
                {(skill.description || skill.category) && (
                  <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg group-hover:block">
                    <p className="font-semibold text-gray-900">{skill.skillName}</p>
                    {skill.category && (
                      <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {skill.category}
                      </span>
                    )}
                    {skill.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {skill.description.length > 150
                          ? skill.description.slice(0, 150) + "..."
                          : skill.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      {skill.totalUses != null && (
                        <span>
                          {skill.totalUses} {skill.totalUses === 1 ? "use" : "uses"}
                        </span>
                      )}
                      {skill.averageRating != null && (
                        <span>{(skill.averageRating / 100).toFixed(1)} stars</span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={onProceed}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isPending ? "Publishing..." : "Publish Anyway"}
            </button>
          </div>

          <p className="mt-4 text-xs text-amber-600">
            This is just a heads up — you can always publish your skill.
          </p>
        </div>
      </div>
    </div>
  );
}
