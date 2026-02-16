# Phase 70: MCP Preference Sync - Research

**Researched:** 2026-02-16
**Domain:** MCP tool actions for user preference CRUD + search preference boosting
**Confidence:** HIGH

## Summary

Phase 70 wires user search preferences (already stored in `user_preferences.preferences` JSONB) into the MCP tool layer. The web UI already has a complete preferences system (Phase 43): schema, service, server actions, and a settings form. The MCP server already has authentication that resolves `userId` and `tenantId` from API keys. The work is purely additive: adding two new actions to the unified `everyskill` tool (`get_preferences`, `set_preferences`) and modifying the existing `search`/`recommend` handlers to apply the same category boost logic the web UI uses in `discover.ts`.

No new dependencies, no new database tables, no migrations needed. The `getOrCreateUserPreferences()` and `updateUserPreferences()` functions from `packages/db/src/services/user-preferences.ts` are already exported and available to the MCP app via `@everyskill/db/services/user-preferences`.

**Primary recommendation:** Add two new actions to the existing `everyskill` unified tool (not new standalone tools), reuse the existing DB service functions, and port the `PREFERENCE_BOOST = 1.3` multiplier from `apps/web/app/actions/discover.ts` into the MCP search/recommend handlers.

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@modelcontextprotocol/sdk` | 1.26.0 | MCP server, `registerTool` | Already installed |
| `@everyskill/db` | workspace | DB services, schema | Already installed |
| Zod | 3.25+ | Input validation | Already installed |
| Drizzle ORM | 0.42.0 | Query builder | Already installed |

### Supporting (No Changes)

No new libraries needed. This phase is entirely modifications to existing MCP tool files and one shared DB service.

**Installation:**
```bash
# No new packages needed
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New unified tool actions | Separate standalone tools | Standalone tools would bloat the tool list; the project already consolidates into `everyskill` unified tool |
| MCP Resources (read-only) | N/A | Resources are read-only in MCP; preferences need write access, so tools are required |

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files and modifications slot into existing structure:

```
apps/mcp/src/tools/
  everyskill.ts         # MODIFY: add get_preferences, set_preferences actions to ACTIONS + switch
  search.ts             # MODIFY: add preference boost logic
  recommend.ts          # MODIFY: add preference boost logic
  preferences.ts        # NEW: handler functions for get/set preferences
```

### Pattern 1: Unified Tool Action Routing (EXISTING)

**What:** All MCP operations route through a single `everyskill` tool with an `action` discriminator field.
**When to use:** Always -- this is the established pattern, new actions MUST use it.

The existing pattern in `apps/mcp/src/tools/everyskill.ts`:

```typescript
// 1. Add to ACTIONS const array
const ACTIONS = [
  "search", "list", "recommend", /* ... existing ... */
  "get_preferences",   // NEW
  "set_preferences",   // NEW
] as const;

// 2. Add input schema fields for the new actions
const EverySkillInputSchema = {
  action: z.enum(ACTIONS).describe("...updated description..."),
  // NEW fields:
  preferredCategories: z.array(
    z.enum(["productivity", "wiring", "doc-production", "data-viz", "code"])
  ).optional().describe("Preferred skill categories (used by: set_preferences)"),
  defaultSort: z.enum(["uses", "quality", "rating", "days_saved"])
    .optional().describe("Default sort order (used by: set_preferences)"),
};

// 3. Add switch cases in routeEveryskillAction()
case "get_preferences": {
  return handleGetPreferences({ userId });
}
case "set_preferences": {
  return handleSetPreferences({
    userId,
    preferredCategories: args.preferredCategories,
    defaultSort: args.defaultSort,
  });
}
```

### Pattern 2: Auth Guard for Preference Actions

**What:** Preference read/write requires authentication. The existing MCP auth module caches `userId` and `tenantId`.
**When to use:** Both `get_preferences` and `set_preferences` actions.

