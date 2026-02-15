import { eq, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { skillFeedback } from "../schema/skill-feedback";
import { skills } from "../schema/skills";
import { users } from "../schema/users";

/**
 * Insert feedback params — supports thumbs_up/thumbs_down with optional comment.
 * Nullable userId allows anonymous MCP feedback.
 */
export interface InsertFeedbackParams {
  tenantId: string;
  skillId: string;
  userId?: string | null;
  feedbackType: "thumbs_up" | "thumbs_down";
  comment?: string | null;
  source?: string; // default "web"
  usageEventId?: string | null;
}

/**
 * Insert a feedback row and update denormalized aggregates on the skills table.
 * Returns the inserted feedback id.
 */
export async function insertFeedback(params: InsertFeedbackParams): Promise<string | null> {
  if (!db) {
    console.warn("Database not configured, skipping insertFeedback");
    return null;
  }

  const sentiment = params.feedbackType === "thumbs_up" ? 1 : -1;

  const [inserted] = await db
    .insert(skillFeedback)
    .values({
      tenantId: params.tenantId,
      skillId: params.skillId,
      userId: params.userId ?? null,
      feedbackType: params.feedbackType,
      sentiment,
      comment: params.comment ?? null,
      source: params.source ?? "web",
      usageEventId: params.usageEventId ?? null,
    })
    .returning({ id: skillFeedback.id });

  // Update denormalized aggregates on the skills table
  await updateSkillFeedbackAggregates(params.skillId);

  return inserted?.id ?? null;
}

/**
 * Recalculate and update totalFeedback and positiveFeedbackPct on the skills table.
 * Only counts thumbs_up/thumbs_down for the percentage calculation (not suggestions, bug reports, etc.)
 */
export async function updateSkillFeedbackAggregates(skillId: string): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping updateSkillFeedbackAggregates");
    return;
  }

  const stats = await db
    .select({
      total: sql<number>`count(*)::int`,
      votesTotal: sql<number>`count(*) FILTER (WHERE feedback_type IN ('thumbs_up', 'thumbs_down'))::int`,
      positive: sql<number>`count(*) FILTER (WHERE feedback_type = 'thumbs_up')::int`,
    })
    .from(skillFeedback)
    .where(eq(skillFeedback.skillId, skillId));

  const total = stats[0]?.total ?? 0;
  const votesTotal = stats[0]?.votesTotal ?? 0;
  const positive = stats[0]?.positive ?? 0;
  const pct = votesTotal > 0 ? Math.round((positive / votesTotal) * 100) : null;

  await db
    .update(skills)
    .set({
      totalFeedback: total,
      positiveFeedbackPct: pct,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId));
}

// ---------------------------------------------------------------------------
// Suggestion CRUD
// ---------------------------------------------------------------------------

/**
 * Parameters for creating a suggestion
 */
export interface CreateSuggestionParams {
  tenantId: string;
  skillId: string;
  userId: string;
  category: string;
  severity: string;
  comment: string;
  suggestedContent?: string | null;
}

/**
 * A suggestion row enriched with user (submitter) and reviewer info.
 */
export interface SuggestionWithUser {
  id: string;
  userId: string | null;
  comment: string | null;
  suggestedContent: string | null;
  category: string | null;
  severity: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  user: { name: string | null; image: string | null } | null;
  reviewer: { name: string | null } | null;
}

/**
 * Insert a suggestion into skill_feedback.
 * Category and severity are stored as JSON in the suggestedDiff column.
 * Returns the inserted row id or null.
 */
export async function createSuggestion(params: CreateSuggestionParams): Promise<string | null> {
  if (!db) {
    console.warn("Database not configured, skipping createSuggestion");
    return null;
  }

  const [inserted] = await db
    .insert(skillFeedback)
    .values({
      tenantId: params.tenantId,
      skillId: params.skillId,
      userId: params.userId,
      feedbackType: "suggestion",
      status: "pending",
      source: "web",
      comment: params.comment,
      suggestedContent: params.suggestedContent ?? null,
      suggestedDiff: JSON.stringify({
        category: params.category,
        severity: params.severity,
      }),
    })
    .returning({ id: skillFeedback.id });

  return inserted?.id ?? null;
}

