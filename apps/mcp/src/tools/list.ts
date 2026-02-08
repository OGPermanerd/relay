import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
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

  // Fetch all skills and filter in-memory to avoid TypeScript module resolution issues
  const allResults = await db.query.skills.findMany({
    limit: category || tenantId ? undefined : limit, // Fetch all if filtering
    columns: {
      id: true,
      name: true,
      description: true,
      category: true,
      hoursSaved: true,
      tenantId: true,
    },
  });

  // Filter by published status first, then tenant, then category
  const publishedFiltered = allResults.filter(
    (s: Record<string, unknown>) => s.status === "published" || !s.status
  );
  const tenantFiltered = tenantId
    ? publishedFiltered.filter((s: { tenantId: string }) => s.tenantId === tenantId)
    : publishedFiltered;
  const results = category
    ? tenantFiltered
        .filter((s: { category: string | null }) => s.category === category)
        .slice(0, limit)
    : tenantFiltered.slice(0, limit);

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
