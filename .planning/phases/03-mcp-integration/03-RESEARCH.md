# Phase 3: MCP Integration - Research

**Researched:** 2026-01-31
**Domain:** Model Context Protocol (MCP) Server Development for Claude Code
**Confidence:** HIGH

## Summary

This research covers building an MCP server that exposes Relay's skill marketplace to Claude Code users. The MCP (Model Context Protocol) is Anthropic's open standard for AI-tool integrations, enabling Claude to discover, list, and deploy skills directly from within Claude Code sessions.

The standard approach uses the official `@modelcontextprotocol/sdk` TypeScript package (currently v1.25.x) with stdio transport for local development and testing. The MCP server will expose tools for searching/listing skills and a deployment workflow that copies skill configurations to the user's Claude Code environment. Usage tracking is implemented server-side by logging tool invocations with context (user, skill, timestamp) to the existing PostgreSQL database via Drizzle ORM.

Key insight: MCP provides tools (actions Claude can invoke), resources (data Claude can read), and prompts (reusable templates). For Relay's skill marketplace, we primarily need **tools** for search/list operations and deployment actions.

**Primary recommendation:** Build a stdio-based MCP server as a new `apps/mcp` package using `@modelcontextprotocol/sdk` with TypeScript, exposing skill CRUD tools and tracking usage in the existing PostgreSQL database.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.25.0 | MCP server implementation | Official SDK from Anthropic/Linux Foundation |
| zod | ^3.25.0 | Schema validation (peer dep) | Required by MCP SDK for input schemas |
| drizzle-orm | ^0.38.0 | Database access | Already used in project |
| postgres | ^3.4.0 | PostgreSQL driver | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.19.0 | TypeScript execution | Development mode, running server directly |
| tsup | ^8.3.0 | Bundle TypeScript | Building for distribution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdio transport | HTTP Streamable | HTTP needed for remote deployment; stdio simpler for local Claude Code |
| Custom MCP | fastmcp (Python) | Python SDK has higher-level FastMCP; TypeScript requires manual setup |

**Installation:**
```bash
pnpm add @modelcontextprotocol/sdk zod
pnpm add -D tsx tsup @types/node typescript
```

## Architecture Patterns

### Recommended Project Structure
```
apps/mcp/
├── src/
│   ├── index.ts              # Entry point, server setup
│   ├── server.ts             # McpServer configuration
│   ├── tools/                # Tool implementations
│   │   ├── index.ts          # Tool registration
│   │   ├── search.ts         # search_skills tool
│   │   ├── list.ts           # list_skills tool
│   │   └── deploy.ts         # deploy_skill tool
│   ├── tracking/             # Usage tracking
│   │   └── events.ts         # Usage event logging
│   └── types.ts              # Shared types
├── package.json
└── tsconfig.json
```

### Pattern 1: Tool Registration with Zod Schemas
**What:** Define tools using `server.registerTool()` with Zod schemas for input validation
**When to use:** Every tool implementation
**Example:**
```typescript
// Source: Official MCP TypeScript SDK documentation
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "everyskill-skills",
  version: "1.0.0",
});

server.registerTool(
  "search_skills",
  {
    description: "Search for skills in the Relay marketplace by query",
    inputSchema: {
      query: z.string().describe("Search query for skills"),
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().min(1).max(50).default(10).describe("Max results"),
    },
  },
  async ({ query, category, limit }) => {
    // Implementation
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  }
);
```

