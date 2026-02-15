import type { ClassifiedEmail, EmailCategory } from "./email-classifier";
import { DEFAULT_TIME_WEIGHTS } from "./email-time-estimator";

/**
 * Email diagnostic aggregation
 *
 * Computes aggregate statistics from classified emails:
 * - Category breakdown (counts, percentages, time estimates)
 * - Pattern insights (busiest hour, busiest day, sent email analysis)
 * - Estimated hours per week (reading + composing)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryBreakdownItem {
  category: string;
  count: number;
  percentage: number;
  estimatedMinutes: number;
}

export interface PatternInsights {
  busiestHour: number; // 0-23
  busiestDayOfWeek: string; // "Monday", "Tuesday", etc.
  averageResponseTimeHours: number | null;
  threadDepthAverage: number;
  sentMessageCount: number;
  sentWithAttachmentCount: number;
  estimatedSentHoursPerWeek: number;
}

export interface AggregateResults {
  categoryBreakdown: CategoryBreakdownItem[];
  patternInsights: PatternInsights;
  estimatedHoursPerWeek: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Sent email time estimates (minutes)
const SENT_REPLY_MINUTES = 3; // replying to existing thread
const SENT_NEW_MINUTES = 5; // composing new message
const SENT_ATTACHMENT_MINUTES = 15; // creating/gathering attachment content

// ---------------------------------------------------------------------------
// Aggregation function
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics from classified emails.
 *
 * @param classified - Array of classified emails
 * @param scanPeriodDays - Number of days the emails were scanned over
 * @returns Aggregate results with category breakdown, patterns, and time estimates
 */
export function computeAggregates(
  classified: ClassifiedEmail[],
  scanPeriodDays: number
): AggregateResults {
  const totalMessages = classified.length;

  // ---------------------------------------------------------------------------
  // 1. Category breakdown
  // ---------------------------------------------------------------------------

  const categoryStats = new Map<string, { count: number; estimatedMinutes: number }>();

  for (const email of classified) {
    const category = email.category;
    const weight = DEFAULT_TIME_WEIGHTS[category as EmailCategory] || 0;

    const existing = categoryStats.get(category) || { count: 0, estimatedMinutes: 0 };
    categoryStats.set(category, {
      count: existing.count + 1,
      estimatedMinutes: existing.estimatedMinutes + weight,
    });
  }

  // Build category breakdown array with percentages
  const categoryBreakdown: CategoryBreakdownItem[] = [];
  for (const [category, stats] of categoryStats.entries()) {
    categoryBreakdown.push({
      category,
      count: stats.count,
      percentage: totalMessages > 0 ? Math.round((stats.count / totalMessages) * 100 * 10) / 10 : 0,
      estimatedMinutes: Math.round(stats.estimatedMinutes * 10) / 10,
    });
  }

  // Sort by count descending
  categoryBreakdown.sort((a, b) => b.count - a.count);

  // ---------------------------------------------------------------------------
  // 2. Pattern insights
  // ---------------------------------------------------------------------------

  // Hour distribution (0-23)
  const hourCounts = new Array(24).fill(0);
  for (const email of classified) {
    const hour = email.date.getHours();
    hourCounts[hour]++;
  }

  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));

  // Day of week distribution
  const dayCounts = new Map<string, number>();
  for (const email of classified) {
    const dayIndex = email.date.getDay();
    const dayName = DAY_NAMES[dayIndex];
    dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
  }

  let busiestDayOfWeek = "Monday"; // default
  let maxDayCount = 0;
  for (const [day, count] of dayCounts.entries()) {
    if (count > maxDayCount) {
      maxDayCount = count;
      busiestDayOfWeek = day;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Sent email analysis
  // ---------------------------------------------------------------------------

  const sentEmails = classified.filter((e) => e.isSent);
  const sentWithAttachment = sentEmails.filter((e) => e.hasAttachment);
  const sentReplies = sentEmails.filter((e) => e.inReplyTo && !e.hasAttachment);
  const sentNew = sentEmails.filter((e) => !e.inReplyTo && !e.hasAttachment);

  const sentMinutes =
    sentWithAttachment.length * SENT_ATTACHMENT_MINUTES +
    sentReplies.length * SENT_REPLY_MINUTES +
    sentNew.length * SENT_NEW_MINUTES;

  const estimatedSentHoursPerWeek =
    Math.round((((sentMinutes / scanPeriodDays) * 7) / 60) * 10) / 10;

  const patternInsights: PatternInsights = {
    busiestHour,
    busiestDayOfWeek,
    averageResponseTimeHours: null,
    threadDepthAverage: 0,
    sentMessageCount: sentEmails.length,
    sentWithAttachmentCount: sentWithAttachment.length,
    estimatedSentHoursPerWeek,
  };

  // ---------------------------------------------------------------------------
  // 4. Estimated hours per week (reading + composing)
  // ---------------------------------------------------------------------------

  const inboxMinutes = categoryBreakdown.reduce((sum, cat) => sum + cat.estimatedMinutes, 0);
  const totalMinutes = inboxMinutes + sentMinutes;
  const minutesPerDay = totalMinutes / scanPeriodDays;
  const hoursPerWeek = (minutesPerDay * 7) / 60;
  const estimatedHoursPerWeek = Math.round(hoursPerWeek * 10) / 10;

  // ---------------------------------------------------------------------------
  // Return results
  // ---------------------------------------------------------------------------

  return {
    categoryBreakdown,
    patternInsights,
    estimatedHoursPerWeek,
  };
}
