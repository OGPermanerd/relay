"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";

// Quality tier values for filtering
const QUALITY_TIERS = ["gold", "silver", "bronze"] as const;
type QualityTier = (typeof QUALITY_TIERS)[number];

const QUALITY_LABELS: Record<QualityTier, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

/**
 * Quality tier filter dropdown with URL synchronization
 *
 * Shows "All qualities" plus each tier as selectable options.
 * Uses nuqs to sync to URL 'qualityTier' parameter.
 */
export function QualityFilter() {
  const [qualityTier, setQualityTier] = useQueryState(
    "qualityTier",
    parseAsStringEnum(QUALITY_TIERS as unknown as string[])
      .withDefault(null as unknown as QualityTier)
      .withOptions({ shallow: false })
  );
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(() => {
      if (value === "") {
        setQualityTier(null);
      } else {
        setQualityTier(value as QualityTier);
      }
    });
  };

  return (
    <select
      value={qualityTier || ""}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      disabled={isPending}
    >
      <option value="">All qualities</option>
      {QUALITY_TIERS.map((tier) => (
        <option key={tier} value={tier}>
          {QUALITY_LABELS[tier]}
        </option>
      ))}
    </select>
  );
}
