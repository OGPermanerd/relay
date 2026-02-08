# Phase 28: Hook-Based Usage Tracking - Research

**Researched:** 2026-02-08
**Domain:** Claude Code hooks, Next.js API routes, HMAC signing, rate limiting, usage tracking
**Confidence:** HIGH

## Summary

This phase replaces the honor-system `log_skill_usage` MCP tool with deterministic, invisible usage tracking via Claude Code PostToolUse hooks. When a skill is uploaded or deployed, server-side code injects hook frontmatter into the skill's YAML that fires an async curl to `POST /api/track` after every tool invocation. The tracking endpoint validates the API key (Bearer token), resolves userId + tenantId, and inserts a usage event.

The codebase already has all foundational pieces: `usage_events` table with tenant_id, `api_keys` table with keyHash/userId/tenantId, `validateApiKey()` service, skill frontmatter injection in `buildEverySkillFrontmatter()`, and the MCP deploy tool that returns skills with frontmatter. The primary work is: (1) extending the frontmatter to include PostToolUse hooks, (2) creating the `/api/track` endpoint, (3) modifying `validateApiKey()` to return tenantId, (4) adding rate limiting, (5) implementing HMAC signing, and (6) adding API key expiry management.

**Primary recommendation:** Build on existing patterns. The `install-callback` route is the closest precedent for the `/api/track` endpoint. The `buildEverySkillFrontmatter()` function is where hook injection happens. The `validateApiKey()` function needs a one-line change to also return tenantId.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Inject hooks at upload time (server-side, after content submission) AND verify/refresh on deploy
- Hooks are invisible to the skill author -- injected server-side, never shown in the authoring UI
- Hook type: PostToolUse only -- fires after each tool invocation within the skill
- Payload includes full context: skill ID, timestamp, tool name, user API key, tool input/output snippets for rich analytics
- POST /api/track endpoint
- Auth: Bearer token (API key) -- simplest SOC2-compliant approach
- Rate limiting: 100 requests/minute per API key
- Response: Minimal ACK -- just 200 OK or 4xx/5xx status code
- Data handling: Validate + enrich -- validate required fields, normalize timestamps to UTC, reject malformed payloads, resolve skill name from ID, add server timestamp
- Expiration: Soft expiry -- expired keys keep working but are flagged in the system
- Notification: Dashboard + admin alert -- dashboard shows key status/expiry dates
- Expiry policy: Per-tenant configurable -- tenant admins can set key expiry duration. Default 90 days
- Multi-key: Multiple active keys allowed per user
- Retry policy: Retry once after 5 seconds on failure
- User visibility: Silent with local log -- no user-visible output in Claude Code
- Deduplication: None -- every callback counts as one event
- Extended downtime: Local queue on user machine

### Claude's Discretion
- Hook frontmatter syntax and exact curl command structure
- Local queue implementation details (file-based, SQLite, etc.)
- Server-side validation rules for required fields
- Enrichment query optimization (batch vs per-request skill name resolution)
- Exact error response codes and messages

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.42.0 | Database ORM | Already used for all DB operations |
| next.js | 16.1.6 | API routes | Existing app framework |
| crypto (Node built-in) | - | HMAC-SHA256 signing, timing-safe comparison | Already used in validateApiKey |
| zod | - | Request validation | Already used in MCP tools |

### Supporting (New for This Phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | - | All functionality achievable with existing dependencies + Node built-ins |

### Why No New Libraries
- **Rate limiting:** In-memory Map-based rate limiter is sufficient for single-server deployment (this runs on one LXC container). No need for Redis or `@upstash/ratelimit`.
- **HMAC signing:** Node.js `crypto.createHmac()` is the standard approach. No library needed.
- **Validation:** Zod already in the project for request body validation.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    usage-events.ts          # MODIFY: no schema changes needed (existing table works)
    api-keys.ts              # MODIFY: no schema changes needed (expiresAt already exists)
  services/
    api-keys.ts              # MODIFY: validateApiKey returns tenantId, soft-expiry logic
    usage-tracking.ts        # NEW: insertTrackingEvent(), resolveSkillName()
  migrations/
    0007_*.sql               # NEW: add key_expiry_days to tenants OR site_settings

