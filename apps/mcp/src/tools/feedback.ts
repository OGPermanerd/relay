import { db } from "@everyskill/db";
import { skillFeedback } from "@everyskill/db/schema/skill-feedback";
import { skills } from "@everyskill/db/schema/skills";
import { eq, sql } from "drizzle-orm";
import { getUserId, getTenantId } from "../auth.js";
import { trackUsage } from "../tracking/events.js";

/**
 * MCP action handler for submitting feedback on a skill.
 * Inserts directly to DB (no HTTP round-trip) and updates denormalized aggregates.
 */
export async function handleFeedback({
  skillId,
  feedbackType,
  comment,
  userId,
}: {
  skillId: string;
  feedbackType: "thumbs_up" | "thumbs_down";
  comment?: string;
  userId?: string;
}) {
  if (!db) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Database not configured",
            message: "Cannot record feedback without database connection",
          }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId();
  if (!tenantId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Not authenticated",
            message: "Set EVERYSKILL_API_KEY to submit feedback",
          }),
        },
      ],
      isError: true,
    };
  }

  const sentiment = feedbackType === "thumbs_up" ? 1 : -1;

  // Sanitize comment: trim and truncate (MCP can't import web app's sanitizePayload)
  const sanitizedComment = comment?.trim().slice(0, 2000) ?? null;

  // Insert feedback row
  await db.insert(skillFeedback).values({
    tenantId,
    skillId,
    userId: userId ?? null,
    feedbackType,
    sentiment,
    comment: sanitizedComment,
    source: "mcp",
  });

  // Update denormalized aggregates on skills table
  const stats = await db
    .select({
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) FILTER (WHERE feedback_type = 'thumbs_up')::int`,
      votes: sql<number>`count(*) FILTER (WHERE feedback_type IN ('thumbs_up', 'thumbs_down'))::int`,
    })
    .from(skillFeedback)
    .where(eq(skillFeedback.skillId, skillId));

  const total = stats[0]?.total ?? 0;
  const votes = stats[0]?.votes ?? 0;
  const positive = stats[0]?.positive ?? 0;
  const pct = votes > 0 ? Math.round((positive / votes) * 100) : null;

  await db
    .update(skills)
    .set({
      totalFeedback: total,
      positiveFeedbackPct: pct,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId));

  // Track usage (non-critical, fire-and-forget)
  trackUsage(
    {
      toolName: "feedback",
      skillId,
      userId: getUserId() ?? undefined,
      metadata: { feedbackType, hasComment: !!comment },
    },
    { skipIncrement: true }
  ).catch(() => {});

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          message: `Feedback recorded: ${feedbackType === "thumbs_up" ? "thumbs up" : "thumbs down"}${comment ? " with comment" : ""}`,
        }),
      },
    ],
  };
}
