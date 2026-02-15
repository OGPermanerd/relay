import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { skillFeedback } from "../schema/skill-feedback";
import { skills } from "../schema/skills";

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
