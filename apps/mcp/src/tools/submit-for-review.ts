import { sql } from "drizzle-orm";
import { db } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";
import { generateSkillReview, hashContent, REVIEW_MODEL } from "./review-skill.js";

/**
 * MCP Tool: submit_for_review
 *
 * Submits a skill for the full review pipeline:
 * 1. Validates ownership and state machine transition
 * 2. Transitions to pending_review
 * 3. Runs AI review via Anthropic API
 * 4. Stores review results
 * 5. Checks auto-approve threshold
 * 6. If auto-approved, chains through ai_reviewed -> approved -> published
 * 7. If not auto-approved, sets status to ai_reviewed for manual review
 *
 * CRITICAL: ANTHROPIC_API_KEY check happens BEFORE any status transitions
 * to avoid leaving skills stuck in pending_review if the key is missing.
 *
 * IMPORTANT: All console output uses console.error to avoid corrupting
 * the stdio MCP transport protocol.
 */

// ---------------------------------------------------------------------------
// State machine (duplicated from packages/db/src/services/skill-status.ts
// to avoid tsup DTS resolution issues with @everyskill/db service exports)
// ---------------------------------------------------------------------------

type SkillStatus =
  | "draft"
  | "pending_review"
  | "ai_reviewed"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "published";

const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],
  changes_requested: ["draft", "pending_review"],
  published: [],
};

