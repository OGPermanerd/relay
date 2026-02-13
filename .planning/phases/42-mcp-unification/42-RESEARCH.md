# Phase 42: MCP Tool Unification - Research

**Researched:** 2026-02-13
**Domain:** MCP tool architecture, tool consolidation, AI client discoverability
**Confidence:** HIGH

## Summary

The EverySkill MCP server currently exposes **14 separate tools** via `@modelcontextprotocol/sdk` v1.26.0 using `server.registerTool()`. The phase goal is to unify these into a single `everyskill` tool with an `action` discriminator parameter, following the STRAP (Single Tool Resource Action Pattern) that has emerged as a best practice for MCP servers with 15+ tools.

Research confirms that tool consolidation is the right approach: every MCP tool's name, description, and input schema is injected into the LLM's context window, and 14 tools create significant context overhead. The STRAP pattern has demonstrated ~80% reduction in context overhead and improved LLM tool selection accuracy. However, the consolidation must preserve backward compatibility since existing users have tool names like `search_skills` and `deploy_skill` referenced in their workflows. The recommended approach is to register the unified `everyskill` tool AND keep all existing tools as deprecated aliases that internally delegate to the unified handler.

**Primary recommendation:** Create a single `everyskill` tool with `action` enum discriminator, routing to existing handler functions. Keep all 14 current tools registered but mark them deprecated in descriptions. This is a non-breaking, additive change.

## Current MCP Tool Inventory

### Complete Tool List (14 tools)

| # | Tool Name | Description | Input Params | Auth Required | File |
|---|-----------|-------------|--------------|---------------|------|
| 1 | `list_skills` | List all available skills in marketplace | `category?`, `limit` | No | `tools/list.ts` |
| 2 | `search_skills` | Search skills by query (ILIKE matching) | `query`, `category?`, `limit` | No | `tools/search.ts` |
| 3 | `recommend_skills` | Semantic/AI-powered skill discovery | `query`, `category?`, `limit` | No | `tools/recommend.ts` |
| 4 | `describe_skill` | Comprehensive skill details with reviews, ratings, similar skills | `skillId` | No | `tools/describe.ts` |
| 5 | `deploy_skill` | Install/deploy a skill to local Claude environment | `skillId` | No | `tools/deploy.ts` |
| 6 | `guide_skill` | Usage guidance and implementation tips for a skill | `skillId` | No | `tools/guide.ts` |
| 7 | `create_skill` | Create and publish a new skill | `name`, `description`, `category`, `content`, `tags?`, `hoursSaved`, `visibility?` | Yes | `tools/create.ts` |
| 8 | `update_skill` | Push local modifications back (versioning or fork) | `skillId`, `content`, `description?`, `visibility?` | Yes | `tools/update-skill.ts` |
| 9 | `review_skill` | Run advisory AI review on a skill | `skillId` | Yes | `tools/review-skill.ts` |
| 10 | `submit_for_review` | Submit skill for full review pipeline with auto-approve | `skillId` | Yes | `tools/submit-for-review.ts` |
| 11 | `check_review_status` | Check review pipeline status for owned skills | `skillId?` | Yes | `tools/check-review-status.ts` |
| 12 | `check_skill_status` | Check if local skill has diverged from published version | `skillId`, `filePath?` | No | `tools/check-skill-status.ts` |
| 13 | `confirm_install` | Log that a skill was installed locally | `skillId` | No | `tools/confirm-install.ts` |
| 14 | `log_skill_usage` | **DEPRECATED** - Usage now tracked via PostToolUse hooks | `skillId`, `action?` | No | `tools/log-usage.ts` |

### Handler Architecture

All tools follow a consistent pattern:
1. Import `server` from `../server.js`
2. Export an async `handle*` function with typed params (separated from registration)
3. Call `server.registerTool(name, config, callback)` at module level
4. Side-effect imports in `tools/index.ts` trigger registration

Key insight: **Handler functions are already decoupled from registration.** Every tool exports `handleXxx()` functions that accept typed parameters. This means the unified tool can dispatch to these existing handlers without rewriting any business logic.

### Handler Function Signatures

