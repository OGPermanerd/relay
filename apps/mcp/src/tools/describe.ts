import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { ratings } from "@everyskill/db/schema/ratings";
import { eq, and, sql } from "drizzle-orm";
import { getSkillReview } from "@everyskill/db/services/skill-reviews";
import { getForkCount } from "@everyskill/db/services/skill-forks";
import { getSkillEmbedding } from "@everyskill/db/services/skill-embeddings";
import { semanticSearchSkills } from "@everyskill/db/services/semantic-search";
import { formatRating } from "@everyskill/db/services/skill-metrics";
import { trackUsage } from "../tracking/events.js";
import { getUserId, getTenantId } from "../auth.js";

/**
 * Derive a quality tier from rating and usage data.
 * Gold: averageRating >= 400 AND totalUses >= 10
 * Silver: averageRating >= 300 AND totalUses >= 5
 * Bronze: averageRating >= 200
 */
function deriveQualityTier(averageRating: number | null, totalUses: number): string | null {
  if (averageRating === null) return null;
  if (averageRating >= 400 && totalUses >= 10) return "gold";
  if (averageRating >= 300 && totalUses >= 5) return "silver";
  if (averageRating >= 200) return "bronze";
  return null;
}

export async function handleDescribeSkill({
  skillId,
  userId,
}: {
  skillId: string;
  userId?: string;
}) {
  if (!db) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
      ],
      isError: true,
    };
  }

  // Fetch skill — only published skills are returned
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.status, "published")),
    with: {
      author: {
        columns: { id: true, name: true },
      },
    },
  });

  if (!skill) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Skill not found or not published" }),
        },
      ],
      isError: true,
    };
  }

  // Visibility check: personal skills only visible to their author
  if (skill.visibility === "personal" && skill.authorId !== userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Skill not found or not published" }),
        },
      ],
      isError: true,
    };
  }

  // Fetch supplementary data in parallel
  const [review, forkCount, ratingResult, embedding] = await Promise.all([
    getSkillReview(skillId),
    getForkCount(skillId, userId),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(ratings)
      .where(eq(ratings.skillId, skillId)),
    getSkillEmbedding(skillId),
  ]);

  const ratingCount = ratingResult[0]?.count ?? 0;

  // Find similar skills via embedding similarity
  let similarResults: Array<{
    id: string;
    name: string;
    slug: string;
    similarity: number;
  }> = [];

  if (embedding) {
    const searchResults = await semanticSearchSkills({
      queryEmbedding: embedding.embedding as number[],
      limit: 4,
      tenantId: getTenantId() ?? undefined,
      userId,
    });
    // Filter out the current skill and take first 3
    similarResults = searchResults
      .filter((s) => s.id !== skillId)
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        similarity: s.similarity,
      }));
  }

  const response = {
    skill: {
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      category: skill.category,
      tags: skill.tags,
      author: { name: skill.author?.name ?? null },
      hoursSaved: skill.hoursSaved,
      totalUses: skill.totalUses,
      averageRating: formatRating(skill.averageRating),
      ratingCount,
      qualityTier: deriveQualityTier(skill.averageRating, skill.totalUses),
      forkCount,
      createdAt: skill.createdAt.toISOString(),
    },
    aiReview: review
      ? {
          quality: (
            review.categories as {
              quality: { score: number; suggestions: string[] };
              clarity: { score: number; suggestions: string[] };
              completeness: { score: number; suggestions: string[] };
            }
          ).quality,
          clarity: (
            review.categories as {
              quality: { score: number; suggestions: string[] };
              clarity: { score: number; suggestions: string[] };
              completeness: { score: number; suggestions: string[] };
            }
          ).clarity,
          completeness: (
            review.categories as {
              quality: { score: number; suggestions: string[] };
              clarity: { score: number; suggestions: string[] };
              completeness: { score: number; suggestions: string[] };
            }
          ).completeness,
          summary: review.summary,
        }
      : null,
    similarSkills: similarResults.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      similarity: s.similarity.toFixed(2),
    })),
    install: {
      mcpCommand: `Use deploy_skill with ID "${skillId}" to install this skill`,
    },
  };

  await trackUsage({
    toolName: "describe_skill",
    skillId,
    userId: getUserId() ?? undefined,
    metadata: { skillName: skill.name },
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

server.registerTool(
  "describe_skill",
  {
    description:
      "Get comprehensive details about a skill including AI review scores, ratings, usage statistics, similar skills, and install instructions. Use a skill ID from search_skills or recommend_skills results.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to describe"),
    },
  },
  async ({ skillId }) => handleDescribeSkill({ skillId, userId: getUserId() ?? undefined })
);
