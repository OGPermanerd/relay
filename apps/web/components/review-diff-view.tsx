"use client";

import { diffLines, type Change } from "diff";

// =============================================================================
// Types
// =============================================================================

interface ReviewDiffViewProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ReviewDiffView({
  oldContent,
  newContent,
  oldLabel = "Previous Version",
  newLabel = "Current Version",
}: ReviewDiffViewProps) {
  // Short-circuit if contents are identical
  if (oldContent === newContent) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">No differences found</p>
      </div>
    );
  }

  const changes: Change[] = diffLines(oldContent, newContent);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500">{oldLabel}</span>
        <span className="text-xs font-medium text-gray-500">{newLabel}</span>
      </div>

      {/* Diff content */}
      <pre className="text-sm font-mono overflow-x-auto p-0 m-0">
        {changes.map((change, changeIdx) => {
          const lines = change.value.split("\n");
          // Remove trailing empty string from split (trailing newline)
          if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
          }

          let bgClass = "";
          let textClass = "text-gray-700";
          let borderClass = "";
          let prefix = " ";

          if (change.added) {
            bgClass = "bg-green-50";
            textClass = "text-green-800";
            borderClass = "border-l-4 border-green-400";
            prefix = "+";
          } else if (change.removed) {
            bgClass = "bg-red-50";
            textClass = "text-red-800";
            borderClass = "border-l-4 border-red-400";
            prefix = "-";
          }

          return lines.map((line, lineIdx) => (
            <div
              key={`${changeIdx}-${lineIdx}`}
              className={`px-4 py-0.5 ${bgClass} ${textClass} ${borderClass}`}
            >
              <span className="select-none mr-2 text-gray-400">{prefix}</span>
              {line}
            </div>
          ));
        })}
      </pre>
    </div>
  );
}
