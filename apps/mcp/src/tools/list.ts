import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { eq, and } from "drizzle-orm";
import { buildVisibilityFilter } from "@everyskill/db/lib/visibility";
import { trackUsage } from "../tracking/events.js";
import {
  getUserId,
  getTenantId,
  shouldNudge,
  incrementAnonymousCount,
  getFirstAuthMessage,
} from "../auth.js";

export async function handleListSkills({
  category,
  limit,
  userId,
  skipNudge,
}: {
  category?: string;
  limit: number;
  userId?: string;
  skipNudge?: boolean;
}) {
  if (!db) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Database not configured" }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId();

  // Build DB-level conditions: published + visibility + optional tenant/category
  const conditions = [eq(skills.status, "published"), buildVisibilityFilter(userId)];

  if (tenantId) {
    conditions.push(eq(skills.tenantId, tenantId));
  }

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .where(and(...conditions))
    .limit(limit);

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "list_skills",
    userId,
    metadata: { category, limit, resultCount: results.length },
  });

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          count: results.length,
          skills: results,
        },
        null,
        2
      ),
    },
  ];

  if (!skipNudge) {
    const firstAuthMsg = getFirstAuthMessage();
    if (firstAuthMsg) {
      content.push({ type: "text" as const, text: firstAuthMsg });
    }

    if (shouldNudge()) {
      content.push({
        type: "text" as const,
        text: "Tip: Set EVERYSKILL_API_KEY to track your usage and unlock analytics.",
      });
    }
  }

  return { content };
}

server.registerTool(
  "list_skills",
  {
    description:
      "List all available skills in the EverySkill marketplace. Returns skill ID, name, description, category, and estimated hours saved.",
    inputSchema: {
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(50).default(20).describe("Maximum number of results"),
    },
  },
  async ({ category, limit }) =>
    handleListSkills({ category, limit, userId: getUserId() ?? undefined })
);
