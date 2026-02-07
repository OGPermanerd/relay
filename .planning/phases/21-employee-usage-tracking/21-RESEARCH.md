# Phase 21: Employee Usage Tracking - Research

**Researched:** 2026-02-05
**Domain:** MCP tool attribution, install callback analytics, personal usage dashboard
**Confidence:** HIGH

## Summary

Phase 21 takes the API key infrastructure built in Phase 20 and activates it: every MCP tool call gets attributed to the employee who made it, install scripts phone home on success, and a new "My Skill Leverage" tab on the home page surfaces personal usage data.

The codebase is already 90% ready. The `usage_events` table has a `userId` column that is never populated. The `trackUsage()` function accepts `userId` in its event type but no caller passes it. The `validateApiKey()` DB service returns `{ userId, keyId }` and is already imported by the MCP package. The install scripts exist but have no callback step. The home page has stat cards and layout patterns to follow.

The main work is: (1) read `EVERYSKILL_API_KEY` env var in the MCP server at startup, resolve it to a userId via DB service, pass userId into every `trackUsage()` call; (2) create an install callback API route + update install scripts; (3) build aggregation queries for the "My Skill Leverage" view; (4) add a tab UI to the home page with Skills Used and Skills Created sections.

**Primary recommendation:** Wire userId through MCP tools first (smallest change, immediate data collection), then build the install callback and UI in parallel.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.38.0 | SQL queries for usage aggregation | Already used everywhere; raw SQL via `db.execute(sql\`...\`)` for complex aggregations |
| nuqs | 2.8.7 | URL state for tab switching | Already used for 8+ filter components; NuqsAdapter already in providers.tsx |
| next-auth | 5.0.0-beta.30 | Session for userId on My Leverage page | Already used; `auth()` call in home page server component |
| zod | ^3.25.0 | Request validation for install callback | Already used in server actions and MCP tools |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | ^1.25.0 | MCP server in apps/mcp | Tool handlers already registered |
| react-sparklines | ^1.7.0 | Sparkline charts in StatCard | StatCard already supports trendData prop |

### No New Dependencies Needed

All required functionality can be built with the existing stack. No new packages required.

## Architecture Patterns

### Recommended Project Structure (New/Modified Files)

```
apps/mcp/src/
├── auth.ts                          # NEW: Read EVERYSKILL_API_KEY, resolve userId via DB service
├── index.ts                         # MODIFY: Call resolveUserId() on startup
├── tools/
│   ├── search.ts                    # MODIFY: Pass userId to trackUsage()
│   ├── list.ts                      # MODIFY: Pass userId to trackUsage()
│   └── deploy.ts                    # MODIFY: Pass userId to trackUsage()
└── tracking/
    └── events.ts                    # No change needed (already accepts userId)

packages/db/src/
├── schema/
│   └── usage-events.ts              # No change needed (userId column exists)
└── services/
    └── usage-analytics.ts           # NEW: Aggregation queries for My Leverage

apps/web/
├── app/
│   ├── (protected)/
│   │   └── page.tsx                 # MODIFY: Add tab UI with My Leverage
│   └── api/
│       └── install-callback/
│           └── route.ts             # NEW: POST handler for install callbacks
├── lib/
│   ├── my-leverage.ts               # NEW: Data fetching for Skills Used/Created
│   └── install-script.ts            # MODIFY: Add curl/Invoke-WebRequest callback
├── components/
│   ├── home-tabs.tsx                # NEW: Tab toggle (Browse Skills / My Leverage)
│   ├── my-leverage-view.tsx         # NEW: Skills Used + Skills Created sections
│   ├── usage-timeline.tsx           # NEW: Timeline entries with Load More
│   └── leverage-stat-cards.tsx      # NEW: Summary stat cards for each section
└── middleware.ts                    # MODIFY: Exempt /api/install-callback from auth
```

### Pattern 1: MCP userId Resolution (Direct DB Import)

