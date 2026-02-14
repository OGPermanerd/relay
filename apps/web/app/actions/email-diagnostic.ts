"use server";

import { auth } from "@/auth";
import { fetchEmailMetadata } from "@/lib/gmail-client";
import { classifyEmails } from "@/lib/email-classifier";
import { computeAggregates, type AggregateResults } from "@/lib/diagnostic-aggregator";
import { saveEmailDiagnostic } from "@everyskill/db/services/email-diagnostics";
import {
  GmailNotConnectedError,
  GmailTokenRevokedError,
} from "@everyskill/db/services/gmail-tokens";

/**
 * Email diagnostic server action
 *
 * Orchestrates the full email analysis pipeline:
 * 1. Fetch email metadata from Gmail (last 90 days, up to 5000 messages)
 * 2. Classify emails into categories (newsletter, direct-message, etc.)
 * 3. Compute aggregate statistics (category breakdown, time estimates, patterns)
 * 4. Save ONLY aggregates to database (raw metadata discarded)
 *
 * Privacy-first: Raw email metadata (From, Subject, Date) is processed entirely
 * in memory and never persisted. Only aggregate statistics are stored.
 */

export interface EmailDiagnosticResult {
  success: boolean;
  data?: AggregateResults;
  error?: string;
}

/**
 * Run email diagnostic analysis for the current user.
 *
 * @returns Success/error result with aggregate statistics
 */
export async function runEmailDiagnostic(): Promise<EmailDiagnosticResult> {
  // 1. Authentication check
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  try {
    // 2. Fetch email metadata (90 days, max 5000 messages)
    const messages = await fetchEmailMetadata(session.user.id, {
      daysBack: 90,
      maxMessages: 5000,
    });

    // 3. Classify emails into categories
    const classified = await classifyEmails(messages);

    // 4. Compute aggregate statistics
    const aggregates = computeAggregates(classified, 90);

    // 5. Save ONLY aggregates to database (not raw metadata)
    await saveEmailDiagnostic({
      userId: session.user.id,
      tenantId: session.user.tenantId,
      scanDate: new Date(),
      scanPeriodDays: 90,
      totalMessages: messages.length,
      categoryBreakdown: aggregates.categoryBreakdown,
      estimatedHoursPerWeek: Math.round(aggregates.estimatedHoursPerWeek * 10), // stored as tenths
      patternInsights: aggregates.patternInsights,
    });

    // 6. Return aggregates (raw metadata is now garbage-collected)
    return {
      success: true,
      data: aggregates,
    };
  } catch (error) {
    // Handle specific Gmail connection errors
    if (error instanceof GmailNotConnectedError) {
      return {
        success: false,
        error: "Gmail account not connected. Please connect your Gmail account first.",
      };
    }

    if (error instanceof GmailTokenRevokedError) {
      return {
        success: false,
        error: "Gmail access has been revoked. Please reconnect your Gmail account.",
      };
    }

    // Generic error fallback
    console.error("Email diagnostic error:", error);
    return {
      success: false,
      error: "Failed to analyze emails. Please try again.",
    };
  }
}