### Pattern 2: Stdio Transport Setup
**What:** Configure server to communicate via stdin/stdout for Claude Code
**When to use:** Local MCP server integration
**Example:**
```typescript
// Source: Official MCP Build Server Tutorial
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Relay MCP Server running on stdio"); // stderr is safe
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### Pattern 3: Usage Event Tracking
**What:** Log tool invocations to database for analytics
**When to use:** Every tool that should track usage
**Example:**
```typescript
// Pattern for usage tracking
async function trackUsage(event: {
  toolName: string;
  skillId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(usageEvents).values({
    id: crypto.randomUUID(),
    toolName: event.toolName,
    skillId: event.skillId,
    userId: event.userId,
    metadata: event.metadata,
    createdAt: new Date(),
  });
}

// In tool handler:
server.registerTool("deploy_skill", { ... }, async (args) => {
  await trackUsage({
    toolName: "deploy_skill",
    skillId: args.skillId,
    // userId from context if available
  });
  // ... rest of implementation
});
```

### Anti-Patterns to Avoid
- **Using console.log in stdio servers:** Corrupts JSON-RPC protocol. Use console.error for logging.
- **Blocking operations without timeouts:** MCP tool calls should have reasonable timeouts.
- **Returning non-text content types without checking client support:** Stick to text content type for compatibility.
- **Mixing transport concerns with business logic:** Keep tool implementations transport-agnostic.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC protocol | Custom JSON-RPC parser | @modelcontextprotocol/sdk | Complex edge cases, message framing |
| Input validation | Manual validation | Zod schemas via SDK | Type safety, auto-generated tool definitions |
| Transport handling | Custom stdio parser | StdioServerTransport | Handles chunking, buffering, error states |
| Skill deployment | Custom file writing | Claude Code config API | Use `claude mcp add-json` pattern |

**Key insight:** The MCP SDK handles all protocol-level complexity. Focus on business logic (search, list, deploy) rather than transport concerns.

## Common Pitfalls

### Pitfall 1: stdout Corruption
**What goes wrong:** Server output gets mixed with MCP protocol messages, breaking communication
**Why it happens:** Using console.log() or print statements in stdio servers
**How to avoid:** Use console.error() for all logging; never write to stdout except through transport
**Warning signs:** "Connection closed" errors, malformed JSON errors in Claude Code

### Pitfall 2: Missing Database Connection
**What goes wrong:** MCP server fails to connect to PostgreSQL
**Why it happens:** DATABASE_URL not available in MCP server environment
**How to avoid:** Pass database connection via environment variable when registering with Claude Code
**Warning signs:** Server crashes on startup, "Database not configured" errors

### Pitfall 3: Large Response Payloads
**What goes wrong:** Tool returns exceed token limits, causing warnings or truncation
**Why it happens:** Returning entire skill catalogs or detailed metadata
**How to avoid:** Paginate results, limit response size, return IDs + summary instead of full objects
**Warning signs:** Claude Code shows "MCP output exceeds 10,000 tokens" warning

### Pitfall 4: No Error Context
**What goes wrong:** Failures are opaque, hard to debug
**Why it happens:** Catching errors and returning generic messages
**How to avoid:** Return structured error responses with actionable context
**Warning signs:** Users report "something went wrong" without ability to self-remedy

### Pitfall 5: Skill Deployment Path Issues
**What goes wrong:** Skills deploy to wrong location or fail to register
**Why it happens:** Hardcoding paths, not handling different OS configurations
**How to avoid:** Use Claude Code's `claude mcp add-json` pattern or detect config locations
**Warning signs:** Skills appear deployed but don't show in `/mcp` command

## Code Examples

Verified patterns from official sources:

### MCP Server Initialization
```typescript
// Source: modelcontextprotocol.io/docs/develop/build-server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "everyskill-skills",
  version: "1.0.0",
});