**What:** The MCP server reads `EVERYSKILL_API_KEY` from env, calls `validateApiKey()` directly (no HTTP), caches userId for the session lifetime.
**When to use:** On MCP server startup, before any tool calls.
**Why direct import:** The MCP server already imports `@everyskill/db` (see `apps/mcp/src/tracking/events.ts`). No HTTP overhead needed.

```typescript
// apps/mcp/src/auth.ts
import { validateApiKey } from "@everyskill/db/services/api-keys";

let cachedUserId: string | null = null;
let resolved = false;

export async function resolveUserId(): Promise<string | null> {
  if (resolved) return cachedUserId;
  resolved = true;

  const apiKey = process.env.EVERYSKILL_API_KEY;
  if (!apiKey) {
    console.error("No EVERYSKILL_API_KEY set — tracking anonymously");
    return null;
  }

  const result = await validateApiKey(apiKey);
  if (result) {
    cachedUserId = result.userId;
    console.error(`Authenticated as userId: ${result.userId}`);
  } else {
    console.error("EVERYSKILL_API_KEY invalid or expired — tracking anonymously");
  }
  return cachedUserId;
}

export function getUserId(): string | null {
  return cachedUserId;
}
```

**Key detail:** Use `console.error` (not `console.log`) because stdout is the MCP stdio protocol. This pattern is already established in `apps/mcp/src/index.ts`.

### Pattern 2: Passing userId into trackUsage() Calls

**What:** Each tool handler calls `getUserId()` and includes it in the trackUsage event.
**When to use:** Every tool handler (search, list, deploy).

```typescript
// In each tool handler (e.g., search.ts)
import { getUserId } from "../auth.js";

// Inside handler, before or after the existing trackUsage call:
await trackUsage({
  toolName: "search_skills",
  userId: getUserId(),  // null if anonymous, string if authenticated
  metadata: { query, category, resultCount: results.length },
});
```

**No changes needed to trackUsage()** -- it already accepts the full `NewUsageEvent` type which includes optional `userId`.

### Pattern 3: Install Callback API Route (Same as validate-key)

**What:** POST endpoint that validates an API key from the request body, then records the install event via trackUsage().
**When to use:** Called by install scripts after successful MCP config setup.

```typescript
// apps/web/app/api/install-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { db } from "@everyskill/db";
import { usageEvents } from "@everyskill/db/schema";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, skillId, platform, os, clientVersion } = body as Record<string, unknown>;

  // Validate API key (optional — anonymous installs still tracked)
  let userId: string | null = null;
  if (key && typeof key === "string") {
    const result = await validateApiKey(key);
    if (result) userId = result.userId;
  }

  if (!db) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  await db.insert(usageEvents).values({
    toolName: "install_confirmed",
    skillId: typeof skillId === "string" ? skillId : null,
    userId,
    metadata: {
      platform: typeof platform === "string" ? platform : "unknown",
      os: typeof os === "string" ? os : "unknown",
      clientVersion: typeof clientVersion === "string" ? clientVersion : null,
      source: "install-script",
    },
  });

  return NextResponse.json({ ok: true });
}
```

**Decision note:** The CONTEXT says to use `trackUsage()` internally, but since the install-callback route runs in the Next.js web app (not the MCP server), it should insert directly into `usageEvents` rather than importing from `apps/mcp`. The `trackUsage()` in the MCP app also calls `incrementSkillUses()` which is appropriate for install events too.

**Better approach:** Create a shared `trackUsage` in `packages/db/src/services/` that both MCP and web can use, or simply do a direct insert + `incrementSkillUses()` call in the route handler. The simplest correct approach: replicate the two-step pattern (insert + increment) in the route handler.

### Pattern 4: Middleware Exemption for Install Callback

**What:** The install callback must be accessible without an Auth.js session.
**When to use:** Middleware update.

```typescript
// apps/web/middleware.ts - add this check alongside isAuthApi
const isInstallCallback = req.nextUrl.pathname.startsWith("/api/install-callback");

// Allow auth API routes, dev login, and install callback
if (isAuthApi || isDevLogin || isInstallCallback) {
  return;
}
```

