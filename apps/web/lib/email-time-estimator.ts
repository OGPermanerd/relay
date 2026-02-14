import type { EmailCategory, ClassifiedEmail } from "./email-classifier";

/**
 * Time estimation for email processing
 *
 * Applies per-category time weights (in minutes) to estimate how much time
 * a user spends reading/responding to different types of emails.
 */

// ---------------------------------------------------------------------------
// Default time weights (minutes per email)
// ---------------------------------------------------------------------------

/**
 * Default time weights per category (in minutes).
 * Based on industry research and user studies:
 * - Newsletters: quick scan or delete (0.5min)
 * - Automated notifications: quick review (0.3min)
 * - Meeting invites: read + calendar check (2min)
 * - Direct messages: read + thoughtful response (3min)
 * - Internal threads: read context + contribute (4min)
 * - Vendor/external: read + response + context switching (3.5min)
 * - Support tickets: diagnosis + detailed response (5min)
 */
export const DEFAULT_TIME_WEIGHTS: Record<EmailCategory, number> = {
  newsletter: 0.5,
  "automated-notification": 0.3,
  "meeting-invite": 2.0,
  "direct-message": 3.0,
  "internal-thread": 4.0,
  "vendor-external": 3.5,
  "support-ticket": 5.0,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeEstimate {
  category: EmailCategory;
  count: number;
  estimatedMinutes: number;
}

// ---------------------------------------------------------------------------
// Estimation functions
// ---------------------------------------------------------------------------

/**
 * Estimate time spent on emails by category.
 *
 * @param classified - Array of classified emails
 * @param customWeights - Optional partial overrides for default weights
 * @returns Array of time estimates per category
 */
export function estimateTimeSpent(
  classified: ClassifiedEmail[],
  customWeights?: Partial<typeof DEFAULT_TIME_WEIGHTS>
): TimeEstimate[] {
  // Merge default weights with custom overrides
  const weights = { ...DEFAULT_TIME_WEIGHTS, ...customWeights };

  // Group by category
  const categoryMap = new Map<EmailCategory, number>();
  for (const email of classified) {
    categoryMap.set(email.category, (categoryMap.get(email.category) || 0) + 1);
  }

  // Calculate estimates
  const estimates: TimeEstimate[] = [];
  for (const [category, count] of categoryMap.entries()) {
    const weight = weights[category];
    estimates.push({
      category,
      count,
      estimatedMinutes: count * weight,
    });
  }

  return estimates;
}

/**
 * Estimate hours per week spent on emails.
 *
 * @param estimates - Array of time estimates per category
 * @param scanPeriodDays - Number of days the emails were scanned over
 * @returns Estimated hours per week (rounded to 1 decimal)
 */
export function estimateHoursPerWeek(estimates: TimeEstimate[], scanPeriodDays: number): number {
  // Sum total minutes
  const totalMinutes = estimates.reduce((sum, est) => sum + est.estimatedMinutes, 0);

  // Calculate average per day, then scale to week
  const minutesPerDay = totalMinutes / scanPeriodDays;
  const hoursPerWeek = (minutesPerDay * 7) / 60;

  // Round to 1 decimal
  return Math.round(hoursPerWeek * 10) / 10;
}