// Server capabilities
// Note: Tools are auto-enabled when you registerTool()
```

### Search Tool Implementation
```typescript
// Pattern for search functionality
server.registerTool(
  "search_skills",
  {
    description: "Search Relay skill marketplace. Returns matching skills with ID, name, description, and hours_saved.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (matches name, description, tags)"),
      category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
      limit: z.number().min(1).max(25).default(10),
    },
  },
  async ({ query, category, limit }) => {
    // Query database
    const skills = await db.query.skills.findMany({
      where: and(
        or(
          ilike(skills.name, `%${query}%`),
          ilike(skills.description, `%${query}%`)
        ),
        category ? eq(skills.category, category) : undefined
      ),
      limit,
    });

    // Track usage
    await trackUsage({ toolName: "search_skills", metadata: { query, category } });

    // Return formatted results
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          count: skills.length,
          skills: skills.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            category: s.category,
            hours_saved: s.hoursSaved,
          })),
        }, null, 2),
      }],
    };
  }
);
```

### Deploy Tool Implementation
```typescript
// Pattern for skill deployment
server.registerTool(
  "deploy_skill",
  {
    description: "Deploy a skill from Relay to your local Claude Code environment. Creates the skill file in your project.",
    inputSchema: {
      skillId: z.string().uuid().describe("Skill ID from search results"),
      projectPath: z.string().optional().describe("Project path (defaults to cwd)"),
    },
  },
  async ({ skillId, projectPath }) => {
    // Fetch skill details
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, skillId),
    });

    if (!skill) {
      return {
        content: [{ type: "text", text: "Error: Skill not found" }],
        isError: true,
      };
    }

    // Track deployment
    await trackUsage({
      toolName: "deploy_skill",
      skillId,
      metadata: { skillName: skill.name },
    });

    // Return skill content for Claude to save
    // Claude Code will handle file writing with user confirmation
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          skill: {
            name: skill.name,
            filename: `${skill.slug}.md`,
            content: skill.content,
            instructions: `Save this skill to your project's .claude/skills/ directory`,
          },
        }, null, 2),
      }],
    };
  }
);
```

### Usage Events Schema
```typescript
// Database schema for usage tracking (Drizzle ORM)
import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolName: text("tool_name").notNull(),
  skillId: uuid("skill_id").references(() => skills.id),
  userId: text("user_id").references(() => users.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Type inference
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP+SSE transport | Streamable HTTP | 2025-03-26 | SSE deprecated, but stdio still preferred for local |
| Manual JSON-RPC | McpServer class | SDK v1.0.0 | Simplified server creation |
| Server.setRequestHandler | server.registerTool | SDK v1.20+ | Cleaner tool registration API |

**Deprecated/outdated:**
- HTTP+SSE transport: Deprecated in favor of Streamable HTTP for remote servers
- `Server` class (lowercase): Use `McpServer` from `/server/mcp.js`
- Direct stdio handling: Use `StdioServerTransport`

## Open Questions

Things that couldn't be fully resolved:

1. **User Identity in MCP Context**
   - What we know: MCP tools receive input arguments but limited context about the caller
   - What's unclear: How to reliably identify the user invoking a tool for usage tracking
   - Recommendation: Consider requiring a user token as tool argument or accept anonymous tracking initially

2. **Skill Content Format**
   - What we know: Skills are markdown files with YAML frontmatter (SKILL.md format)
   - What's unclear: Whether to store full SKILL.md in database or decompose into structured fields
   - Recommendation: Store structured (name, description, content) for search, generate SKILL.md on deploy

3. **Claude Code Config Path Detection**
   - What we know: Config is at ~/.claude.json or project-level .mcp.json
   - What's unclear: Best approach for cross-platform deployment
   - Recommendation: Return skill content and instructions; let Claude Code handle file operations

## Sources

### Primary (HIGH confidence)
- [modelcontextprotocol.io/docs/develop/build-server](https://modelcontextprotocol.io/docs/develop/build-server) - Official MCP server building guide
- [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) - Official TypeScript SDK
- [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) - Claude Code MCP documentation

### Secondary (MEDIUM confidence)
- [github.com/anthropics/skills](https://github.com/anthropics/skills) - Anthropic's skills system (informs skill format)
- [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - Package registry, version info

### Tertiary (LOW confidence)
- [tinybird.co/blog-posts/analyze-mcp-server-usage](https://www.tinybird.co/blog-posts/analyze-mcp-server-usage) - Usage analytics patterns
- [mcpcat.io](https://mcpcat.io/) - Third-party MCP analytics service (shows what's possible)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK well documented, stable API
- Architecture: HIGH - Follows official patterns from build-server tutorial
- Pitfalls: MEDIUM - Based on official warnings + community experience
- Usage tracking: MEDIUM - Custom implementation, no official guidance

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (60 days - MCP specification evolving)
