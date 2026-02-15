/**
 * Pricing table re-exports and display helpers.
 *
 * The canonical pricing data lives in @everyskill/db/services/pricing
 * (pure TypeScript, no framework deps). This module re-exports it
 * and adds display formatting for the web app.
 */

export { ANTHROPIC_PRICING, estimateCostMicrocents } from "@everyskill/db/services/pricing";
export type { ModelPricing } from "@everyskill/db/services/pricing";

/**
 * Format a microcent value as a dollar string for display.
 * 1 microcent = $0.00000001 (one hundred-millionth of a dollar)
 *
 * Examples:
 *   0 → "$0.00"
 *   300 → "$0.000003"
 *   100000 → "$0.001"
 *   45000000 → "$0.45"
 */
export function formatCostMicrocents(microcents: number): string {
  if (microcents === 0) return "$0.00";

  // 1 microcent = 1e-6 cents = 1e-8 dollars
  const dollars = microcents / 1e8;

  // Use enough decimal places to show meaningful digits
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`;
  } else if (dollars >= 0.01) {
    return `$${dollars.toFixed(4)}`;
  } else if (dollars >= 0.0001) {
    return `$${dollars.toFixed(6)}`;
  } else {
    // Very small amounts - show enough precision
    return `$${dollars.toPrecision(2)}`;
  }
}
