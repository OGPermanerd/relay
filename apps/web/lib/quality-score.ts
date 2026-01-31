/**
 * Quality score calculation for skills.
 *
 * Quality score is calculated from:
 * - Usage (50%): How often the skill is used (capped at 100 uses)
 * - Rating (35%): Average user rating (requires >= 3 ratings)
 * - Documentation (15%): Has description AND category
 *
 * Tier assignment:
 * - "unrated" - Less than 3 ratings (not enough data)
 * - "gold" - Score >= 75
 * - "silver" - Score >= 50
 * - "bronze" - Score >= 25
 * - "none" - Score < 25
 */

export type QualityTier = "gold" | "silver" | "bronze" | "none" | "unrated";

export interface QualityScoreInput {
  totalUses: number;
  averageRating: number | null; // Stored as rating * 100, e.g., 425 = 4.25
  totalRatings: number;
  hasDescription: boolean;
  hasCategory: boolean;
}

export interface QualityBreakdown {
  usageScore: number;
  ratingScore: number;
  docsScore: number;
}

export interface QualityScoreResult {
  score: number;
  tier: QualityTier;
  breakdown: QualityBreakdown;
}

interface TierInfo {
  threshold: number;
  color: string;
  label: string;
}

export const QUALITY_TIERS: Record<QualityTier, TierInfo> = {
  gold: {
    threshold: 75,
    color: "#FFD700",
    label: "Gold",
  },
  silver: {
    threshold: 50,
    color: "#C0C0C0",
    label: "Silver",
  },
  bronze: {
    threshold: 25,
    color: "#CD7F32",
    label: "Bronze",
  },
  none: {
    threshold: 0,
    color: "#6B7280",
    label: "No Badge",
  },
  unrated: {
    threshold: -1, // Special case - determined by rating count, not score
    color: "#9CA3AF",
    label: "Unrated",
  },
};

const MIN_RATINGS_FOR_SCORE = 3;
const USAGE_CAP = 100;
const MAX_RATING = 500; // 5.0 stored as 500

// Weight components
const USAGE_WEIGHT = 50;
const RATING_WEIGHT = 35;
const DOCS_WEIGHT = 15;

/**
 * Calculate quality score and tier for a skill.
 *
 * @param input - The skill's metrics
 * @returns Score (0-100), tier, and breakdown
 */
export function calculateQualityScore(input: QualityScoreInput): QualityScoreResult {
  const { totalUses, averageRating, totalRatings, hasDescription, hasCategory } = input;

  // Calculate usage component (50% max)
  // Caps at 100 uses for full points
  const usageScore = Math.min(totalUses / USAGE_CAP, 1) * USAGE_WEIGHT;

  // Calculate rating component (35% max)
  // Only counts if skill has >= 3 ratings
  let ratingScore = 0;
  if (totalRatings >= MIN_RATINGS_FOR_SCORE && averageRating !== null) {
    ratingScore = (averageRating / MAX_RATING) * RATING_WEIGHT;
  }

  // Calculate documentation component (15% max)
  // Requires BOTH description and category
  const docsScore = hasDescription && hasCategory ? DOCS_WEIGHT : 0;

  // Total score (0-100)
  const score = usageScore + ratingScore + docsScore;

  // Determine tier
  const tier = determineTier(score, totalRatings);

  return {
    score,
    tier,
    breakdown: {
      usageScore,
      ratingScore,
      docsScore,
    },
  };
}

/**
 * Determine quality tier from score and rating count.
 */
function determineTier(score: number, totalRatings: number): QualityTier {
  // Unrated if not enough ratings to determine quality
  if (totalRatings < MIN_RATINGS_FOR_SCORE) {
    return "unrated";
  }

  // Apply tier thresholds
  if (score >= QUALITY_TIERS.gold.threshold) {
    return "gold";
  }
  if (score >= QUALITY_TIERS.silver.threshold) {
    return "silver";
  }
  if (score >= QUALITY_TIERS.bronze.threshold) {
    return "bronze";
  }

  return "none";
}

/**
 * Convenience function to get just the tier.
 *
 * @param input - The skill's metrics
 * @returns The quality tier
 */
export function getQualityTier(input: QualityScoreInput): QualityTier {
  return calculateQualityScore(input).tier;
}
