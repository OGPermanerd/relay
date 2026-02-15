import { db } from "../client";
import { emailDiagnostics, type EmailDiagnostic } from "../schema/email-diagnostics";
import { desc } from "drizzle-orm";

// ---------- Types ----------

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
  sentMessageCount?: number;
  sentWithAttachmentCount?: number;
  estimatedSentHoursPerWeek?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workContext?: any; // WorkContext stored in JSONB
}

export interface SaveEmailDiagnosticParams {
  userId: string;
  tenantId: string;
  scanDate: Date;
  scanPeriodDays: number;
  totalMessages: number;
  estimatedHoursPerWeek: number; // stored as tenths (e.g., 125 = 12.5 hours)
  categoryBreakdown: CategoryBreakdownItem[];
  patternInsights: PatternInsights | null;
}

// ---------- Service Functions ----------

/**
 * Save a new email diagnostic scan result.
 * Inserts aggregate-only statistics — never individual email metadata.
 *
 * @param params - Diagnostic data computed from in-memory email analysis
 * @returns The created diagnostic record
 */
export async function saveEmailDiagnostic(
  params: SaveEmailDiagnosticParams
): Promise<EmailDiagnostic> {
  if (!db) throw new Error("Database not configured");

  const [diagnostic] = await db
    .insert(emailDiagnostics)
    .values({
      userId: params.userId,
      tenantId: params.tenantId,
      scanDate: params.scanDate,
      scanPeriodDays: params.scanPeriodDays,
      totalMessages: params.totalMessages,
      estimatedHoursPerWeek: params.estimatedHoursPerWeek,
      categoryBreakdown: params.categoryBreakdown,
      patternInsights: params.patternInsights,
    })
    .returning();

  return diagnostic;
}

/**
 * Get the most recent diagnostic scan for a user.
 *
 * @param userId - User ID
 * @returns Latest diagnostic record or null if none exist
 */
export async function getLatestDiagnostic(userId: string): Promise<EmailDiagnostic | null> {
  if (!db) throw new Error("Database not configured");

  const diagnostic = await db.query.emailDiagnostics.findFirst({
    where: (t, { eq }) => eq(t.userId, userId),
    orderBy: (t) => desc(t.scanDate),
  });

  return diagnostic || null;
}

/**
 * Get diagnostic history for a user (most recent first).
 *
 * @param userId - User ID
 * @param limit - Maximum number of diagnostics to return (default: 10)
 * @returns Array of diagnostic records ordered by scan_date DESC
 */
export async function getDiagnosticHistory(userId: string, limit = 10): Promise<EmailDiagnostic[]> {
  if (!db) throw new Error("Database not configured");

  const diagnostics = await db.query.emailDiagnostics.findMany({
    where: (t, { eq }) => eq(t.userId, userId),
    orderBy: (t) => desc(t.scanDate),
    limit,
  });

  return diagnostics;
}