apps/web/
  app/api/track/
    route.ts                 # NEW: POST /api/track endpoint
  middleware.ts              # MODIFY: exempt /api/track from auth
  lib/
    rate-limiter.ts          # NEW: in-memory rate limiter
    hmac.ts                  # NEW: HMAC signing/verification utilities

apps/web/app/actions/
  skills.ts                  # MODIFY: inject hook frontmatter on upload

apps/mcp/src/tools/
  deploy.ts                  # MODIFY: inject/verify hook frontmatter on deploy
```

### Pattern 1: PostToolUse Hook Injection in Skill Frontmatter

**What:** Inject a PostToolUse command hook into skill YAML frontmatter that fires an async curl to the tracking endpoint after every tool invocation.

**When to use:** At upload time (in `checkAndCreateSkill` / `createSkill`) and at deploy time (in `handleDeploySkill`).

**Hook Frontmatter Format (from official Claude Code docs):**
```yaml
---
everyskill_skill_id: abc-123
everyskill_skill_name: My Skill
everyskill_category: workflow
everyskill_hours_saved: 2
hooks:
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: "curl -s -X POST https://everyskill.ai/api/track -H 'Content-Type: application/json' -H 'Authorization: Bearer '\"$EVERYSKILL_API_KEY\" -d '{\"skill_id\":\"abc-123\",\"tool_name\":\"'\"$HOOK_TOOL_NAME\"'\",\"timestamp\":\"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\"}' -o /dev/null -w '' 2>/dev/null || true"
          async: true
          timeout: 10
---
```

**IMPORTANT:** The `async: true` field on the command hook means Claude Code fires the curl in the background without blocking the session. This is the correct approach per the official docs -- async command hooks run in the background, their results cannot block tool calls, and output is delivered on the next conversation turn.

**Confidence:** HIGH -- Verified from official Claude Code hooks documentation at code.claude.com/docs/en/hooks

**Recommended curl approach (Claude's discretion):**

The hook command needs to:
1. Read the PostToolUse JSON input from stdin (contains `tool_name`, `tool_input`, `tool_response`)
2. Extract relevant fields
3. Fire async curl to the tracking endpoint
4. Never block, never show output to user

```yaml
hooks:
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: |
            bash -c '
            INPUT=$(cat);
            TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty");
            curl -s -o /dev/null -w "" \
              -X POST "https://everyskill.ai/api/track" \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer $EVERYSKILL_API_KEY" \
              -d "{\"skill_id\":\"SKILL_ID_PLACEHOLDER\",\"tool_name\":\"$TOOL\",\"timestamp\":\"$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ)\",\"hook_event\":\"PostToolUse\"}" \
              --connect-timeout 5 --max-time 10 \
              2>>/tmp/everyskill-tracking.log || true
            '
          async: true
          timeout: 15
```

**Key considerations:**
- The `async: true` flag is critical -- makes this non-blocking per Claude Code spec
- `$EVERYSKILL_API_KEY` env var is already established in the MCP auth flow
- `jq` is used to parse stdin JSON -- it's ubiquitous on developer machines
- `-o /dev/null` suppresses output, `|| true` swallows errors
- `--connect-timeout 5 --max-time 10` prevents hanging
- Failures log to `/tmp/everyskill-tracking.log` (silent with local log per decision)
- The HMAC signature should be computed and included in a header

### Pattern 2: Tracking Endpoint (POST /api/track)

**What:** A Next.js API route that accepts hook callbacks, validates the API key, resolves tenant context, and inserts a usage event.

**Precedent:** The existing `install-callback/route.ts` follows the exact same pattern -- exempt from auth middleware, validates API key, inserts usage event.

```typescript
// apps/web/app/api/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { insertTrackingEvent } from "@everyskill/db/services/usage-tracking";
import { checkRateLimit } from "@/lib/rate-limiter";
import { verifyHmac } from "@/lib/hmac";

export async function POST(request: NextRequest) {
  // 1. Extract Bearer token
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!apiKey) return NextResponse.json({ error: "Missing auth" }, { status: 401 });

  // 2. Validate API key (returns userId, tenantId, keyId, isExpired)
  const keyResult = await validateApiKey(apiKey);
  if (!keyResult) return NextResponse.json({ error: "Invalid key" }, { status: 401 });

  // 3. Rate limit check (100/min per key)
  if (!checkRateLimit(keyResult.keyId)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // 4. Parse and validate body
  const body = await request.json();
  // validate required fields...

  // 5. Verify HMAC signature
  // const signature = request.headers.get("x-everyskill-signature");
  // if (!verifyHmac(body, signature, apiKey)) { ... }

  // 6. Insert usage event with enrichment
  await insertTrackingEvent({
    tenantId: keyResult.tenantId,
    userId: keyResult.userId,
    ...validatedBody,
  });

  return new NextResponse(null, { status: 200 });
}
```

### Pattern 3: In-Memory Rate Limiter

**What:** Sliding window rate limiter using a Map of timestamps per API key.

**Why in-memory:** Single-server deployment (one LXC container). No need for Redis.

```typescript
// apps/web/lib/rate-limiter.ts
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

const requestLog = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [key, timestamps] of requestLog) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) requestLog.delete(key);
    else requestLog.set(key, filtered);
  }
}, 300_000);