```typescript
// apps/mcp/src/tools/preferences.ts
import { getUserId, getTenantId } from "../auth.js";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
} from "@everyskill/db/services/user-preferences";

export async function handleGetPreferences({ userId }: { userId?: string }) {
  if (!userId) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        error: "Authentication required",
        message: "Set EVERYSKILL_API_KEY to access your preferences",
      }) }],
      isError: true,
    };
  }

  const tenantId = getTenantId();
  if (!tenantId) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        error: "Tenant not resolved",
        message: "Your API key could not resolve a tenant",
      }) }],
      isError: true,
    };
  }

  const prefs = await getOrCreateUserPreferences(userId, tenantId);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      preferredCategories: prefs?.preferredCategories ?? [],
      defaultSort: prefs?.defaultSort ?? "days_saved",
    }, null, 2) }],
  };
}
```

### Pattern 3: Preference Boost in MCP Search (Port from Web)

**What:** The web discover action applies a 1.3x RRF score boost to results in the user's preferred categories. The MCP search/recommend handlers must apply the same boost.
**When to use:** When an authenticated user calls `search` or `recommend` actions.

The existing web implementation in `apps/web/app/actions/discover.ts`:

```typescript
const PREFERENCE_BOOST = 1.3;

function applyPreferenceBoost(results, preferredCategories) {
  const boosted = results.map((r) => {
    const isBoosted = preferredCategories.includes(r.category);
    return {
      ...r,
      rrfScore: isBoosted ? r.rrfScore * PREFERENCE_BOOST : r.rrfScore,
      isBoosted,
    };
  });
  boosted.sort((a, b) => b.rrfScore - a.rrfScore);
  return boosted;
}
```

For MCP search, the pattern must adapt because `searchSkillsByQuery` returns field-weighted relevance scores (not RRF scores). The boost should apply to the result ordering, not to a score that's returned to the user. Approach: fetch preferences, then reorder results with boosted categories promoted.

For MCP recommend, the pattern is closer because `semanticSearchSkills` returns similarity scores. Apply the boost to similarity before sorting.

### Anti-Patterns to Avoid

- **Separate tools for preferences:** Don't create standalone `get_preferences` / `set_preferences` tools. The project has a strict pattern of routing through the unified `everyskill` tool. Legacy standalone tools exist but are deprecated.
- **Duplicating the Zod schema:** Don't recreate the preferences validation schema in the MCP app. Import `UserPreferencesData` type from `@everyskill/db/schema/user-preferences` and do field-level validation in the MCP input schema (the Zod shape is already defined in the `EverySkillInputSchema`).
- **Using `claudeMdWorkflowNotes` or `trainingDataConsent` in MCP:** These fields are web-UI-specific. The MCP actions should only expose `preferredCategories` and `defaultSort` -- the two fields relevant to search behavior.
- **Bypassing auth for preference reads:** Even though preferences aren't sensitive secrets, they're user-specific data that should require authentication.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preference storage | Custom JSONB handling | `getOrCreateUserPreferences()`, `updateUserPreferences()` from `@everyskill/db/services/user-preferences` | Already handles defaults merging, conflict resolution, and validation |
| Auth resolution | Custom API key validation | `getUserId()`, `getTenantId()` from `apps/mcp/src/auth.ts` | Already caches result, handles missing key gracefully |
| Preference validation | Custom Zod schema | `UserPreferencesData` type from `@everyskill/db/schema/user-preferences` | Canonical type, shared with web app |
| Category boost logic | New algorithm | Port `PREFERENCE_BOOST = 1.3` from `apps/web/app/actions/discover.ts` | Must match web behavior for requirement parity |

**Key insight:** Every piece needed already exists in the codebase. The entire phase is wiring existing services into existing MCP tool patterns.

## Common Pitfalls

### Pitfall 1: Partial Preference Updates Overwrite Full JSONB