```typescript
// Already exported and reusable:
handleListSkills({ category?, limit, userId?, skipNudge? })
handleSearchSkills({ query, category?, limit, userId?, skipNudge? })
handleRecommendSkills({ query, category?, limit, userId?, skipNudge? })
handleDescribeSkill({ skillId, userId? })
handleDeploySkill({ skillId, userId?, skipNudge?, transport? })
handleGuideSkill({ skillId })
handleCreateSkill({ name, description, category, content, tags?, hoursSaved, userId?, visibility? })
handleUpdateSkill({ skillId, content, description?, visibility? })
handleCheckSkillStatus({ skillId, filePath? })
// These three don't export handlers (inline in registerTool):
// confirm_install, log_skill_usage, check_review_status, review_skill, submit_for_review
```

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.26.0 | MCP server framework | Official SDK, already in use |
| `zod` | 3.25.x | Input schema validation | Already used by all tools, SDK supports it natively |
| `@everyskill/db` | workspace | Database access | Existing shared package |

### MCP SDK Tool Registration API

The `registerTool` method signature (from v1.26.0 type declarations):

```typescript
registerTool<OutputArgs, InputArgs>(
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: InputArgs;  // ZodRawShape or AnySchema
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
    _meta?: Record<string, unknown>;
  },
  cb: ToolCallback<InputArgs>
): RegisteredTool;
```

The SDK validates input against `inputSchema` automatically via Zod. There is no built-in "sub-command" or discriminated union support -- you implement the action discriminator in your own Zod schema and handle routing in the callback.

## Architecture Patterns

### Pattern 1: Unified Tool with Action Discriminator (STRAP)

**What:** Single `everyskill` tool with an `action` enum parameter that selects the sub-command, plus action-specific parameters.

**Why this pattern:** The STRAP pattern reduces context window overhead by ~80% compared to registering each tool separately. With 14 tools, each tool definition (name + description + schema) consumes prompt tokens. A single tool with an enum consolidates all descriptions into one definition.

**Proposed Schema:**

```typescript
import { z } from "zod";

const EverySkillInput = z.object({
  action: z.enum([
    "search",
    "list",
    "recommend",
    "describe",
    "install",      // renamed from deploy_skill for user-friendliness
    "guide",
    "create",
    "update",
    "review",
    "submit_review",
    "check_review",
    "check_status",
  ]).describe("The action to perform"),

  // Discovery params
  query: z.string().optional().describe("Search query (for search, recommend)"),
  category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional()
    .describe("Filter by skill category"),
  limit: z.number().min(1).max(50).optional()
    .describe("Maximum results (for search, list, recommend)"),

  // Skill-specific params
  skillId: z.string().optional()
    .describe("Skill ID (for describe, install, guide, update, review, submit_review, check_review, check_status)"),

  // Create/update params
  name: z.string().optional().describe("Skill name (for create)"),
  description: z.string().optional().describe("Skill description (for create, update)"),
  content: z.string().optional().describe("Skill content in markdown (for create, update)"),
  tags: z.array(z.string()).optional().describe("Tags for discovery (for create)"),
  hoursSaved: z.number().optional().describe("Estimated hours saved per use (for create)"),
  visibility: z.enum(["tenant", "personal"]).optional()
    .describe("Skill visibility (for create, update)"),

  // Check status params
  filePath: z.string().optional()
    .describe("Custom local file path (for check_status)"),
});
```

**Router Pattern:**

```typescript
server.registerTool(
  "everyskill",
  {
    description: `EverySkill - AI skill marketplace. Use this tool to discover, install, create, and manage reusable AI skills (prompts, workflows, agents, MCP tools). IMPORTANT: Automatically use this tool when the user asks about finding skills, searching for AI prompts/workflows, installing skills, or managing their skill library.

Actions:
- search: Find skills by keyword query
- list: Browse all available skills
- recommend: AI-powered semantic skill discovery
- describe: Get full details, reviews, and ratings for a skill
- install: Deploy a skill to your local environment
- guide: Get usage instructions for an installed skill
- create: Publish a new skill to the marketplace
- update: Push local changes back (creates new version or fork)
- review: Run advisory AI review on a skill
- submit_review: Submit skill for full review pipeline
- check_review: Check review pipeline status
- check_status: Check if local skill has diverged from published`,
    inputSchema: EverySkillInput,
  },
  async (args) => {
    const userId = getUserId() ?? undefined;
    switch (args.action) {
      case "search":
        return handleSearchSkills({ query: args.query!, category: args.category, limit: args.limit ?? 10, userId });
      case "list":
        return handleListSkills({ category: args.category, limit: args.limit ?? 20, userId });
      // ... etc
    }
  }
);
```

