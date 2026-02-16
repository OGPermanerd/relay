"use client";

import type { ChangeItem } from "@/lib/change-detection";

interface ChangeSummaryProps {
  changes: ChangeItem[];
}

function ChangeIcon({ type }: { type: ChangeItem["type"] }) {
  switch (type) {
    case "version_bump":
      return (
        <svg
          className="h-4 w-4 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
          />
        </svg>
      );
    case "new_feedback":
      return (
        <svg
          className="h-4 w-4 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      );
    case "description_updated":
      return (
        <svg
          className="h-4 w-4 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
          />
        </svg>
      );
  }
}

/**
 * Displays a summary of changes since the user's last visit.
 * Renders nothing if there are no changes (first visit or no updates).
 */
export function ChangeSummary({ changes }: ChangeSummaryProps) {
  if (changes.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="mb-3 flex items-center gap-2">
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
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
          />
        </svg>
        <h3 className="text-sm font-semibold text-amber-800">
          What&apos;s changed since your last visit
        </h3>
      </div>
      <ul className="space-y-2">
        {changes.map((change, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-amber-700">
            <ChangeIcon type={change.type} />
            <span>{change.label}</span>
            {change.detail && <span className="text-amber-500">({change.detail})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