**What goes wrong:** `updateUserPreferences()` replaces the entire `preferences` JSONB column. If the MCP `set_preferences` action only sends `preferredCategories`, the existing `defaultSort`, `claudeMdWorkflowNotes`, and `trainingDataConsent` values get wiped.
**Why it happens:** The service does `set({ preferences, updatedAt })` -- a full replacement, not a merge.
**How to avoid:** The MCP handler MUST read current preferences first (via `getOrCreateUserPreferences()`), merge the changed fields, then write back the full object.
**Warning signs:** Web UI shows reset values after MCP preference update.

### Pitfall 2: MCP stdout Corruption

**What goes wrong:** Using `console.log` in MCP handlers corrupts the stdio transport protocol.
**Why it happens:** MCP over stdio uses stdout for JSON-RPC messages. Any non-protocol stdout breaks the connection.
**How to avoid:** All logging MUST use `console.error`. This is enforced by convention across all existing MCP handlers.
**Warning signs:** MCP client disconnects or shows parse errors.

### Pitfall 3: Boost Logic Divergence Between Web and MCP

**What goes wrong:** The MCP search boost uses a different multiplier or application point than the web, leading to different result ordering for the same preferences.
**Why it happens:** The web uses `PREFERENCE_BOOST = 1.3` applied to RRF scores, while MCP search uses ILIKE relevance scoring. Direct score multiplication is not equivalent.
**How to avoid:** For MCP search (`searchSkillsByQuery`), the results don't have RRF scores -- they have implicit ordering from the SQL query. The boost must be applied as a post-query reranking: fetch results, check each result's category against user preferences, promote boosted results to the top of their relevance tier (or apply a simple sort weight). For MCP recommend (semantic search with RRF), the approach matches the web more closely.
**Warning signs:** MCP and web return results in noticeably different orders for the same query + preferences.

### Pitfall 4: Anonymous Users Get Error Instead of Graceful Degradation

**What goes wrong:** Anonymous (no API key) users calling search/recommend get an error because preference lookup fails.
**Why it happens:** `getOrCreateUserPreferences()` requires a userId and tenantId.
**How to avoid:** The search/recommend boost logic must check if userId is present before attempting to load preferences. If no userId, skip the boost (no-op) -- exactly how the web does it in `discover.ts` (lines 150-158).
**Warning signs:** Anonymous MCP search stops working.

### Pitfall 5: Adding Input Fields Breaks Existing Clients

**What goes wrong:** Adding new required fields to the `EverySkillInputSchema` causes existing MCP clients to fail validation.
**Why it happens:** The unified tool schema validates all fields globally, not per-action.
**How to avoid:** All new fields (`preferredCategories`, `defaultSort`) MUST be `.optional()` in the schema. Required-ness is enforced per-action in the switch case, not in the schema definition. This is the established pattern (see how `query` is optional globally but required for `search` action).
**Warning signs:** Existing tool calls start failing with validation errors.

## Code Examples

### Example 1: Preference Handler Implementation

```typescript
// apps/mcp/src/tools/preferences.ts
import { getTenantId } from "../auth.js";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
} from "@everyskill/db/services/user-preferences";
import type { UserPreferencesData } from "@everyskill/db/schema/user-preferences";
import { trackUsage } from "../tracking/events.js";

function authRequired() {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error: "Authentication required",
        message: "Set EVERYSKILL_API_KEY to read/write preferences",
      }),
    }],
    isError: true,
  };
}

export async function handleGetPreferences({ userId }: { userId?: string }) {
  if (!userId) return authRequired();
  const tenantId = getTenantId();
  if (!tenantId) return authRequired();

  const prefs = await getOrCreateUserPreferences(userId, tenantId);

  await trackUsage({
    toolName: "get_preferences",
    userId,
    metadata: {},
  });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        preferredCategories: prefs?.preferredCategories ?? [],
        defaultSort: prefs?.defaultSort ?? "days_saved",
      }, null, 2),
    }],
  };
}

export async function handleSetPreferences({
  userId,
  preferredCategories,
  defaultSort,
}: {
  userId?: string;
  preferredCategories?: string[];
  defaultSort?: string;
}) {
  if (!userId) return authRequired();
  const tenantId = getTenantId();
  if (!tenantId) return authRequired();

  // Read-modify-write to preserve fields not exposed via MCP
  const current = await getOrCreateUserPreferences(userId, tenantId);
  if (!current) return authRequired();

  const updated: UserPreferencesData = {
    ...current,
    ...(preferredCategories !== undefined && { preferredCategories: preferredCategories as UserPreferencesData["preferredCategories"] }),
    ...(defaultSort !== undefined && { defaultSort: defaultSort as UserPreferencesData["defaultSort"] }),
  };

  await updateUserPreferences(userId, updated);

  await trackUsage({
    toolName: "set_preferences",
    userId,
    metadata: { preferredCategories: updated.preferredCategories, defaultSort: updated.defaultSort },
  });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        success: true,
        preferences: {
          preferredCategories: updated.preferredCategories,
          defaultSort: updated.defaultSort,
        },
      }, null, 2),
    }],
  };
}
```