export function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(keyId) ?? [];
  const windowStart = now - WINDOW_MS;
  const recentRequests = timestamps.filter(t => t > windowStart);

  if (recentRequests.length >= MAX_REQUESTS) return false;

  recentRequests.push(now);
  requestLog.set(keyId, recentRequests);
  return true;
}
```

### Pattern 4: HMAC Payload Signing

**What:** The hook computes an HMAC-SHA256 of the JSON payload using the API key as the secret, sends it in an `X-EverySkill-Signature` header. The server verifies using `crypto.timingSafeEqual`.

```typescript
// apps/web/lib/hmac.ts
import { createHmac, timingSafeEqual } from "crypto";

export function computeHmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  const expected = computeHmac(payload, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}
```

**In the hook command:**
```bash
PAYLOAD='{"skill_id":"...","tool_name":"...","timestamp":"..."}';
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$EVERYSKILL_API_KEY" | awk '{print $NF}');
curl -s -X POST ... -H "X-EverySkill-Signature: $SIG" -d "$PAYLOAD" ...
```

### Pattern 5: Soft Expiry for API Keys

**What:** Modify `validateApiKey()` to NOT reject expired keys, but instead flag them. The tracking still works but the key is marked as expired in the system.

**Current behavior (api-keys.ts line 29):**
```typescript
or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
```
This currently REJECTS expired keys. For soft expiry, remove the expiry check from the WHERE clause and instead return an `isExpired` flag.

```typescript
// Modified validateApiKey
export async function validateApiKey(rawKey: string): Promise<{
  userId: string;
  keyId: string;
  tenantId: string;
  isExpired: boolean;
} | null> {
  // ... hash key, look up
  const result = await db.query.apiKeys.findFirst({
    columns: { id: true, userId: true, keyHash: true, tenantId: true, expiresAt: true },
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
      // NOTE: removed expiresAt check -- soft expiry
    ),
  });
  // ... timing-safe compare ...
  return {
    userId: result.userId,
    keyId: result.id,
    tenantId: result.tenantId,
    isExpired: result.expiresAt ? result.expiresAt <= now : false,
  };
}
```

**CRITICAL:** This is a breaking change to the `validateApiKey` signature. All callers need updating:
- `apps/mcp/src/auth.ts` (line 32)
- `apps/web/app/api/auth/validate-key/route.ts` (line 25)
- `apps/web/app/api/install-callback/route.ts` (line 43)

### Pattern 6: Middleware Exemption

**What:** Add `/api/track` to the middleware exempt list.

**Current exempt paths (middleware.ts):**
```typescript
pathname.startsWith("/api/auth") ||
pathname === "/api/dev-login" ||
pathname.startsWith("/api/install-callback") ||
pathname.startsWith("/api/mcp") ||
pathname === "/api/validate-key" ||
pathname === "/api/health"
```

Add: `pathname === "/api/track"`

### Anti-Patterns to Avoid
- **DO NOT show hook output to users:** The `async: true` flag plus `-o /dev/null` ensures silence. Never use `echo` in the hook command.
- **DO NOT use synchronous hooks for tracking:** Must be `async: true` to avoid blocking Claude sessions (TRACK-03).
- **DO NOT build a separate tracking microservice:** Use a simple Next.js API route like the existing `install-callback`.
- **DO NOT use Redis for rate limiting:** Single-server deployment makes in-memory sufficient.
- **DO NOT hard-block expired keys:** Soft expiry per decision -- tracking must continue for expired keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key validation | Custom auth middleware | Existing `validateApiKey()` | Already handles hashing, timing-safe comparison, lastUsedAt update |
| Usage event insertion | Raw SQL | Existing `usageEvents` schema + Drizzle insert | Schema already has all needed columns |
| Frontmatter generation | Manual string templates | Existing `buildEverySkillFrontmatter()` | Already handles the YAML frontmatter pattern |
| HMAC signing | Custom crypto | Node.js `crypto.createHmac` | Standard library, no dependency needed |
| JSON parsing in bash | Custom parsing | `jq` | Ubiquitous on developer machines, handles edge cases |

**Key insight:** This phase is mostly wiring together existing pieces. The `usage_events` table, `api_keys` service, frontmatter injection, and middleware exemption patterns all already exist. The main new code is the hook template, the `/api/track` route, rate limiting, and HMAC verification.

## Common Pitfalls

### Pitfall 1: RLS Bypass for Cross-Tenant API Key Lookup
**What goes wrong:** The `api_keys` table has RLS policy filtering by `app.current_tenant_id`. But the `/api/track` endpoint receives a raw API key and doesn't know the tenant yet -- it needs to look up the key across ALL tenants.
**Why it happens:** The DB client sets `app.current_tenant_id` to `DEFAULT_TENANT_ID` on connection.
**How to avoid:** The `key_hash` column is globally unique (prior decision). The current `validateApiKey()` already works because it queries by `keyHash` which bypasses RLS (the table owner bypasses RLS since it's ENABLED not FORCED). This is by design per Phase 25 memory note.
**Warning signs:** Key lookups returning null for keys belonging to non-default tenants.

### Pitfall 2: Changing validateApiKey Signature
**What goes wrong:** Adding `tenantId` and `isExpired` to the return type breaks all existing callers.
**Why it happens:** 3 files import and call `validateApiKey` -- each needs updating.
**How to avoid:** Update all callers in the same plan. The callers are:
1. `apps/mcp/src/auth.ts` -- destructure `{ userId }` from result (ignore tenantId/isExpired)
2. `apps/web/app/api/auth/validate-key/route.ts` -- return tenantId in response
3. `apps/web/app/api/install-callback/route.ts` -- destructure `{ userId }` from result
**Warning signs:** TypeScript errors after changing the return type.

### Pitfall 3: Hook Command Shell Escaping
**What goes wrong:** YAML frontmatter containing shell commands with quotes, dollar signs, and JSON breaks in unpredictable ways.
**Why it happens:** Multiple levels of escaping: YAML -> bash -> curl -> JSON.
**How to avoid:** Use a standalone tracking script that the hook calls, rather than inlining the entire curl command. The hook command should be a simple script path. Alternatively, test the exact command with `bash -c '...'` locally.
**Warning signs:** Malformed JSON in tracking requests, missing field values.

### Pitfall 4: Environment Variable Availability
**What goes wrong:** `$EVERYSKILL_API_KEY` not available in the hook's shell environment.
**Why it happens:** Claude Code hooks run as shell commands in the user's environment. The env var must be set in the user's shell profile or Claude Code configuration.
**How to avoid:** The env var is already required for MCP auth (`apps/mcp/src/auth.ts`). If the user has MCP configured, they have the env var. If not, the hook should gracefully fail (curl returns error, `|| true` swallows it).
**Warning signs:** 401 errors in tracking logs, missing Bearer token.

### Pitfall 5: jq Dependency
**What goes wrong:** Not all developer machines have `jq` installed.
**Why it happens:** While common, `jq` is not universally installed.
**How to avoid:** Either: (a) use a minimal bash-only JSON parser for the single field needed, or (b) document `jq` as a dependency, or (c) use Python one-liner as fallback. Recommended: use `jq` with a fallback.
**Warning signs:** Hook failures on machines without jq.

### Pitfall 6: In-Memory Rate Limiter Reset
**What goes wrong:** Rate limiter state resets when the Next.js server restarts.
**Why it happens:** In-memory Map is ephemeral.
**How to avoid:** This is acceptable for the current single-server deployment. The rate limiter exists to prevent abuse, not for billing. A reset just means a brief window of extra capacity.
**Warning signs:** None -- this is acceptable behavior.

### Pitfall 7: Existing log_skill_usage Tool Conflict
**What goes wrong:** The old MCP tool `log_skill_usage` still exists and creates duplicate events alongside the new hook-based tracking.
**Why it happens:** Failing to deprecate/remove the old tool.
**How to avoid:** Remove or deprecate `log_skill_usage` tool in `apps/mcp/src/tools/log-usage.ts` as part of this phase. The hook replaces it entirely.
**Warning signs:** Double-counting usage events.

## Code Examples

### Example 1: Complete Hook Frontmatter (Recommended Format)

```yaml
---
everyskill_skill_id: abc-123-def-456
everyskill_skill_name: My Awesome Skill
everyskill_category: workflow
everyskill_hours_saved: 2
hooks:
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: >-
            bash -c '
            INPUT=$(cat);
            TOOL_NAME=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "unknown");
            PAYLOAD="{\"skill_id\":\"abc-123-def-456\",\"tool_name\":\"${TOOL_NAME}\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}";
            SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "${EVERYSKILL_API_KEY:-none}" 2>/dev/null | awk "{print \$NF}");
            curl -s -o /dev/null
            -X POST "https://everyskill.ai/api/track"
            -H "Content-Type: application/json"
            -H "Authorization: Bearer ${EVERYSKILL_API_KEY:-}"
            -H "X-EverySkill-Signature: ${SIG}"
            -d "$PAYLOAD"
            --connect-timeout 5 --max-time 10
            2>>/tmp/everyskill-track.log || true
            '
          async: true
          timeout: 15