### Pattern 5: Tab UI with nuqs (URL State)

**What:** Toggle between "Browse Skills" and "My Leverage" on the home page using URL state.
**When to use:** Home page tab component.

**Recommendation: Use nuqs** (not local state). The project already uses nuqs for 8+ components. URL state means:
- Tabs are bookmarkable/shareable
- Browser back button works
- Consistent with existing patterns

```typescript
// apps/web/components/home-tabs.tsx
"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";

const TABS = ["browse", "leverage"] as const;
type Tab = typeof TABS[number];

export function HomeTabs({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useQueryState(
    "view",
    parseAsStringLiteral(TABS).withDefault("browse")
  );

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "browse"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("browse")}
        >
          Browse Skills
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            tab === "leverage"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setTab("leverage")}
        >
          My Leverage
        </button>
      </div>
      {children}
    </div>
  );
}
```

### Pattern 6: Usage Aggregation Queries (SQL CTEs)

**What:** Complex aggregation queries using raw SQL via Drizzle's `db.execute(sql\`...\`)`.
**When to use:** "Skills Used" and "Skills Created" data fetching.
**Precedent:** `leaderboard.ts` and `trending.ts` both use this exact pattern with CTEs and window functions.

```typescript
// apps/web/lib/my-leverage.ts
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

export async function getSkillsUsed(userId: string, limit = 20, offset = 0) {
  if (!db) return { items: [], total: 0 };

  const results = await db.execute(sql`
    SELECT
      ue.skill_id,
      s.name as skill_name,
      s.category,
      ue.tool_name as action,
      ue.created_at as timestamp,
      COALESCE(s.hours_saved, 1) as hours_saved,
      COUNT(*) OVER() as total_count
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    WHERE ue.user_id = ${userId}
    ORDER BY ue.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // ... map results
}

export async function getSkillsUsedStats(userId: string) {
  if (!db) return null;

  const results = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ue.skill_id) as total_skills,
      COUNT(*) as total_uses,
      COALESCE(SUM(COALESCE(s.hours_saved, 1)), 0) as total_hours_saved,
      (
        SELECT s2.name FROM usage_events ue2
        JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.user_id = ${userId}
        GROUP BY s2.name
        ORDER BY COUNT(*) DESC LIMIT 1
      ) as most_used_skill
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    WHERE ue.user_id = ${userId}
  `);

  // ... map results
}
```

### Pattern 7: Anonymous Nudge Counter

**What:** Count anonymous uses and append a nudge message every 5th use.
**Recommendation:** Use server-side metadata in the usage event. Track anonymous calls with a session-scoped counter in the MCP auth module.

```typescript
// apps/mcp/src/auth.ts
let anonymousCallCount = 0;

export function incrementAnonymousCount(): number {
  return ++anonymousCallCount;
}

export function shouldNudge(): boolean {
  return cachedUserId === null && anonymousCallCount > 0 && anonymousCallCount % 5 === 0;
}
```

Then in each tool handler, after building the response:
```typescript
if (shouldNudge()) {
  // Append nudge text to the last content item
  content.push({
    type: "text" as const,
    text: "\n---\nTip: Set up a Relay API key to track your personal skill leverage. Visit your profile page to generate one.",
  });
}
```

### Anti-Patterns to Avoid

