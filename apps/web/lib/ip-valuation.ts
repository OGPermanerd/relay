import type {
  IpDashboardStats,
  IpRiskEmployee,
  AtRiskSkillAlert,
  QualityTrendPoint,
} from "@/lib/ip-dashboard-queries";

// =============================================================================
// Constants
// =============================================================================

/** Knowledge worker hourly rate used in replacement cost calculations */
export const HOURLY_RATE = 150;

// =============================================================================
// Types
// =============================================================================

/**
 * Raw skill valuation data from SQL query.
 * Contains the inputs needed to calculate replacement cost.
 */
export interface SkillValuationRow {
  skillId: string;
  name: string;
  slug: string;
  category: string;
  authorName: string | null;
  authorEmail: string;
  totalUses: number;
  hoursSaved: number;
  contentLength: number;
  averageRating: number | null; // stored as rating * 100 (0-500), null if unrated
  riskLevel: "critical" | "high" | null;
}

/**
 * A skill with its computed replacement cost.
 * Extends the raw row with the calculated value.
 */
export interface SkillValuation extends SkillValuationRow {
  replacementCost: number;
}

/**
 * Complete IP report data payload for PDF/CSV export.
 * Aggregates all data needed to render the full report.
 */
export interface IpReportData {
  totalValue: number;
  stats: IpDashboardStats;
  skills: SkillValuation[];
  riskEmployees: IpRiskEmployee[];
  riskAlerts: AtRiskSkillAlert[];
  trends: QualityTrendPoint[];
}

// =============================================================================
// Formula Functions
// =============================================================================

/**
 * Calculate the replacement cost for a single skill.
 *
 * Formula:
 * - Base value = hoursSaved * totalUses * HOURLY_RATE
 * - Complexity multiplier = 1 + log10(max(contentLength, 1000) / 1000), clamped [1.0, 2.0]
 * - Quality multiplier = 0.5 + (normalizedQuality * 0.5), range [0.5, 1.0]
 *   - averageRating is stored as rating*100 (range 0-500); normalized to 0-1
 *   - null defaults to 0.6 (slightly above midpoint)
 *
 * @param totalUses - Number of times the skill has been used
 * @param hoursSaved - Estimated hours saved per use
 * @param contentLength - Length of skill content in characters
 * @param averageRating - Average rating * 100 (0-500), or null if unrated
 * @returns Replacement cost in dollars, rounded to nearest integer
 */
export function calculateReplacementCost(
  totalUses: number,
  hoursSaved: number,
  contentLength: number,
  averageRating: number | null
): number {
  // Base value: hours impact * rate
  const baseValue = hoursSaved * totalUses * HOURLY_RATE;

  // Complexity: longer content = harder to recreate
  const normalizedLength = Math.max(contentLength, 1000) / 1000;
  const complexityMultiplier = Math.min(Math.max(1 + Math.log10(normalizedLength), 1.0), 2.0);

  // Quality: higher-rated skills are more valuable
  // averageRating is stored as rating*100 (0-500), normalize to 0-1
  const normalizedQuality = averageRating != null ? Math.min(averageRating / 500, 1.0) : 0.6;
  const qualityMultiplier = 0.5 + normalizedQuality * 0.5;

  return Math.round(baseValue * complexityMultiplier * qualityMultiplier);
}

/**
 * Compute replacement costs for an array of skill valuation rows.
 *
 * @param rows - Raw skill valuation data from SQL
 * @returns Skills with computed replacementCost field
 */
export function computeSkillValuations(rows: SkillValuationRow[]): SkillValuation[] {
  return rows.map((row) => ({
    ...row,
    replacementCost: calculateReplacementCost(
      row.totalUses,
      row.hoursSaved,
      row.contentLength,
      row.averageRating
    ),
  }));
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format a number as USD currency string (hydration-safe).
 * Uses manual regex for comma separators instead of toLocaleString()
 * to avoid Node.js/browser Intl differences that cause hydration mismatches.
 *
 * @param value - Number to format
 * @returns Formatted string, e.g. "1,234,567.89"
 */
export function formatCurrency(value: number): string {
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withCommas}.${decPart}`;
}
