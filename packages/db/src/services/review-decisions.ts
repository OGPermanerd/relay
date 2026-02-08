import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { reviewDecisions } from "../schema/review-decisions";
import { users } from "../schema/users";
import type { ReviewCategories } from "../schema/skill-reviews";

/**
 * Parameters for creating a review decision
 */
export interface CreateReviewDecisionParams {
  tenantId: string;
  skillId: string;
  reviewerId: string;
  action: "approved" | "rejected" | "changes_requested";
  notes?: string;
  aiScoresSnapshot?: ReviewCategories;
  previousContent?: string;
}

/**
 * Create an immutable review decision record
 * Insert-only — no updates allowed for SOC2 compliance
 */
export async function createReviewDecision(params: CreateReviewDecisionParams): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping createReviewDecision");
    return;
  }

  await db.insert(reviewDecisions).values({
    tenantId: params.tenantId,
    skillId: params.skillId,
    reviewerId: params.reviewerId,
    action: params.action,
    notes: params.notes ?? null,
    aiScoresSnapshot: params.aiScoresSnapshot ?? null,
    previousContent: params.previousContent ?? null,
  });
}

/**
 * Decision record with reviewer name for display
 */
export interface DecisionWithReviewer {
  id: string;
  action: string;
  notes: string | null;
  reviewerName: string | null;
  createdAt: Date;
}

/**
 * Get all review decisions for a skill, newest first
 * Joins with users table to get reviewer name
 */
export async function getDecisionsForSkill(skillId: string): Promise<DecisionWithReviewer[]> {
  if (!db) {
    console.warn("Database not configured, skipping getDecisionsForSkill");
    return [];
  }

  const results = await db
    .select({
      id: reviewDecisions.id,
      action: reviewDecisions.action,
      notes: reviewDecisions.notes,
      reviewerName: users.name,
      createdAt: reviewDecisions.createdAt,
    })
    .from(reviewDecisions)
    .leftJoin(users, eq(reviewDecisions.reviewerId, users.id))
    .where(eq(reviewDecisions.skillId, skillId))
    .orderBy(desc(reviewDecisions.createdAt));

  return results;
}
