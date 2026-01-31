import { z } from "zod";
import { server } from "../server.js";
import { db } from "@relay/db";
import { trackUsage } from "../tracking/events.js";

server.registerTool(
  "list_skills",
  {
    description:
      "List all available skills in the Relay marketplace. Returns skill ID, name, description, category, and estimated hours saved.",
    inputSchema: {
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(50).default(20).describe("Maximum number of results"),
    },
  },
  async ({ category, limit }) => {
    if (!db) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Database not configured" }),
          },
        ],
        isError: true,
      };
    }

    // Fetch all skills and filter in-memory to avoid TypeScript module resolution issues
    const allResults = await db.query.skills.findMany({
      limit: category ? undefined : limit, // Fetch all if filtering
      columns: {
        id: true,
        name: true,
        description: true,
        category: true,
        hoursSaved: true,
      },
    });

    const results = category
      ? allResults.filter((s) => s.category === category).slice(0, limit)
      : allResults;

    await trackUsage({
      toolName: "list_skills",
      metadata: { category, limit, resultCount: results.length },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
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
);