- **HTTP call from MCP to validate key:** The MCP server already has `@everyskill/db` as a dependency and DATABASE_URL in env. Calling an HTTP endpoint adds latency and a failure mode. Import `validateApiKey` directly.
- **Separate install_events table:** The CONTEXT decision says install callbacks use `trackUsage()` and record into `usage_events`. Do NOT create a separate table. Use `toolName: "install_confirmed"` with platform/OS in metadata.
- **Fetching all usage events client-side:** Use server-side aggregation with SQL. The home page is a Server Component. Fetch data server-side, render HTML.
- **Breaking anonymous users:** Never add required auth. The `getUserId()` function returns null for anonymous users, and all existing code paths continue working.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL-synced tab state | Custom URL parsing + pushState | nuqs `useQueryState` with `parseAsStringLiteral` | Already in project, handles Next.js App Router edge cases |
| Usage event aggregation | In-memory JS reduce over raw events | PostgreSQL CTEs via `db.execute(sql\`...\`)` | Database handles millions of rows; JS would OOM |
| API key validation | Custom hash comparison | `validateApiKey()` from `@everyskill/db/services/api-keys` | Already handles timing-safe comparison, expiry, revocation |
| Stat cards | Custom card components | Existing `StatCard` component | Already supports sparklines, icons, suffixes |
| Pagination | Custom offset tracking | SQL `LIMIT/OFFSET` with `COUNT(*) OVER()` | Window function gives total count in same query |

## Common Pitfalls

### Pitfall 1: console.log in MCP Server Corrupts stdio Protocol
**What goes wrong:** Any `console.log` in the MCP server writes to stdout, which is the stdio transport. This breaks the MCP protocol.
**Why it happens:** Developers instinctively use console.log for debugging.
**How to avoid:** Use `console.error` for all logging in `apps/mcp/`. The existing `index.ts` already documents this: `"CRITICAL: Use console.error, never console.log (corrupts stdio protocol)"`.
**Warning signs:** MCP tool calls fail with JSON parse errors.

### Pitfall 2: Blocking MCP Startup on API Key Validation
**What goes wrong:** If the DB is slow or unreachable, the MCP server hangs on startup and Claude Desktop shows "server not responding."
**Why it happens:** Making `resolveUserId()` synchronously block the stdio transport connection.
**How to avoid:** Resolve the userId lazily (on first tool call) or in parallel with the transport connection. The key insight: the `resolved` flag pattern above ensures validation happens at most once, and if it fails, the server continues anonymously.
**Warning signs:** MCP server takes >5 seconds to start.

### Pitfall 3: Double-Counting Install Events
**What goes wrong:** Users run the install script multiple times (debugging, reconfiguring). Each run sends a callback, inflating install counts.
**Why it happens:** No deduplication.
**How to avoid:** Consider deduplicating by `(userId, skillId, platform)` per day in the aggregation queries, not at insert time. Insert all events (they have diagnostic value) but deduplicate when counting for the dashboard.
**Warning signs:** Install count >> active user count.

### Pitfall 4: FTE Hours Calculation Inconsistency
**What goes wrong:** The same metric shows different values on different pages because of inconsistent calculation.
**Why it happens:** `skills.hoursSaved` (per use, set by creator) vs `ratings.hoursSavedEstimate` (per review, set by user). The CONTEXT says: "use the employee's own review estimate when available, fall back to creator's timeSavedMinutes."
**How to avoid:** Create a single SQL expression or function that implements the fallback logic: `COALESCE(user_rating.hours_saved_estimate, s.hours_saved, 1)`. Use it consistently in all queries.
**Warning signs:** FTE numbers don't match between summary cards and timeline entries.

### Pitfall 5: Home Page Server Component with Client Tab State
**What goes wrong:** The home page is a server component (`async function HomePage()`). Adding nuqs tabs requires client-side interactivity, but the data fetching must stay server-side.
**Why it happens:** Mixing Server Components and Client Components incorrectly.
**How to avoid:** Split the page into:
  1. Server Component (page.tsx): Fetches ALL data (browse skills + my leverage) in parallel
  2. Client Component (home-tabs.tsx): Receives both datasets as props, shows/hides based on tab state

  This is the same pattern used throughout the app (server fetches, client renders).
**Warning signs:** "Cannot use hooks in a Server Component" error.

### Pitfall 6: Install Callback URL Not Exempt from Auth Middleware
**What goes wrong:** Install scripts get 302 redirected to /login when calling the callback endpoint.
**Why it happens:** Middleware requires Auth.js session for all non-exempted routes.
**How to avoid:** Add `/api/install-callback` to the middleware exemption list alongside `/api/auth` and `/api/dev-login`.
**Warning signs:** Install callback returns HTML (login page) instead of JSON.

