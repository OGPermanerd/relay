import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const server = new McpServer({
  name: "relay-skills",
  version: "1.0.0",
});

// Tools will be registered by importing tool modules
export type { McpServer };