function canTransition(from: SkillStatus, to: SkillStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

const DEFAULT_AUTO_APPROVE_THRESHOLD = 7;

function checkAutoApprove(
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

interface SkillRow {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  status: string;
  status_message: string | null;
  author_id: string;
  tenant_id: string;
}

export async function handleSubmitForReview({ skillId }: { skillId: string }) {
  // (a) Auth check
  const userId = getUserId();
  if (!userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Authentication required",
            message:
              "Set the EVERYSKILL_API_KEY environment variable to submit skills for review. " +
              "Get your key at https://everyskill.ai/settings.",
          }),
        },
      ],
      isError: true,
    };
  }

  // (b) DB check
  if (!db) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
      ],
      isError: true,
    };
  }

  // (c) ANTHROPIC_API_KEY check — MUST be before any status transitions
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "ANTHROPIC_API_KEY not configured",
            message:
              "The server administrator must set ANTHROPIC_API_KEY for the review pipeline. " +
              "Get an API key from https://console.anthropic.com/settings/keys",
          }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId();

  // (d) Fetch skill with ownership check
  const rows = (await db.execute(sql`
    SELECT id, name, description, content, category, status, status_message, author_id, tenant_id
    FROM skills
    WHERE id = ${skillId}
      AND author_id = ${userId}
      ${tenantId ? sql`AND tenant_id = ${tenantId}` : sql``}
    LIMIT 1
  `)) as unknown as SkillRow[];

  if (!rows || rows.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Skill not found",
            message: `No skill found with ID: ${skillId} owned by you. Use list_skills to find your skills.`,
          }),
        },
      ],
      isError: true,
    };
  }

  const skill = rows[0];
  const currentStatus = skill.status as SkillStatus;

  // (e) State machine check
  const isAlreadyPendingReview = currentStatus === "pending_review";
  const canSubmit = canTransition(currentStatus, "pending_review");

  if (!canSubmit && !isAlreadyPendingReview) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Invalid status transition",
            message:
              `Skill "${skill.name}" is currently "${currentStatus}" and cannot be submitted for review. ` +
              `Skills must be in "draft" or "changes_requested" status to submit for review.`,
            currentStatus,
          }),
        },
      ],
      isError: true,
    };
  }

  // (f) Transition to pending_review (or clear statusMessage if retry)
  if (isAlreadyPendingReview) {
    // Clear any previous error message on retry
    await db.execute(sql`
      UPDATE skills SET status_message = NULL, updated_at = NOW()
      WHERE id = ${skillId}
    `);
  } else {
    await db.execute(sql`
      UPDATE skills SET status = 'pending_review', status_message = NULL, updated_at = NOW()
      WHERE id = ${skillId}
    `);
  }

  // (g) Run the full pipeline
  try {
    // Generate AI review
    const review = await generateSkillReview(
      skill.name,
      skill.description,
      skill.content,
      skill.category
    );

    // Store review result
    const contentHash = await hashContent(skill.content);
    if (!tenantId) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Tenant not resolved",
              message:
                "API key does not have a tenant association. Please re-generate your API key.",
            }),
          },
        ],
        isError: true,
      };
    }
    const reviewTenantId = tenantId;

    await db.execute(sql`
      INSERT INTO skill_reviews (id, tenant_id, skill_id, requested_by, categories, summary, suggested_description, reviewed_content_hash, model_name, is_visible, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${reviewTenantId},
        ${skillId},
        ${userId},
        ${JSON.stringify({
          quality: review.quality,
          clarity: review.clarity,
          completeness: review.completeness,
        })}::jsonb,
        ${review.summary},
        ${review.suggestedDescription},
        ${contentHash},
        ${REVIEW_MODEL},
        true,
        NOW()
      )
      ON CONFLICT (tenant_id, skill_id) DO UPDATE SET
        requested_by = EXCLUDED.requested_by,
        categories = EXCLUDED.categories,
        summary = EXCLUDED.summary,
        suggested_description = EXCLUDED.suggested_description,
        reviewed_content_hash = EXCLUDED.reviewed_content_hash,
        model_name = EXCLUDED.model_name,
        created_at = NOW()
    `);

    // Check auto-approve
    const categories = {
      quality: review.quality,
      clarity: review.clarity,
      completeness: review.completeness,
    };
    const autoApproved = checkAutoApprove(categories);

    if (autoApproved) {
      // Chain: pending_review -> ai_reviewed -> approved -> published
      await db.execute(sql`
        UPDATE skills SET status = 'published', status_message = NULL, updated_at = NOW()
        WHERE id = ${skillId}
      `);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                skillId,
                skillName: skill.name,
                status: "published",
                autoApproved: true,
                scores: {
                  quality: review.quality.score,
                  clarity: review.clarity.score,
                  completeness: review.completeness.score,
                },
                review: {
                  quality: review.quality,
                  clarity: review.clarity,
                  completeness: review.completeness,
                  summary: review.summary,
                  suggestedDescription: review.suggestedDescription,
                },
                message:
                  `Skill "${skill.name}" has been auto-approved and published! ` +
                  `All scores met the threshold (7/10). ` +
                  `Quality: ${review.quality.score}, Clarity: ${review.clarity.score}, Completeness: ${review.completeness.score}.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } else {
      // Not auto-approved: set status to ai_reviewed for manual review
      await db.execute(sql`
        UPDATE skills SET status = 'ai_reviewed', status_message = NULL, updated_at = NOW()
        WHERE id = ${skillId}
      `);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                skillId,
                skillName: skill.name,
                status: "ai_reviewed",
                autoApproved: false,
                scores: {
                  quality: review.quality.score,
                  clarity: review.clarity.score,
                  completeness: review.completeness.score,
                },
                review: {
                  quality: review.quality,
                  clarity: review.clarity,
                  completeness: review.completeness,
                  summary: review.summary,
                  suggestedDescription: review.suggestedDescription,
                },
                message:
                  `AI review complete for "${skill.name}". ` +
                  `Scores: quality=${review.quality.score}, clarity=${review.clarity.score}, completeness=${review.completeness.score}. ` +
                  `Not all scores met the auto-approve threshold (7/10). Awaiting manual review.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  } catch (err) {
    // (h) Catch: set statusMessage, return error with retryable: true
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await db.execute(sql`
      UPDATE skills SET status_message = ${`AI review failed: ${errorMessage}`}, updated_at = NOW()
      WHERE id = ${skillId}
    `);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Review pipeline failed",
            skillId,
            skillName: skill.name,
            status: "pending_review",
            message: `AI review failed: ${errorMessage}. The skill remains in pending_review and can be retried.`,
            retryable: true,
          }),
        },
      ],
      isError: true,
    };
  }
}
