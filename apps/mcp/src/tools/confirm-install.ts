import { z } from "zod";
import { server } from "../server.js";
import { trackUsage } from "../tracking/events.js";
import { getUserId } from "../auth.js";

server.registerTool(
  "confirm_install",
  {
    description:
      "Confirm that a skill has been saved/installed locally. Call this after saving a deployed skill file to log the installation.",
    inputSchema: {
      skillId: z.string().describe("The skill ID that was installed"),
    },
  },
  async ({ skillId }) => {
    const userId = getUserId() ?? undefined;

    await trackUsage({ toolName: "confirm_install", skillId, userId }, { skipIncrement: true });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, message: "Installation confirmed" }),
        },
      ],
    };
  }
);
