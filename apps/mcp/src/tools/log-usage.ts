import { z } from "zod";
import { server } from "../server.js";

server.registerTool(
  "log_skill_usage",
  {
    description:
      "[DEPRECATED] Usage is now tracked automatically via PostToolUse hooks. This tool is no longer needed. Kept for backward compatibility.",
    inputSchema: {
      skillId: z.string().describe("The skill ID being used"),
      action: z
        .string()
        .optional()
        .default("use")
        .describe("The action being performed (defaults to 'use')"),
    },
  },
  async ({ skillId: _skillId, action: _action }) => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            deprecated: true,
            message:
              "Usage is now tracked automatically via PostToolUse hooks in skill frontmatter. This tool is no longer needed.",
          }),
        },
      ],
    };
  }
);
