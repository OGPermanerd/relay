"use client";

import Link from "next/link";
import type { SimilarSkillResult } from "@relay/db/services";

interface SimilarSkillsWarningProps {
  similarSkills: SimilarSkillResult[];
  onProceed: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function SimilarSkillsWarning({
  similarSkills,
  onProceed,
  onCancel,
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
                className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-4 py-3"
              >
                <Link
                  href={`/skills/${skill.skillSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber-900 hover:text-amber-700 hover:underline"
                >
                  {skill.skillName}
                </Link>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  {Math.round(skill.similarity * 100)}% similar
                </span>
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
