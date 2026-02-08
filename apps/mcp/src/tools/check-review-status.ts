import { z } from "zod";
import { sql } from "drizzle-orm";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";

/**
 * MCP Tool: check_review_status
 *
 * Returns the review pipeline status and AI review scores for skills
 * owned by the authenticated user. Optionally filters to a specific skill.
 *
 * IMPORTANT: All console output uses console.error to avoid corrupting
 * the stdio MCP transport protocol.
 */

// Statuses that are "in the pipeline" (not draft or published)
const PIPELINE_STATUSES = [
  "pending_review",
  "ai_reviewed",
  "approved",
  "rejected",
  "changes_requested",
];

interface SkillStatusRow {
  id: string;
  name: string;
  status: string;
  status_message: string | null;
  review_summary: string | null;
  review_categories: unknown | null;
  review_model: string | null;
  reviewed_at: string | null;
}

server.registerTool(
  "check_review_status",
  {
    description:
      "Check the review pipeline status and AI review scores for your skills. " +
      "Without a skillId, returns all skills currently in the review pipeline " +
      "(pending_review, ai_reviewed, approved, rejected, changes_requested). " +
      "With a skillId, returns detailed status for that specific skill. " +
      "Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      skillId: z.string().optional().describe("Optional: check a specific skill by ID"),
    },
  },
  async ({ skillId }) => {
    // Auth check
    const userId = getUserId();
    if (!userId) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Authentication required",
              message:
                "Set the EVERYSKILL_API_KEY environment variable to check review status. " +
                "Get your key at https://everyskill.ai/settings.",
            }),
          },
        ],
        isError: true,
      };
    }

    // DB check
    if (!db) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
        ],
        isError: true,
      };
    }

    const tenantId = getTenantId();

    if (skillId) {
      // Fetch specific skill with ownership check
      const rows = (await db.execute(sql`
        SELECT
          s.id,
          s.name,
          s.status,
          s.status_message,
          sr.summary AS review_summary,
          sr.categories AS review_categories,
          sr.model_name AS review_model,
          sr.created_at AS reviewed_at
        FROM skills s
        LEFT JOIN skill_reviews sr ON sr.skill_id = s.id
          ${tenantId ? sql`AND sr.tenant_id = ${tenantId}` : sql``}
        WHERE s.id = ${skillId}
          AND s.author_id = ${userId}
          ${tenantId ? sql`AND s.tenant_id = ${tenantId}` : sql``}
        LIMIT 1
      `)) as unknown as SkillStatusRow[];

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

      const row = rows[0];
      const categories = row.review_categories as {
        quality: { score: number; suggestions: string[] };
        clarity: { score: number; suggestions: string[] };
        completeness: { score: number; suggestions: string[] };
      } | null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                skillId: row.id,
                name: row.name,
                status: row.status,
                statusMessage: row.status_message,
                review: categories
                  ? {
                      scores: {
                        quality: categories.quality.score,
                        clarity: categories.clarity.score,
                        completeness: categories.completeness.score,
                      },
                      summary: row.review_summary,
                      model: row.review_model,
                      reviewedAt: row.reviewed_at,
                    }
                  : null,
                message: categories
                  ? `Skill "${row.name}" is ${row.status}. Review scores: quality=${categories.quality.score}, clarity=${categories.clarity.score}, completeness=${categories.completeness.score}.`
                  : `Skill "${row.name}" is ${row.status}. No AI review yet.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // No specific skill — fetch all skills in pipeline
    const rows = (await db.execute(sql`
      SELECT
        s.id,
        s.name,
        s.status,
        s.status_message,
        sr.summary AS review_summary,
        sr.categories AS review_categories,
        sr.model_name AS review_model,
        sr.created_at AS reviewed_at
      FROM skills s
      LEFT JOIN skill_reviews sr ON sr.skill_id = s.id
        ${tenantId ? sql`AND sr.tenant_id = ${tenantId}` : sql``}
      WHERE s.author_id = ${userId}
        AND s.status IN (${sql.join(
          PIPELINE_STATUSES.map((s) => sql`${s}`),
          sql`, `
        )})
        ${tenantId ? sql`AND s.tenant_id = ${tenantId}` : sql``}
      ORDER BY s.updated_at DESC
    `)) as unknown as SkillStatusRow[];

    if (!rows || rows.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              count: 0,
              skills: [],
              message:
                "No skills currently in the review pipeline. " +
                "Use submit_for_review to submit a draft skill for review.",
            }),
          },
        ],
      };
    }

    const skills = rows.map((row) => {
      const categories = row.review_categories as {
        quality: { score: number };
        clarity: { score: number };
        completeness: { score: number };
      } | null;

      return {
        skillId: row.id,
        name: row.name,
        status: row.status,
        statusMessage: row.status_message,
        scores: categories
          ? {
              quality: categories.quality.score,
              clarity: categories.clarity.score,
              completeness: categories.completeness.score,
            }
          : null,
        reviewSummary: row.review_summary,
        reviewedAt: row.reviewed_at,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              count: skills.length,
              skills,
              message: `${skills.length} skill(s) in the review pipeline.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);