## Code Examples

### Install Script Callback Addition (Bash)

```bash
# Add to end of existing install-everyskill-mcp.sh, before success messages
# Phone home (non-blocking, failure OK)
curl -s -X POST "${RELAY_URL}/api/install-callback" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"${EVERYSKILL_API_KEY}\",\"platform\":\"claude-desktop\",\"os\":\"$(uname -s | tr '[:upper:]' '[:lower:]')\"}" \
  > /dev/null 2>&1 || true
```

### Install Script Callback Addition (PowerShell)

```powershell
# Phone home (non-blocking, failure OK)
try {
  $CallbackBody = @{
    key = $env:EVERYSKILL_API_KEY
    platform = "claude-desktop"
    os = "windows"
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$env:RELAY_URL/api/install-callback" `
    -Method POST -ContentType "application/json" `
    -Body $CallbackBody -UseBasicParsing | Out-Null
} catch { }
```

### Skills Created Stats Query

```sql
-- For "Skills Created" section: impact of skills authored by this user
SELECT
  s.id,
  s.name,
  s.category,
  s.total_uses,
  COALESCE(s.hours_saved, 1) as hours_per_use,
  s.total_uses * COALESCE(s.hours_saved, 1) as total_hours_saved,
  COUNT(DISTINCT ue.user_id) as unique_users,
  COALESCE(s.average_rating / 100.0, 0) as avg_rating
FROM skills s
LEFT JOIN usage_events ue ON ue.skill_id = s.id
WHERE s.author_id = $userId
  AND s.published_version_id IS NOT NULL
GROUP BY s.id
ORDER BY total_hours_saved DESC
```

### First-Auth Confirmation Message

```typescript
// In MCP auth module, track whether first-use confirmation was shown
let firstAuthShown = false;

export function getFirstAuthMessage(userEmail: string): string | null {
  if (cachedUserId && !firstAuthShown) {
    firstAuthShown = true;
    return `Tracking active for ${userEmail}`;
  }
  return null;
}
```

Note: The CONTEXT says to show this on "first authenticated use." This requires knowing the user's email, which `validateApiKey()` does not return. Two options:
1. Add `userName` and `userEmail` to the validateApiKey return (requires modifying the DB service to join users)
2. Do a separate query after validation

**Recommendation:** Extend `validateApiKey()` to optionally return user name/email, or create a companion `getUserInfo()` function. This is a small change to the existing service.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anonymous-only MCP tracking | API key-based userId attribution | Phase 20 (just completed) | usage_events.userId can now be populated |
| No install tracking | Phone-home callback from scripts | This phase | Enables install vs deploy distinction |
| Platform stats only (home page) | Personal "My Leverage" view | This phase | Employees see their own impact |

**The key architectural insight:** No new tables needed. The existing `usage_events` table with its `userId`, `toolName`, `skillId`, and `metadata` columns handles all tracking needs:
- MCP tool calls: `toolName = "search_skills" | "list_skills" | "deploy_skill"`
- Install confirmations: `toolName = "install_confirmed"` with metadata `{ platform, os }`
- Deploy intent vs confirmed install: `toolName = "deploy_skill"` vs `toolName = "install_confirmed"`

## Recommended Stat Cards

### Skills Used Section (3-4 cards)
| Stat | Calculation | Icon Suggestion |
|------|-------------|-----------------|
| Skills Used | `COUNT(DISTINCT skill_id)` where userId matches | Grid/puzzle icon |
| FTE Hours Saved | `SUM(hours_saved)` with rating fallback | Clock icon (reuse existing) |
| Total Actions | `COUNT(*)` of all usage events for this user | Play/activity icon |
| Most Used Skill | Skill name with highest COUNT for this user | Star/trophy icon |

