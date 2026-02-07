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

function getOverallScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 6) return "text-teal-700 bg-teal-50 border-teal-200";
  if (score >= 4) return "text-cyan-700 bg-cyan-50 border-cyan-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

const categoryLabels: Record<keyof ReviewCategories, string> = {
  quality: "Quality",
  clarity: "Clarity",
  completeness: "Completeness",
};

const categoryDescriptions: Record<keyof ReviewCategories, string> = {
  quality: "Does it work well and produce good results?",
  clarity: "Is it clear, well-written, and easy to reuse?",
  completeness: "Is it thorough and self-contained?",
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
  reviewedAt: string;
  modelName: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AiReviewDisplay({
  categories,
  summary,
  reviewedAt,
  modelName,
}: AiReviewDisplayProps) {
  const d = new Date(reviewedAt);
  const formattedDate = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

  const categoryKeys = Object.keys(categoryLabels) as (keyof ReviewCategories)[];

  // Compute overall score as average of the 3 category scores
  const overallScore = Math.round(
    categoryKeys.reduce((sum, key) => sum + (categories[key]?.score ?? 0), 0) / categoryKeys.length
  );

  const overallColorClass = getOverallScoreColor(overallScore);

  return (
    <div className="space-y-4">
      {/* Header with badge and overall score */}
      <div className="flex items-center justify-between">
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          AI Review
        </span>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${overallColorClass}`}
        >
          <span className="text-sm font-medium">Overall</span>
          <span className="text-lg font-bold">{overallScore}/10</span>
        </div>
      </div>

      {/* Summary */}
      <div className="border-l-4 border-blue-200 bg-gray-50 rounded-r-lg px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      </div>

      {/* Category score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {categoryKeys.map((key) => {
          const category = categories[key];
          if (!category) return null;
          const { score, suggestions } = category;
          const colorClass = getScoreColor(score);

          return (
            <div key={key} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{getCategoryLabel(key)}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                  {score}/10
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{categoryDescriptions[key]}</p>
              {suggestions.length > 0 && (
                <ul className="space-y-1.5">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
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