/**
 * Get all suggestions for a skill, with submitter and reviewer info.
 * Ordered by createdAt descending (newest first).
 */
export async function getSuggestionsForSkill(skillId: string): Promise<SuggestionWithUser[]> {
  if (!db) return [];

  const reviewerAlias = alias(users, "reviewer");

  const rows = await db
    .select({
      id: skillFeedback.id,
      userId: skillFeedback.userId,
      comment: skillFeedback.comment,
      suggestedContent: skillFeedback.suggestedContent,
      suggestedDiff: skillFeedback.suggestedDiff,
      status: skillFeedback.status,
      reviewNotes: skillFeedback.reviewNotes,
      reviewedBy: skillFeedback.reviewedBy,
      reviewedAt: skillFeedback.reviewedAt,
      createdAt: skillFeedback.createdAt,
      userName: users.name,
      userImage: users.image,
      reviewerName: reviewerAlias.name,
    })
    .from(skillFeedback)
    .leftJoin(users, eq(skillFeedback.userId, users.id))
    .leftJoin(reviewerAlias, eq(skillFeedback.reviewedBy, reviewerAlias.id))
    .where(
      sql`${skillFeedback.skillId} = ${skillId} AND ${skillFeedback.feedbackType} = 'suggestion'`
    )
    .orderBy(desc(skillFeedback.createdAt));

  return rows.map((row) => {
    let category: string | null = null;
    let severity: string | null = null;
    if (row.suggestedDiff) {
      try {
        const parsed = JSON.parse(row.suggestedDiff);
        category = parsed.category ?? null;
        severity = parsed.severity ?? null;
      } catch {
        // Ignore malformed JSON
      }
    }

    return {
      id: row.id,
      userId: row.userId,
      comment: row.comment,
      suggestedContent: row.suggestedContent,
      category,
      severity,
      status: row.status,
      reviewNotes: row.reviewNotes,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      user: row.userName || row.userImage ? { name: row.userName, image: row.userImage } : null,
      reviewer: row.reviewerName ? { name: row.reviewerName } : null,
    };
  });
}

/**
 * Valid status transitions for suggestions.
 */
const VALID_SUGGESTION_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "dismissed"],
  accepted: ["implemented", "dismissed"],
  dismissed: ["pending"], // reopen
};

/**
 * Update the status of a suggestion.
 * Enforces valid status transitions.
 */
export async function updateSuggestionStatus(params: {
  id: string;
  status: string;
  reviewerId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: "Database not configured" };
  }

  // Get current status
  const existing = await db.query.skillFeedback.findFirst({
    where: eq(skillFeedback.id, params.id),
    columns: { status: true, feedbackType: true },
  });

  if (!existing) {
    return { success: false, error: "Suggestion not found" };
  }

  if (existing.feedbackType !== "suggestion") {
    return { success: false, error: "Feedback item is not a suggestion" };
  }

  const allowed = VALID_SUGGESTION_TRANSITIONS[existing.status];
  if (!allowed || !allowed.includes(params.status)) {
    return {
      success: false,
      error: `Cannot transition from "${existing.status}" to "${params.status}"`,
    };
  }

  await db
    .update(skillFeedback)
    .set({
      status: params.status,
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(skillFeedback.id, params.id));

  return { success: true };
}

/**
 * Add a reply (reviewNotes) to a suggestion without changing its status.
 */
export async function replySuggestion(params: {
  id: string;
  reviewNotes: string;
  reviewerId: string;
}): Promise<{ success: boolean }> {
  if (!db) {
    return { success: false };
  }

  await db
    .update(skillFeedback)
    .set({
      reviewNotes: params.reviewNotes,
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
    })
    .where(eq(skillFeedback.id, params.id));

  return { success: true };
}
