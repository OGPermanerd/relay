import { type QualityTier, QUALITY_TIERS } from "../lib/quality-score";

interface QualityBadgeProps {
  tier: QualityTier;
  size?: "sm" | "md";
}

/**
 * Quality badge component displaying tier badges.
 *
 * Styling by tier:
 * - Gold: #FFD700 background, dark text
 * - Silver: #C0C0C0 background, dark text
 * - Bronze: #CD7F32 background, white text
 * - Unrated: gray-200 background, gray-600 text
 * - None: returns null (no badge displayed)
 */
export function QualityBadge({ tier, size = "sm" }: QualityBadgeProps) {
  // "none" tier means no badge should be displayed
  if (tier === "none") {
    return null;
  }

  const tierInfo = QUALITY_TIERS[tier];

  // Size-based classes
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  // Tier-specific styling
  const tierStyles: Record<
    Exclude<QualityTier, "none">,
    { backgroundColor: string; color: string }
  > = {
    gold: {
      backgroundColor: "#FFD700",
      color: "#1F2937", // gray-800 for contrast
    },
    silver: {
      backgroundColor: "#C0C0C0",
      color: "#1F2937", // gray-800 for contrast
    },
    bronze: {
      backgroundColor: "#CD7F32",
      color: "#FFFFFF", // white for contrast
    },
    unrated: {
      backgroundColor: "#E5E7EB", // gray-200
      color: "#4B5563", // gray-600
    },
  };

  const style = tierStyles[tier];

  return (
    <span
      className={`inline-block rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {tierInfo.label}
    </span>
  );
}
