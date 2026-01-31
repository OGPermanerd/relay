import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const server = new McpServer({
  name: "relay-skills",
  version: "1.0.0",
});

export type { McpServer };
