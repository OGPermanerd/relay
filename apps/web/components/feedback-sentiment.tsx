"use client";

interface FeedbackSentimentProps {
  totalFeedback: number;
  positivePct: number | null;
  last30DaysTotal: number;
  last30DaysPositivePct: number | null;
}

export function FeedbackSentiment({
  totalFeedback,
  positivePct,
  last30DaysTotal,
  last30DaysPositivePct,
}: FeedbackSentimentProps) {
  if (totalFeedback === 0) return null;

  // Use 30-day stats if available, otherwise all-time
  const displayPct = last30DaysTotal > 0 ? last30DaysPositivePct : positivePct;
  const displayTotal = last30DaysTotal > 0 ? last30DaysTotal : totalFeedback;
  const periodLabel = last30DaysTotal > 0 ? "last 30 days" : "all time";

  if (displayPct === null) return null;

  return (
    <div className="text-xs text-gray-500 mt-1">
      <span
        className={
          displayPct >= 80
            ? "text-green-600 font-medium"
            : displayPct >= 50
              ? "text-yellow-600 font-medium"
              : "text-red-600 font-medium"
        }
      >
        {displayPct}% positive
      </span>{" "}
      ({displayTotal} vote{displayTotal !== 1 ? "s" : ""}, {periodLabel})
    </div>
  );
}