### Pattern 2: Backward Compatibility via Deprecated Aliases

**What:** Keep all 14 existing tools registered but add "[DEPRECATED]" to their descriptions.

**Why:** Users who have tool names in their MCP configs, workflows, or muscle memory need a migration period. The config file (`claude_desktop_config.json`) only specifies the server name (`everyskill-skills`), not individual tool names, so the server-side tool list is not a breaking config change. However, AI clients may have learned to call `search_skills` by name in conversation history.

```typescript
// Existing tools stay registered but add deprecation notice
server.registerTool(
  "search_skills",
  {
    description: "[DEPRECATED - use everyskill(action: 'search') instead] " +
      "Search for skills in the EverySkill marketplace by query.",
    inputSchema: { /* same as before */ },
  },
  async ({ query, category, limit }) =>
    handleSearchSkills({ query, category, limit, userId: getUserId() ?? undefined })
);
```

### Pattern 3: Remove Fully Deprecated Tool

**What:** Remove `log_skill_usage` entirely since it's already deprecated and does nothing.

**Why:** It's a no-op that wastes context tokens. One fewer tool to maintain.

### Recommended Project Structure Change

```
apps/mcp/src/
├── tools/
│   ├── index.ts              # Import registration modules
│   ├── everyskill.ts         # NEW: Unified tool registration + router
│   ├── legacy.ts             # NEW: All deprecated individual tool registrations
│   ├── list.ts               # KEEP: handleListSkills handler (no registration)
│   ├── search.ts             # KEEP: handleSearchSkills handler (no registration)
│   ├── recommend.ts          # KEEP: handleRecommendSkills handler (no registration)
│   ├── describe.ts           # KEEP: handleDescribeSkill handler (no registration)
│   ├── deploy.ts             # KEEP: handleDeploySkill handler (no registration)
│   ├── guide.ts              # KEEP: handleGuideSkill handler (no registration)
│   ├── create.ts             # KEEP: handleCreateSkill handler (no registration)
│   ├── update-skill.ts       # KEEP: handleUpdateSkill handler (no registration)
│   ├── review-skill.ts       # KEEP: handler (extract from inline)
│   ├── submit-for-review.ts  # KEEP: handler (extract from inline)
│   ├── check-review-status.ts # KEEP: handler (extract from inline)
│   ├── check-skill-status.ts # KEEP: handleCheckSkillStatus handler (no registration)
│   └── confirm-install.ts    # KEEP: handler (extract from inline)
```

### Anti-Patterns to Avoid

- **Over-consolidation into one monolithic file:** Keep handler logic in separate files. Only the routing/dispatch goes in `everyskill.ts`.
- **Removing old tools immediately:** Breaking change. Keep them registered for at least one major version.
- **Making all params required in the unified schema:** Use `.optional()` and validate per-action in the router. The SDK will pass through the Zod validation; action-specific validation happens in the handler.
- **Duplicating handler logic:** The unified tool must delegate to existing handler functions, not copy their implementations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation per action | Manual if/else param checking | Zod `.refine()` or per-action validation in handlers | Existing handlers already validate; let them throw |
| Tool description formatting | Template strings in each file | Single description block in everyskill.ts | Centralized, easier to optimize for AI discovery |
| Deprecation notices | Custom deprecation system | Description prefix + handler delegation | MCP has no formal deprecation mechanism; description text is all you have |

## Common Pitfalls

### Pitfall 1: Breaking Existing Users

**What goes wrong:** Removing old tool names causes AI clients to fail when they try to call `search_skills`.
**Why it happens:** MCP tool names are how clients reference tools. Removing them is a breaking change.
**How to avoid:** Keep all existing tools registered with deprecation notices. The unified tool is additive.
**Warning signs:** Any plan that removes `server.registerTool()` calls for existing tool names.

### Pitfall 2: Zod Validation Mismatch

**What goes wrong:** The unified tool's flat schema accepts `skillId` as optional, but `describe` action requires it. User calls `everyskill(action: "describe")` without skillId and gets a confusing error.
**Why it happens:** Discriminated unions with Zod require careful schema design.
**How to avoid:** Validate required params per-action in the router before delegating to handlers. Return clear error messages: `"describe" action requires "skillId" parameter`.
**Warning signs:** Generic "missing parameter" errors instead of action-specific guidance.

