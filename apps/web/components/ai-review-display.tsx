import type { ReviewCategories } from "@relay/db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 bg-emerald-50";
  if (score >= 6) return "text-teal-600 bg-teal-50";
  if (score >= 4) return "text-cyan-600 bg-cyan-50";
  return "text-blue-600 bg-blue-50";
}

const categoryLabels: Record<keyof ReviewCategories, string> = {
  functionality: "Functionality",
  quality: "Quality",
  security: "Security",
  clarity: "Clarity",
  completeness: "Completeness",
  reusability: "Reusability",
};

function getCategoryLabel(key: keyof ReviewCategories): string {
  return categoryLabels[key];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiReviewDisplayProps {
  categories: ReviewCategories;
  summary: string;
  reviewedAt: Date;
  modelName: string;
}

export function AiReviewDisplay({
  categories,
  summary,
  reviewedAt,
  modelName,
}: AiReviewDisplayProps) {
  const formattedDate = reviewedAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const categoryKeys = Object.keys(categoryLabels) as (keyof ReviewCategories)[];

  return (
    <div className="space-y-4">
      {/* AI Review badge */}
      <div>
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          AI Review
        </span>
      </div>

      {/* Summary */}
      <div className="border-l-4 border-blue-200 bg-gray-50 rounded-r-lg px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      </div>

      {/* Category score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categoryKeys.map((key) => {
          const { score, suggestions } = categories[key];
          const colorClass = getScoreColor(score);

          return (
            <div key={key} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{getCategoryLabel(key)}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                  {score}/10
                </span>
              </div>
              {suggestions.length > 0 && (
                <ul className="space-y-1">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-300" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400">
        Reviewed {formattedDate} using {modelName}
      </p>
    </div>
  );
}