### Example 2: Search Boost Integration

```typescript
// Modification to apps/mcp/src/tools/search.ts
import { getOrCreateUserPreferences } from "@everyskill/db/services/user-preferences";
import { getTenantId } from "../auth.js";

const PREFERENCE_BOOST = 1.3;

export async function handleSearchSkills({ query, category, limit, userId, skipNudge }) {
  const tenantId = getTenantId();
  const results = await searchSkillsByQuery({
    query, category, limit,
    tenantId: tenantId ?? undefined,
    userId,
  });

  // Apply preference boost for authenticated users
  let boostedResults = results;
  if (userId && tenantId) {
    try {
      const prefs = await getOrCreateUserPreferences(userId, tenantId);
      const preferred = prefs?.preferredCategories ?? [];
      if (preferred.length > 0) {
        boostedResults = results.map((r) => ({
          ...r,
          isBoosted: preferred.includes(r.category),
        }));
        // Stable sort: boosted items move up within same-score tier
        boostedResults.sort((a, b) => {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return 0; // preserve original relevance order
        });
      }
    } catch {
      // Preference lookup failed -- no boost, continue with original order
    }
  }

  // ... rest of existing handler (tracking, nudge, formatting) ...
}
```

### Example 3: Action Schema Updates in everyskill.ts

```typescript
// Add to ACTIONS array:
const ACTIONS = [
  "search", "list", "recommend", "describe", "install", "guide",
  "create", "update", "review", "submit_review", "check_review",
  "check_status", "feedback",
  "get_preferences",    // NEW
  "set_preferences",    // NEW
] as const;

// Add to EverySkillInputSchema:
preferredCategories: z.array(
  z.enum(["productivity", "wiring", "doc-production", "data-viz", "code"])
).optional().describe("Preferred skill categories (used by: set_preferences)"),
defaultSort: z.enum(["uses", "quality", "rating", "days_saved"])
  .optional().describe("Default sort order (used by: set_preferences)"),

// Add to EverySkillArgs type:
preferredCategories?: ("productivity" | "wiring" | "doc-production" | "data-viz" | "code")[];
defaultSort?: "uses" | "quality" | "rating" | "days_saved";

// Add switch cases:
case "get_preferences": {
  return handleGetPreferences({ userId });
}
case "set_preferences": {
  return handleSetPreferences({
    userId,
    preferredCategories: args.preferredCategories,
    defaultSort: args.defaultSort,
  });
}
```

### Example 4: Vitest Tests for New Actions