### Skills Created Section (3-4 cards)
| Stat | Calculation | Icon Suggestion |
|------|-------------|-----------------|
| Skills Published | `COUNT(*)` of published skills by author | Document/upload icon |
| Hours Saved (Others) | `SUM(total_uses * hours_saved)` across authored skills | Clock icon |
| Unique Users | `COUNT(DISTINCT user_id)` from usage_events on authored skills | Users icon (reuse existing) |
| Avg Rating | `AVG(average_rating / 100)` across authored skills | Star icon |

### Timeline Pagination
**Recommended batch size:** 20 items per page. This balances:
- Network payload size (~2KB per entry with full metadata)
- Visual density (fits ~10 items in viewport, scroll reveals more)
- Database query efficiency (OFFSET pagination is fine for personal data volumes)

## Open Questions

1. **RELAY_URL for install scripts**
   - What we know: Install scripts need to know the Relay server URL to POST the callback
   - What's unclear: Should this be hardcoded in the generated script, or read from an env var?
   - Recommendation: The `generateInstallScript()` function should accept a `baseUrl` parameter and embed it in the script. The web app knows its own URL from `process.env.NEXTAUTH_URL` or similar.

2. **User email for first-auth confirmation**
   - What we know: The CONTEXT says show "Tracking active for name@company.com" on first authenticated use
   - What's unclear: `validateApiKey()` only returns `{ userId, keyId }`, not email
   - Recommendation: Add a join to users table in `validateApiKey()` or create a lightweight `getUserEmailById()` function. Small scope change.

3. **Install script modifications scope**
   - What we know: The CONTEXT says install scripts should POST to `/api/install-callback`
   - What's unclear: Install scripts are downloaded and run on the user's machine. They currently don't have `EVERYSKILL_API_KEY` or `RELAY_URL` available because these env vars are only set in the MCP config, not during script execution.
   - Recommendation: The install script itself sets up the env vars in the MCP config. The callback should happen AFTER the config is written, reading the just-configured values. Or, the script should receive the API key and URL as parameters from the download page.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `apps/mcp/src/tracking/events.ts` -- trackUsage() signature and implementation
- Direct codebase analysis: `packages/db/src/schema/usage-events.ts` -- schema with nullable userId
- Direct codebase analysis: `packages/db/src/services/api-keys.ts` -- validateApiKey() returns { userId, keyId }
- Direct codebase analysis: `apps/web/app/api/auth/validate-key/route.ts` -- API route pattern to replicate
- Direct codebase analysis: `apps/web/middleware.ts` -- auth exemption pattern
- Direct codebase analysis: `apps/web/app/(protected)/page.tsx` -- home page structure
- Direct codebase analysis: `apps/web/lib/leaderboard.ts` -- SQL CTE aggregation pattern
- Direct codebase analysis: `apps/web/lib/platform-stats.ts` -- parallel query pattern
- Direct codebase analysis: `apps/web/components/stat-card.tsx` -- reusable stat card with sparkline
- Direct codebase analysis: `apps/web/components/providers.tsx` -- NuqsAdapter already configured
- Direct codebase analysis: nuqs v2.8.7 installed, used in 8+ components

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` lines 520-630 -- architectural patterns for userId wiring and install callbacks
- `.planning/research/STACK.md` lines 120-170 -- MCP auth resolution strategy
- `.planning/research/FEATURES.md` -- install callback phone-home patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; everything uses existing libraries
- Architecture: HIGH -- All patterns verified against actual codebase; clear precedents exist
- MCP userId wiring: HIGH -- trackUsage() type already accepts userId; validateApiKey() already in MCP dependency tree
- Install callback: HIGH -- Follows exact same pattern as validate-key route
- My Leverage UI: HIGH -- StatCard, nuqs tabs, SQL CTEs all have direct precedents in codebase
- FTE calculation: MEDIUM -- Fallback logic (rating estimate vs creator estimate) needs careful query design
- Install script modifications: MEDIUM -- Script env var availability needs validation during implementation

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- stable domain, no external API dependencies)
