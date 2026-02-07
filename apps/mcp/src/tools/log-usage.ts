import { z } from "zod";
import { server } from "../server.js";
import { trackUsage } from "../tracking/events.js";
import { getUserId } from "../auth.js";

server.registerTool(
  "log_skill_usage",
  {
    description:
      "Log that a skill is being used in a conversation. Call this when you actually use a deployed skill to track real usage.",
    inputSchema: {
      skillId: z.string().describe("The skill ID being used"),
      action: z
        .string()
        .optional()
        .default("use")
        .describe("The action being performed (defaults to 'use')"),
    },
  },
  async ({ skillId, action }) => {
    const userId = getUserId() ?? undefined;

    await trackUsage(
      { toolName: "log_skill_usage", skillId, userId, metadata: { action } },
      { skipIncrement: true }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, message: "Usage logged" }),
        },
      ],
    };
  }
);