```typescript
// Pattern: Mock auth + DB service, call route function, verify output
describe("get_preferences action", () => {
  it("returns error when not authenticated", async () => {
    const result = await routeEveryskillAction({ action: "get_preferences" });
    const data = JSON.parse(result.content[0].text);
    expect(result.isError).toBe(true);
    expect(data.error).toBe("Authentication required");
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Individual legacy tools | Unified `everyskill` tool with action discriminator | Phase ~62 | All new actions MUST go through unified tool |
| `server.tool()` | `server.registerTool()` | MCP SDK 1.26.0 | Old `.tool()` is deprecated |
| 2 visibility levels | 4 visibility levels (Phase 69) | 2026-02-16 | Visibility filter already updated centrally |

**Deprecated/outdated:**
- Legacy standalone tools (`search_skills`, `list_skills`, etc.) -- still registered for backward compat but deprecated
- `server.tool()` API -- replaced by `server.registerTool()` in SDK 1.26.0

## Open Questions

1. **Should `set_preferences` be able to set `claudeMdWorkflowNotes` and `trainingDataConsent`?**
   - What we know: These fields exist in the JSONB but are web-UI-specific (workflow notes for CLAUDE.md export, consent for training data capture)
   - What's unclear: Whether MCP users would want to set these via CLI
   - Recommendation: Exclude from Phase 70 scope. Only expose `preferredCategories` and `defaultSort` -- the two fields that affect search behavior (VIS-06/VIS-07 requirements). Can add later if needed.

2. **How should the preference boost work for ILIKE text search results?**
   - What we know: Web discover uses RRF scores (0-1 range) with a 1.3x multiplier. MCP text search (`searchSkillsByQuery`) returns results ordered by a field-weighted score but doesn't expose that score in the result set.
   - What's unclear: Whether a simple "promote boosted items" reranking is sufficient, or if a numeric score boost is needed.
   - Recommendation: Use stable reranking -- boosted results move up within their relevance tier. This is simpler and avoids needing to expose internal scores. The web already has the same effective behavior (boosted items rank higher among similarly-scored results). For MCP recommend (semantic search), the similarity score IS exposed, so a numeric boost can be applied there.

3. **Should `defaultSort` affect MCP list/search result ordering?**
   - What we know: `defaultSort` in the web UI controls how the browse/skill-list page orders results. MCP `search` always uses relevance scoring, and `list` currently orders by the SQL default.
   - What's unclear: Whether MCP `list` action should respect the user's `defaultSort` preference.
   - Recommendation: YES -- wire `defaultSort` into the `handleListSkills` handler for authenticated users. This provides the most natural bidirectional sync. When unauthenticated, keep current behavior.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** (direct file reads):
  - `packages/db/src/schema/user-preferences.ts` -- schema definition, `UserPreferencesData` interface
  - `packages/db/src/services/user-preferences.ts` -- `getOrCreateUserPreferences()`, `updateUserPreferences()`
  - `apps/mcp/src/auth.ts` -- `getUserId()`, `getTenantId()`, `resolveUserId()`
  - `apps/mcp/src/tools/everyskill.ts` -- unified tool pattern, `ACTIONS`, `EverySkillInputSchema`, `routeEveryskillAction()`
  - `apps/mcp/src/tools/search.ts` -- `handleSearchSkills()`
  - `apps/mcp/src/tools/recommend.ts` -- `handleRecommendSkills()`
  - `apps/web/app/actions/discover.ts` -- `PREFERENCE_BOOST`, `applyPreferenceBoost()`
  - `apps/web/lib/preferences-defaults.ts` -- Zod schema, `SKILL_CATEGORIES`, `SORT_OPTIONS`
  - `apps/web/app/actions/user-preferences.ts` -- web server actions for preferences
  - `packages/db/src/services/search-skills.ts` -- `searchSkillsByQuery()`
  - `packages/db/src/services/hybrid-search.ts` -- hybrid/keyword search with RRF
  - `packages/db/src/lib/visibility.ts` -- visibility filter helpers

- **MCP SDK 1.26.0** (`@modelcontextprotocol/sdk`) -- `registerTool()` API, type definitions

### Secondary (MEDIUM confidence)
- Phase 43 (user preferences) and Phase 45 (hybrid search) planning docs -- established patterns

### Tertiary (LOW confidence)
- None -- all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all pieces exist
- Architecture: HIGH -- follows exact established patterns (unified tool, DB services, auth guard)
- Pitfalls: HIGH -- identified from direct codebase analysis of existing patterns

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- internal code patterns)
