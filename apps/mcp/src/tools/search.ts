import { z } from "zod";
import { server } from "../server.js";
import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";
import { trackUsage } from "../tracking/events.js";
import {
  getUserId,
  getTenantId,
  shouldNudge,
  incrementAnonymousCount,
  getFirstAuthMessage,
} from "../auth.js";

export async function handleSearchSkills({
  query,
  category,
  limit,
  userId,
  skipNudge,
}: {
  query: string;
  category?: string;
  limit: number;
  userId?: string;
  skipNudge?: boolean;
}) {
  const tenantId = getTenantId();
  const results = await searchSkillsByQuery({
    query,
    category,
    limit,
    tenantId: tenantId ?? undefined,
  });

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "search_skills",
    userId,
    metadata: { query, category, resultCount: results.length },
  });

  const enriched = results.map((r) => ({
    ...r,
    displayRating: r.averageRating !== null ? (r.averageRating / 100).toFixed(1) : null,
  }));

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          query,
          count: results.length,
          skills: enriched,
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
  "search_skills",
  {
    description:
      "Search for skills in the EverySkill marketplace by query. Matches against name, description, author name, and tags.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (matches name, description, author, tags)"),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
    },
  },
  async ({ query, category, limit }) =>
    handleSearchSkills({ query, category, limit, userId: getUserId() ?? undefined })
);
