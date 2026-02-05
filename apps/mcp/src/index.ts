import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { resolveUserId } from "./auth.js";

// Register tools after server is created to avoid circular dependency
import "./tools/index.js";

async function main() {
  // Resolve userId before connecting so it's ready for first tool call
  await resolveUserId();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // CRITICAL: Use console.error, never console.log (corrupts stdio protocol)
  console.error("Relay MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
