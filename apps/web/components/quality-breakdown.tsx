"use client";

import { useState } from "react";
import { type QualityBreakdown as BreakdownData, type QualityTier } from "@/lib/quality-score";

interface QualityBreakdownProps {
  breakdown: BreakdownData;
  tier: QualityTier;
  score: number;
}

/**
 * Collapsible quality breakdown component.
 *
 * Shows "Why this badge?" toggle that expands to reveal
 * the usage, rating, and documentation score components.
 *
 * For unrated skills, shows a message about needing more ratings.
 * For "none" tier skills, returns null (no breakdown needed).
 */
export function QualityBreakdown({ breakdown, tier, score }: QualityBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // No breakdown for skills with no badge
  if (tier === "none") {
    return null;
  }

  // Special message for unrated skills
  if (tier === "unrated") {
    return <p className="mt-2 text-sm text-gray-500">Need 3+ ratings to earn a quality badge</p>;
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        {isOpen ? "Hide" : "Why this badge?"}
        <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="mt-2 rounded-lg bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-medium">Quality Score: {Math.round(score)}/100</p>
          <ul className="space-y-1 text-gray-600">
            <li>Usage (50% weight): {breakdown.usageScore.toFixed(1)}/50</li>
            <li>Rating (35% weight): {breakdown.ratingScore.toFixed(1)}/35</li>
            <li>Documentation (15% weight): {breakdown.docsScore.toFixed(1)}/15</li>
          </ul>
        </div>
      )}
    </div>
  );
}
