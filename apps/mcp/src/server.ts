import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const server = new McpServer({
  name: "relay-skills",
  version: "1.0.0",
});

server.registerPrompt(
  "suggest_skills",
  {
    description: "Suggest relevant Relay skills for the current conversation",
  },
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Search Relay for skills relevant to the current conversation. Use search_skills with a query matching the user's task, then present the top results with descriptions.",
        },
      },
    ],
  })
);

export type { McpServer };