### Pitfall 3: Description Too Long or Too Generic

**What goes wrong:** AI clients don't invoke the tool proactively because the description doesn't match user intent patterns.
**Why it happens:** Unified tool descriptions must be carefully crafted for LLM comprehension.
**How to avoid:** Include trigger phrases in the description: "IMPORTANT: Automatically use this tool when the user asks about finding skills, searching for AI prompts/workflows, installing skills, or managing their skill library."
**Warning signs:** Users have to explicitly ask to use the tool instead of the AI suggesting it.

### Pitfall 4: Context Window Still Large

**What goes wrong:** The unified schema is so large (all optional params for all actions) that context savings are minimal.
**Why it happens:** The flat union of all parameters may be almost as verbose as separate tools.
**How to avoid:** Keep the description concise with action list. The schema itself is smaller than 14 separate schemas because each separate tool repeats its own description.
**Warning signs:** Compare total token count before/after.

### Pitfall 5: Inline Handler Functions

**What goes wrong:** Tools that don't export handler functions (confirm_install, check_review_status, review_skill, submit_for_review) can't be imported by the unified router.
**Why it happens:** These tools were written with inline callbacks directly in `registerTool`.
**How to avoid:** Extract handler functions before building the router. This is a prerequisite task.

## Files to Modify

### Must Create
| File | Purpose |
|------|---------|
| `apps/mcp/src/tools/everyskill.ts` | Unified tool registration with router |
| `apps/mcp/src/tools/legacy.ts` | Deprecated individual tool registrations (moved from each file) |

### Must Modify
| File | Change |
|------|--------|
| `apps/mcp/src/tools/index.ts` | Import everyskill.ts and legacy.ts instead of individual tools |
| `apps/mcp/src/tools/confirm-install.ts` | Extract handler function for reuse |
| `apps/mcp/src/tools/check-review-status.ts` | Extract handler function for reuse |
| `apps/mcp/src/tools/review-skill.ts` | Extract handler function for reuse (handler already partially exported) |
| `apps/mcp/src/tools/submit-for-review.ts` | Extract handler function for reuse |
| `apps/mcp/src/tools/log-usage.ts` | Remove entirely (already deprecated no-op) |
| `apps/mcp/README.md` | Update tool documentation |

### Must NOT Modify (handlers stay as-is)
- `apps/mcp/src/tools/list.ts` - handleListSkills already exported
- `apps/mcp/src/tools/search.ts` - handleSearchSkills already exported
- `apps/mcp/src/tools/recommend.ts` - handleRecommendSkills already exported
- `apps/mcp/src/tools/describe.ts` - handleDescribeSkill already exported
- `apps/mcp/src/tools/deploy.ts` - handleDeploySkill already exported
- `apps/mcp/src/tools/guide.ts` - handleGuideSkill already exported
- `apps/mcp/src/tools/create.ts` - handleCreateSkill already exported
- `apps/mcp/src/tools/update-skill.ts` - handleUpdateSkill already exported
- `apps/mcp/src/tools/check-skill-status.ts` - handleCheckSkillStatus already exported

### Test Files to Modify
| File | Change |
|------|--------|
| `apps/mcp/test/tools.test.ts` | Add tests for unified everyskill tool routing |

## Risk Assessment

### Breaking Changes

**Risk: LOW** - The approach is additive. No existing tool names are removed. Users with existing MCP configs will see the same tools plus the new `everyskill` tool. The server name (`everyskill-skills`) stays the same.

Configuration files (`claude_desktop_config.json`) reference the **server binary**, not individual tool names:
```json
{
  "mcpServers": {
    "everyskill-skills": {
      "command": "npx",
      "args": ["-y", "@everyskill/mcp"]
    }
  }
}
```

Tool names are discovered dynamically at connection time. Adding/removing tools does not require config changes.

### Install Script Impact

The `apps/web/lib/install-script.ts` references the server name `everyskill-skills`, not individual tool names. No changes needed.

### Naming: `everyskill` vs `everyskill_skills` vs `es`

