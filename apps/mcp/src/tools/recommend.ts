import { z } from "zod";
import { server } from "../server.js";
import { semanticSearchSkills } from "@everyskill/db/services/semantic-search";
import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";
import { generateEmbedding, OLLAMA_DEFAULTS } from "../lib/ollama.js";
import { trackUsage } from "../tracking/events.js";
import {
  getUserId,
  getTenantId,
  shouldNudge,
  incrementAnonymousCount,
  getFirstAuthMessage,
} from "../auth.js";

export async function handleRecommendSkills({
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

  let results: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    totalUses: number;
    averageRating: number | null;
    similarity?: number;
  }> = [];
  let searchMethod: "semantic" | "text" = "text";

  // Try semantic search first
  const embedding = await generateEmbedding(query, OLLAMA_DEFAULTS);
  if (embedding) {
    const semanticResults = await semanticSearchSkills({
      queryEmbedding: embedding,
      limit,
      category,
      tenantId: tenantId ?? undefined,
    });

    if (semanticResults.length > 0) {
      results = semanticResults;
      searchMethod = "semantic";
    }
  }

  // Fallback to ILIKE text search if embedding failed or no semantic results
  if (results.length === 0) {
    results = await searchSkillsByQuery({
      query,
      category,
      limit,
      tenantId: tenantId ?? undefined,
    });
    searchMethod = "text";
  }

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  await trackUsage({
    toolName: "recommend_skills",
    userId,
    metadata: { query, category, searchMethod, resultCount: results.length },
  });

  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(
        {
          query,
          searchMethod,
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
  "recommend_skills",
  {
    description:
      "Discover skills using natural language. Describe what you need and get semantically relevant recommendations. Uses AI-powered search when available, falls back to text matching.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          "Natural language description of what you need (e.g., 'help me write better code reviews')"
        ),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(20).default(5).describe("Maximum number of recommendations"),
    },
  },
  async ({ query, category, limit }) =>
    handleRecommendSkills({
      query,
      category,
      limit,
      userId: getUserId() ?? undefined,
    })
);