---
```

**Source:** Claude Code hooks official documentation (code.claude.com/docs/en/hooks)

### Example 2: Modified buildEverySkillFrontmatter

```typescript
// apps/web/app/actions/skills.ts
function buildEverySkillFrontmatter(fields: {
  skillId: string;
  name: string;
  category: string;
  hoursSaved: number;
}): string {
  const trackingEndpoint = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
    : "https://everyskill.ai/api/track";

  return [
    "---",
    `everyskill_skill_id: ${fields.skillId}`,
    `everyskill_skill_name: ${fields.name}`,
    `everyskill_category: ${fields.category}`,
    `everyskill_hours_saved: ${fields.hoursSaved}`,
    "hooks:",
    "  PostToolUse:",
    '    - matcher: "*"',
    "      hooks:",
    "        - type: command",
    `          command: >-`,
    `            bash -c '`,
    `            INPUT=$(cat);`,
    `            TN=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "unknown");`,
    `            PL="{\\"skill_id\\":\\"${fields.skillId}\\",\\"tool_name\\":\\"$TN\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"}";`,
    `            SIG=$(echo -n "$PL" | openssl dgst -sha256 -hmac "$EVERYSKILL_API_KEY" 2>/dev/null | awk "{print \\$NF}");`,
    `            curl -s -o /dev/null -X POST "${trackingEndpoint}"`,
    `            -H "Content-Type: application/json"`,
    `            -H "Authorization: Bearer $EVERYSKILL_API_KEY"`,
    `            -H "X-EverySkill-Signature: $SIG"`,
    `            -d "$PL" --connect-timeout 5 --max-time 10`,
    `            2>>/tmp/everyskill-track.log || true`,
    `            '`,
    "          async: true",
    "          timeout: 15",
    "---",
    "",
  ].join("\n");
}
```

### Example 3: Tracking Event Service

```typescript
// packages/db/src/services/usage-tracking.ts
import { db } from "../client";
import { usageEvents } from "../schema";
import { skills } from "../schema";
import { eq } from "drizzle-orm";