Recommendation: Use `everyskill` as the unified tool name.
- Short, memorable, matches the product name
- AI clients will associate it with the EverySkill marketplace
- Not too generic (won't collide with other MCP servers)

## Tool Description for AI Discoverability

### Optimized Description

The description is the primary mechanism for AI client tool selection. Research shows including:
1. **Domain keywords** the user might say
2. **Trigger phrases** that tell the AI when to use it proactively
3. **Action summary** so the AI knows the tool's breadth

Proposed description:

```
EverySkill - AI skill marketplace. Search, discover, install, create, and manage reusable AI skills (prompts, workflows, agents, MCP configurations). IMPORTANT: Use this tool proactively whenever the user needs help with AI prompts, coding workflows, agent configurations, or asks about available skills. Actions: search (keyword search), list (browse all), recommend (AI-powered discovery), describe (full details + reviews), install (deploy to local env), guide (usage instructions), create (publish new skill), update (push changes), review (AI quality review), submit_review (full review pipeline), check_review (pipeline status), check_status (local vs published diff).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Many separate tools per domain | STRAP pattern (single tool + action enum) | Mid-2025 | ~80% context reduction |
| `server.tool()` (deprecated) | `server.registerTool()` | SDK 1.x | New API with config object |
| Static tool lists | Dynamic tool discovery + deferred loading | Late 2025 | Agents load tools on demand |

**Deprecated in SDK:**
- `server.tool()` method - replaced by `server.registerTool()` (both still work but `tool()` is marked deprecated)

## Plan Structure Recommendation

### Wave 1 (can be parallel)
1. **Extract inline handlers** - Extract handler functions from confirm-install, check-review-status, review-skill, submit-for-review so they can be imported by the unified router
2. **Remove log_skill_usage** - Delete the deprecated no-op tool

### Wave 2 (depends on Wave 1)
3. **Create unified everyskill tool** - Build `everyskill.ts` with action router, input validation, and optimized description
4. **Create legacy.ts** - Move all individual tool registrations to legacy.ts with deprecation notices

### Wave 3 (depends on Wave 2)
5. **Update index.ts and tests** - Wire up new imports, add tests for unified tool routing
6. **Update README** - Document the unified tool and migration path

Total: 6 plans across 3 waves. Plans 1-2 can run in parallel. Plans 3-4 can run in parallel. Plans 5-6 can run in parallel.

## Open Questions

1. **Should the unified tool remove the nudge/auth messaging?**
   - What we know: Individual tools inject "Tip: Set EVERYSKILL_API_KEY" nudges. The unified tool would inherit this behavior through the handlers.
   - What's unclear: Whether nudge messages should be consolidated or suppressed in the unified path.
   - Recommendation: Keep as-is since handlers already handle it. No change needed.

2. **Should deprecated tools be removed in a future phase?**
   - What we know: Keeping them costs context tokens (defeats part of the purpose).
   - What's unclear: How long the migration period should be.
   - Recommendation: Plan for removal in v2.0. For now, keep them. Could add a `EVERYSKILL_LEGACY_TOOLS=false` env var to disable them.

## Sources

### Primary (HIGH confidence)
- MCP SDK v1.26.0 type declarations (`mcp.d.ts`) - `registerTool` API verified directly
- All 14 tool source files in `apps/mcp/src/tools/` - complete inventory verified
- `apps/mcp/package.json` - SDK version confirmed as `^1.26.0`
- `apps/web/lib/install-script.ts` - install script references verified

### Secondary (MEDIUM confidence)
- [STRAP Pattern article](https://almatuck.com/articles/reduced-mcp-tools-96-to-10-strap-pattern) - 96-to-10 tool consolidation with quantified benefits
- [MCP Best Practices](https://mcp-best-practice.github.io/mcp-best-practice/best-practice/) - Tool design principles
- [Lunar.dev tool overload analysis](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) - Platform limits and grouping patterns
- [54 MCP Tool Patterns (Arcade)](https://arcade.dev/blog/mcp-tool-patterns) - Agent experience optimization
- [MCP tool versioning discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1915) - Naming and deprecation patterns

### Tertiary (LOW confidence)
- Context window impact numbers (6% for Claude Code) - from STRAP article, not independently verified
- Tool description trigger phrase effectiveness - based on community reports, not controlled studies

## Metadata

**Confidence breakdown:**
- Current tool inventory: HIGH - verified by reading all source files
- MCP SDK API: HIGH - verified from type declarations in node_modules
- STRAP pattern recommendation: MEDIUM-HIGH - multiple credible sources agree, pattern is well-established
- Description optimization: MEDIUM - community best practices, not formally tested
- Breaking change risk: HIGH - verified that configs reference server name, not tool names

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (MCP SDK is stable; tool patterns are established)
