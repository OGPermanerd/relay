import { z } from "zod";
import { server } from "../server.js";
import { db } from "@relay/db";
import { trackUsage } from "../tracking/events.js";

export async function handleSearchSkills({
  query,
  category,
  limit,
}: {
  query: string;
  category?: string;
  limit: number;
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

  // Search in-memory to avoid TypeScript module resolution issues with drizzle operators
  const queryLower = query.toLowerCase();

  const allResults = await db.query.skills.findMany({
    columns: {
      id: true,
      name: true,
      description: true,
      category: true,
      hoursSaved: true,
    },
  });

  // Filter by search query and optionally by category
  const filtered = allResults.filter((skill) => {
    const matchesQuery =
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower);
    const matchesCategory = !category || skill.category === category;
    return matchesQuery && matchesCategory;
  });

  const results = filtered.slice(0, limit);

  await trackUsage({
    toolName: "search_skills",
    metadata: { query, category, resultCount: results.length },
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            query,
            count: results.length,
            skills: results,
          },
          null,
          2
        ),
      },
    ],
  };
}

server.registerTool(
  "search_skills",
  {
    description:
      "Search for skills in the Relay marketplace by query. Matches against name and description.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (matches name, description)"),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(25).default(10).describe("Maximum number of results"),
    },
  },
  async ({ query, category, limit }) => handleSearchSkills({ query, category, limit })
);
