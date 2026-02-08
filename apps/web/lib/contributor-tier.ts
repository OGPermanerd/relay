export type ContributorTier = "Platinum" | "Gold" | "Silver" | "Bronze";

interface TierInput {
  skillsShared: number;
  daysSaved: number;
  avgRating: number | null;
  totalUses: number;
}

const TIER_THRESHOLDS = {
  Platinum: 75,
  Gold: 50,
  Silver: 25,
  Bronze: 0,
} as const;

export function getContributorTier(input: TierInput): ContributorTier | null {
  // Normalize each metric to 0-25 points (max 100 total)
  const skillsScore = Math.min(input.skillsShared * 5, 25);
  const daysScore = Math.min(input.daysSaved * 2, 25);
  const ratingScore = input.avgRating !== null ? (input.avgRating / 5) * 25 : 0;
  const usageScore = Math.min(input.totalUses * 0.5, 25);

  const total = skillsScore + daysScore + ratingScore + usageScore;

  if (total === 0) return null;
  if (total >= TIER_THRESHOLDS.Platinum) return "Platinum";
  if (total >= TIER_THRESHOLDS.Gold) return "Gold";
  if (total >= TIER_THRESHOLDS.Silver) return "Silver";
  return "Bronze";
}

export const TIER_COLORS: Record<ContributorTier, string> = {
  Platinum: "text-purple-600",
  Gold: "text-yellow-600",
  Silver: "text-gray-500",
  Bronze: "text-orange-700",
};
