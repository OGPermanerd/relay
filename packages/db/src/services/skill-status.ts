/**
 * Skill status state machine
 *
 * Defines the valid statuses a skill can have and the allowed transitions
 * between them. Used by the review pipeline to enforce workflow rules.
 */

export const SKILL_STATUSES = [
  "draft",
  "pending_review",
  "ai_reviewed",
  "approved",
  "rejected",
  "changes_requested",
  "published",
] as const;

export type SkillStatus = (typeof SKILL_STATUSES)[number];

/**
 * Valid state transitions for the skill review pipeline.
 *
 * draft -> pending_review: Author submits for review
 * pending_review -> ai_reviewed: AI review completes
 * ai_reviewed -> approved: Reviewer approves
 * ai_reviewed -> rejected: Reviewer rejects
 * ai_reviewed -> changes_requested: Reviewer requests changes
 * approved -> published: Skill is published
 * rejected -> draft: Author revises after rejection
 * changes_requested -> draft: Author revises after feedback
 * published -> (terminal): Published skills cannot transition
 */
export const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],
  changes_requested: ["draft"],
  published: [],
};

/**
 * Check if a transition from one status to another is valid.
 */
export function canTransition(from: SkillStatus, to: SkillStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get all valid transitions from a given status.
 */
export function getValidTransitions(status: SkillStatus): SkillStatus[] {
  return VALID_TRANSITIONS[status];
}

export const DEFAULT_AUTO_APPROVE_THRESHOLD = 7;

/**
 * Check if a skill should be auto-approved based on AI review scores.
 * Returns true when all 3 category scores meet or exceed the threshold.
 */
export function checkAutoApprove(
  categories: {
    quality: { score: number };
    clarity: { score: number };
    completeness: { score: number };
  },
  threshold: number = DEFAULT_AUTO_APPROVE_THRESHOLD
): boolean {
  return (
    categories.quality.score >= threshold &&
    categories.clarity.score >= threshold &&
    categories.completeness.score >= threshold
  );
}
