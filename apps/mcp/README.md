# @everyskill/mcp

MCP server exposing EverySkill skill marketplace tools to Claude Desktop. Enables Claude Code to discover, search, and deploy skills from the EverySkill marketplace directly into your local development environment.

## Available Tools

### list_skills

List all available skills in the EverySkill marketplace.

**Parameters:**
- `category` (optional): Filter by skill category - "prompt", "workflow", "agent", or "mcp"
- `limit` (optional): Maximum number of results (1-50, default: 20)

**Returns:** Array of skills with id, name, description, category, and estimated hours saved.

### search_skills

Search for skills by query matching name and description.

**Parameters:**
- `query` (required): Search query string
- `category` (optional): Filter by skill category
- `limit` (optional): Maximum number of results (1-25, default: 10)

**Returns:** Matching skills with relevance to search query.

### deploy_skill

Get skill content for deployment to your local Claude environment.

**Parameters:**
- `skillId` (required): Skill ID from list_skills or search_skills results

**Returns:** Skill content and filename. Claude Code will save this to your `.claude/skills/` directory.

## Prerequisites

- Node.js 22+
- pnpm (for monorepo)
- PostgreSQL database with skills and usageEvents tables
- Built MCP server

## Installation

### 1. Build the MCP Server

From the repository root:

```bash
pnpm install
pnpm --filter @everyskill/mcp build
```

This creates the `dist/` directory with compiled JavaScript.

### 2. Configure Claude Desktop

Copy the example configuration to your Claude Desktop config location:

```bash
cp apps/mcp/claude_desktop_config.example.json ~/.claude/claude_desktop_config.json
```

Edit `~/.claude/claude_desktop_config.json` and replace `/path/to/everyskill` with the absolute path to your everyskill repository:

```json
{
  "mcpServers": {
    "everyskill-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/everyskill/apps/mcp/dist/index.js"]
    }
  }
}
```

### 3. Set Environment Variables

The MCP server requires a `DATABASE_URL` environment variable. You can either:

- Set it in your shell profile (`.bashrc`, `.zshrc`)
- Set it in the Claude Desktop config using the `env` key

### 4. Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration. The everyskill-mcp tools should now be available.

### 5. Verify Installation

In a Claude Desktop conversation, try using one of the tools:

- Ask Claude to "list skills from everyskill"
- Ask Claude to "search for authentication skills in everyskill"

If tools aren't appearing, see Troubleshooting below.

## Development

```bash
# Run in development mode (watch)
pnpm --filter @everyskill/mcp dev

# Run tests
pnpm --filter @everyskill/mcp test

# Type checking
pnpm --filter @everyskill/mcp typecheck

# Build for production
pnpm --filter @everyskill/mcp build
```

## Database Requirements

The MCP server requires a PostgreSQL database with the following tables:

- `skills` - Skill definitions (name, content, category, etc.)
- `usageEvents` - Usage tracking for analytics

To set up the database:

```bash
# Create tables (from monorepo root)
pnpm --filter @everyskill/db db:push
```

## Troubleshooting

### Tools not appearing in Claude Desktop

1. **Verify config file location:**
   The config should be at `~/.claude/claude_desktop_config.json`

2. **Verify the path is correct:**
   The path in `args` must be an absolute path to `dist/index.js`

3. **Check that MCP server is built:**
   Verify the `dist/` directory exists with `index.js` inside

4. **Restart Claude Desktop:**
   Config changes require a full restart (not just closing the window)

5. **Check Claude Desktop logs:**
   Look for MCP connection errors in Claude Desktop's developer console

### Database connection errors

1. **Ensure PostgreSQL is running:**
   Verify with `psql -h localhost -U postgres`

2. **Verify DATABASE_URL:**
   Format: `postgresql://user:password@localhost:5432/everyskill`

3. **Create tables if missing:**
   Run `pnpm --filter @everyskill/db db:push`

### "Database not configured" error

This means `DATABASE_URL` is not set or the database connection failed. Ensure the environment variable is available to the node process that Claude Desktop spawns.

## Architecture

The MCP server uses:

- `@modelcontextprotocol/sdk` - Official MCP SDK
- `stdio` transport - Universal client compatibility
- `@everyskill/db` - Shared database client with drizzle ORM
- `zod` - Input validation and schema definitions

All tools track usage via the `usageEvents` table for analytics (FTE Days Saved metric).