interface TrackingEventInput {
  tenantId: string;
  userId: string;
  skillId: string;
  toolName: string;
  timestamp?: string; // ISO string from hook
  metadata?: Record<string, unknown>;
}

export async function insertTrackingEvent(input: TrackingEventInput): Promise<void> {
  if (!db) return;

  try {
    // Resolve skill name for enrichment (per-request, simple)
    let skillName: string | undefined;
    if (input.skillId) {
      const skill = await db.query.skills.findFirst({
        columns: { name: true },
        where: eq(skills.id, input.skillId),
      });
      skillName = skill?.name;
    }

    await db.insert(usageEvents).values({
      tenantId: input.tenantId,
      toolName: input.toolName,
      skillId: input.skillId,
      userId: input.userId,
      metadata: {
        ...input.metadata,
        skillName,
        clientTimestamp: input.timestamp,
        source: "hook",
      },
    });
  } catch (error) {
    console.error("Failed to insert tracking event:", error);
  }
}
```

### Example 4: Request Body Validation Schema

```typescript
// Zod schema for /api/track request body
import { z } from "zod";

export const trackingPayloadSchema = z.object({
  skill_id: z.string().uuid("Invalid skill ID format"),
  tool_name: z.string().min(1).max(200),
  ts: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "Invalid ISO timestamp"
  ),
  hook_event: z.literal("PostToolUse").optional(),
  tool_input_snippet: z.string().max(1000).optional(),
  tool_output_snippet: z.string().max(1000).optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP `log_skill_usage` tool (honor system) | PostToolUse hooks (deterministic) | This phase | Every tool invocation tracked automatically, no LLM cooperation needed |
| Hard key expiry (reject expired) | Soft key expiry (flag, continue) | This phase | Analytics continuity -- never lose tracking data due to key expiry |
| No HMAC signing on callbacks | HMAC-SHA256 payload signing | This phase | Prevents spoofed tracking events (SOC2-05) |

**Deprecated/outdated after this phase:**
- `apps/mcp/src/tools/log-usage.ts` (`log_skill_usage` tool) -- replaced by hooks, should be removed or marked deprecated
- `apps/mcp/src/tracking/events.ts` (`trackUsage()`) -- the MCP-side tracking function becomes secondary to hook-based tracking

## Schema Changes Required

### 1. Modify validateApiKey Return Type (TENANT-11)
No schema change needed. The `api_keys` table already has `tenantId` column. Just modify the query to select it and include it in the return value.

### 2. Per-Tenant Key Expiry Configuration
Need to add `keyExpiryDays` column. Two options:

**Option A: Add to `tenants` table**
```sql
ALTER TABLE tenants ADD COLUMN key_expiry_days INTEGER NOT NULL DEFAULT 90;
```

**Option B: Add to `site_settings` table** (recommended -- it's the tenant config table)
```sql
ALTER TABLE site_settings ADD COLUMN key_expiry_days INTEGER NOT NULL DEFAULT 90;
```

Recommendation: Use `site_settings` since it already stores per-tenant configuration (semantic similarity settings, etc.).

### 3. Usage Events Table
No changes needed. The existing `usage_events` table has all necessary columns:
- `id`, `tenantId`, `toolName`, `skillId`, `userId`, `metadata` (jsonb), `createdAt`

The `metadata` JSONB field can store any additional data (skillName, clientTimestamp, source, etc.) without schema changes.

## Endpoint Authentication Flow

```
Client (Claude Code hook)
  |
  | POST /api/track
  | Headers: Authorization: Bearer <API_KEY>
  |          X-EverySkill-Signature: <HMAC-SHA256>
  |          Content-Type: application/json
  | Body: { skill_id, tool_name, ts }
  |
  v
Middleware (apps/web/middleware.ts)
  |-- /api/track is EXEMPT (no session cookie needed)
  v
Route Handler (apps/web/app/api/track/route.ts)
  |
  |-- 1. Extract Bearer token from Authorization header
  |-- 2. validateApiKey(token) -> { userId, tenantId, keyId, isExpired }
  |      (returns null -> 401)
  |-- 3. checkRateLimit(keyId) -> boolean
  |      (false -> 429)
  |-- 4. Parse JSON body + zod validate
  |      (invalid -> 400)
  |-- 5. Verify HMAC signature (X-EverySkill-Signature)
  |      (invalid -> 403)
  |-- 6. insertTrackingEvent(enriched data)
  |-- 7. Return 200 (empty body)
```

## Hook Injection Points

There are exactly 3 places where skill content with frontmatter is generated:

### 1. Upload (Server Action) - `apps/web/app/actions/skills.ts`
- `buildEverySkillFrontmatter()` generates the YAML header (line 19-33)
- Called in `checkAndCreateSkill()` (line 178) and `createSkill()` (line 353)
- **Action:** Modify `buildEverySkillFrontmatter()` to include hooks section

### 2. Deploy (MCP Tool) - `apps/mcp/src/tools/deploy.ts`
- Inline frontmatter construction (line 71-72)
- **Action:** Call `buildEverySkillFrontmatter()` or equivalent, verify hooks are present. If skill content already has hooks (from upload), pass through. If not (legacy skills), inject hooks.

### 3. Skill Content in DB - `skills.content` column
- Already stores content with frontmatter
- Skills created before this phase won't have hooks
- **Action:** Deploy-time compliance check verifies hooks exist, injects if missing

## Open Questions

1. **jq dependency management**
   - What we know: `jq` is needed to parse the PostToolUse JSON input in the hook command
   - What's unclear: What percentage of developer machines have `jq` installed
   - Recommendation: Use `jq` with a bash fallback for the critical `tool_name` extraction: `TOOL=$(echo "$INPUT" | jq -r ".tool_name" 2>/dev/null || echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | cut -d'"' -f4 || echo "unknown")`

2. **Local queue implementation on user machine**
   - What we know: Decision says failed events should be queued locally and retried
   - What's unclear: How to implement this purely in a hook command (hooks are stateless shell commands)
   - Recommendation: Use a simple file-based approach -- append failed payloads to `/tmp/everyskill-queue.jsonl`, and have the hook check for + flush the queue before sending the new event. Keep it simple: `cat /tmp/everyskill-queue.jsonl 2>/dev/null | while read line; do curl ... -d "$line" && sed -i '1d' /tmp/everyskill-queue.jsonl; done`

3. **HMAC secret management**
   - What we know: HMAC uses the API key as the signing secret
   - What's unclear: Whether using the raw API key as HMAC secret is a best practice (vs a separate signing secret)
   - Recommendation: Using the API key is pragmatic -- the key is already on the client machine and the server can derive it. A separate signing secret would require additional key distribution. Since HTTPS provides transport security and the HMAC prevents payload tampering, the API key as HMAC secret is acceptable for SOC2.

## Sources

### Primary (HIGH confidence)
- Claude Code hooks official documentation: https://code.claude.com/docs/en/hooks -- Full hook lifecycle, PostToolUse input/output schema, async hooks, skill frontmatter hooks, matcher patterns, command hook fields
- Claude Code skills documentation: https://code.claude.com/docs/en/skills -- Skill frontmatter fields including `hooks` field, YAML format specification
- Existing codebase files (read directly):
  - `packages/db/src/schema/usage-events.ts` -- usage_events table schema
  - `packages/db/src/schema/api-keys.ts` -- api_keys table schema
  - `packages/db/src/services/api-keys.ts` -- validateApiKey implementation
  - `apps/web/app/api/install-callback/route.ts` -- precedent for API key-authenticated endpoint
  - `apps/web/middleware.ts` -- current exempt paths
  - `apps/web/app/actions/skills.ts` -- buildEverySkillFrontmatter function
  - `apps/mcp/src/tools/deploy.ts` -- deploy tool with inline frontmatter
  - `apps/mcp/src/auth.ts` -- MCP auth module

### Secondary (MEDIUM confidence)
- HMAC webhook verification patterns: Multiple sources (GitHub, Stripe, Shopify all use same pattern)
- Next.js rate limiting: In-memory Map approach verified across multiple articles

### Tertiary (LOW confidence)
- Local queue implementation details -- community patterns, not officially documented
- jq availability assumptions -- anecdotal

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All existing libraries, no new dependencies needed
- Architecture: HIGH -- Following existing codebase patterns (install-callback, buildEverySkillFrontmatter)
- Hook format: HIGH -- Verified against official Claude Code documentation
- Pitfalls: HIGH -- Identified from direct codebase analysis
- HMAC/rate limiting: MEDIUM -- Standard patterns but implementation details are discretionary
- Local queue: LOW -- Stateless hooks make client-side queuing complex

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable domain, existing patterns)
