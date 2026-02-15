# Phase 56: In-Claude Feedback Collection - Research

**Researched:** 2026-02-15
**Domain:** MCP tool actions, Claude Code hooks (PostToolUse/additionalContext), API endpoints, skill feedback aggregation
**Confidence:** HIGH

## Summary

This phase adds user feedback (thumbs up/down) on skills directly from Claude Code, surfaces feedback sentiment on skill detail pages, and uses PostToolUse hooks with `additionalContext` to prompt users for feedback at smart intervals.

The existing codebase provides strong foundations. The `skill_feedback` table (Phase 55) already exists with the right schema -- `feedbackType` discriminator supporting `thumbs_up`/`thumbs_down`, optional `comment`, `sentiment` (-1/0/1), and `source` field. The `skills` table already has denormalized `totalFeedback` and `positiveFeedbackPct` columns ready for aggregation. The MCP server uses a unified `everyskill` tool with an action discriminator pattern, making adding a `feedback` action straightforward. The `/api/track` endpoint provides a proven template for Bearer auth + Zod validation + rate limiting.

The key design challenge is the PostToolUse hook for feedback prompting. Claude Code hooks support `additionalContext` injection via JSON stdout, and the existing skill frontmatter already contains PostToolUse hooks for tracking. The feedback prompt hook needs to: (1) count usage via a server-side call or local file counter, and (2) return `additionalContext` only on the first 3 uses and every 10th use thereafter. The current tracking hook is async and fire-and-forget; the feedback hook can piggyback on the same hook or be a separate synchronous hook that returns `additionalContext`.

**Primary recommendation:** Add `feedback` action to the existing `everyskill` MCP tool, create `/api/feedback` mirroring `/api/track` patterns, add a feedback sentiment StatCard to the skill detail page, and inject feedback prompts via PostToolUse hook `additionalContext` with a local file-based usage counter.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCP server tool registration | Already used in `apps/mcp` |
| `zod` | ^3.25.0 | API payload validation | Already used for `/api/track` schema |
| `drizzle-orm` | ^0.42.0 | Database queries and aggregation | Already used throughout |
| Next.js API routes | 16.1.6 | `/api/feedback` endpoint | Already used for all API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@everyskill/db` | workspace:* | DB client, schema, services | All database operations |
| `sanitize-payload.ts` | existing | Strip secrets from feedback text | Comment sanitization |
| `rate-limiter.ts` | existing | In-memory rate limiting | `/api/feedback` rate limiting |
| `hmac.ts` | existing | HMAC signature verification | Optional signature on feedback API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local file counter for usage | Server-side counter via API call | Server call adds latency to hook; local file is simpler and works offline |
| Separate MCP tool for feedback | Action on existing `everyskill` tool | Separate tool clutters the tool list; action pattern is established |

## Architecture Patterns

### Recommended Project Structure
```
apps/mcp/src/tools/
  feedback.ts              # handleFeedback action handler
  everyskill.ts            # Add "feedback" to ACTIONS, route to handler
apps/web/app/api/feedback/
  route.ts                 # POST endpoint (Bearer auth, Zod, rate limit)
apps/web/components/
  feedback-sentiment.tsx   # Sentiment display component (e.g., "85% positive")
apps/web/lib/
  skill-feedback-stats.ts  # Server-side aggregation query
packages/db/src/services/
  skill-feedback.ts        # NEW: insertFeedback, getFeedbackStats, updateSkillFeedbackAggregates
```

### Pattern 1: Unified MCP Tool Action (established pattern)
**What:** Add `feedback` to the existing `ACTIONS` enum in `everyskill.ts` and route to a dedicated handler.
**When to use:** Always -- this is how all MCP actions work in this codebase.
**Example:**
```typescript
// In apps/mcp/src/tools/everyskill.ts
const ACTIONS = [
  "search", "list", "recommend", "describe", "install", "guide",
  "create", "update", "review", "submit_review", "check_review",
  "check_status", "feedback",  // NEW
] as const;

// In the switch statement:
case "feedback": {
  if (!args.skillId) return missingParam(action, "skillId");
  if (!args.feedbackType) return missingParam(action, "feedbackType");
  return handleFeedback({
    skillId: args.skillId,
    feedbackType: args.feedbackType as "thumbs_up" | "thumbs_down",
    comment: args.comment,
    userId,
  });
}
```

### Pattern 2: API Endpoint (mirrors `/api/track`)
**What:** Bearer auth + Zod validation + rate limiting for external feedback submission.
**When to use:** For the MCP server to submit feedback to the web app.
**Example:**
```typescript
// In apps/web/app/api/feedback/route.ts
const feedbackSchema = z.object({
  skill_id: z.string().min(1),
  feedback_type: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Bearer token extraction
  // 2. validateApiKey()
  // 3. checkRateLimit()
  // 4. Parse + validate body
  // 5. sanitizePayload() on comment
  // 6. Insert feedback + update aggregates
  // 7. Return 200
}
```

### Pattern 3: PostToolUse Hook with additionalContext for Feedback Prompting
**What:** Modify the skill frontmatter PostToolUse hook to count uses locally and return `additionalContext` prompting Claude to ask for feedback.
**When to use:** After every skill use, with smart frequency gating.
**Example:**
```bash
#!/bin/bash
# This replaces or supplements the existing tracking hook in skill frontmatter
INPUT=$(cat)
SKILL_ID=$(echo "$INPUT" | jq -r '.tool_input.everyskill_skill_id // empty' 2>/dev/null)

# Use a local counter file
COUNTER_FILE="/tmp/everyskill-feedback-${SKILL_ID}.count"
COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Smart frequency: first 3 uses, then every 10th
if [ "$COUNT" -le 3 ] || [ $((COUNT % 10)) -eq 0 ]; then
  # Return additionalContext prompting feedback
  echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"You just used an EverySkill skill. Consider asking the user: \"Was this skill helpful? You can give feedback with: everyskill action:feedback skillId:SKILL_ID feedbackType:thumbs_up (or thumbs_down) comment:optional_comment\""}}'
fi
```

### Pattern 4: Direct MCP Feedback (alternative to API endpoint)
**What:** The MCP `feedback` action handler inserts directly into the DB using `@everyskill/db`.
**When to use:** Since the MCP server already has direct DB access via `@everyskill/db`, it can insert feedback directly without going through the web API.
**Recommended approach:** Use direct DB insertion in the MCP handler (like `describe`, `create`, etc. already do) AND have the `/api/feedback` endpoint for future web/external integrations.

### Anti-Patterns to Avoid
- **Separate MCP tool for feedback:** Don't create a new tool registration. Use the existing `everyskill` tool with a new action. The codebase explicitly uses a single-tool-with-action-discriminator pattern.
- **Synchronous feedback hook blocking tool execution:** The feedback prompt hook should NOT block tool execution. Use `async: true` or return `additionalContext` without blocking.
- **Complex server-side usage counting in hooks:** Don't make an API call in the PostToolUse hook just to count uses. Use a simple local file counter (`/tmp/everyskill-feedback-*.count`). The tracking API call is already async/fire-and-forget.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key validation | Custom auth middleware | `validateApiKey()` from `@everyskill/db/services/api-keys` | Handles hashing, timing-safe comparison, expiry checks |
| Rate limiting | Custom implementation | `checkRateLimit()` from `apps/web/lib/rate-limiter.ts` | In-memory sliding window, automatic cleanup |
| Secret detection in comments | Regex-based filtering | `sanitizePayload()` from `apps/web/lib/sanitize-payload.ts` | Handles 12+ secret patterns including PEM, AWS, GitHub, OpenAI keys |
| HMAC verification | Custom crypto code | `verifyHmac()` from `apps/web/lib/hmac.ts` | Timing-safe comparison built in |
| Feedback aggregation math | Manual percentage calculation | SQL `count(*) FILTER (WHERE ...)` | Accurate, atomic, handles edge cases |

**Key insight:** Every security-sensitive piece (auth, rate limiting, secret stripping, HMAC) already exists and is battle-tested. The feedback endpoint is structurally identical to `/api/track`.

## Common Pitfalls

### Pitfall 1: Hook stdout corruption breaks JSON parsing
**What goes wrong:** If the PostToolUse hook script prints anything to stdout besides the JSON response, Claude Code fails to parse it.
**Why it happens:** Shell profile scripts, echo statements for debugging, or command output leaking to stdout.
**How to avoid:** Redirect all debug output to stderr (`>&2`). Only print the final JSON object to stdout. Test hooks with `echo '{}' | bash hook-script.sh` to verify clean output.
**Warning signs:** "JSON validation failed" errors in Claude Code debug output.

### Pitfall 2: usage_events.id is UUID, skill_feedback.usageEventId is TEXT
**What goes wrong:** FK constraint mismatch if you try to link feedback to usage events.
**Why it happens:** The `skill_feedback` schema has `usageEventId: text("usage_event_id")` with a comment saying "NO FK -- uuid/text type mismatch with usage_events".
**How to avoid:** Store the usage event ID as a text string. Don't add a foreign key constraint. The link is informational only.

### Pitfall 3: Tenant isolation bypass
**What goes wrong:** Feedback from one tenant gets associated with another tenant's skills.
**Why it happens:** Not passing the correct `tenantId` when inserting feedback.
**How to avoid:** Always resolve `tenantId` from the validated API key (via `keyResult.tenantId`) or from `getTenantId()` in the MCP auth module. The `skill_feedback` table has RLS policy on `tenant_id`.

### Pitfall 4: Aggregate denormalization drift
**What goes wrong:** `skills.totalFeedback` and `skills.positiveFeedbackPct` get out of sync with actual `skill_feedback` rows.
**Why it happens:** Inserting feedback without updating the denormalized columns, or errors during update.
**How to avoid:** Create an `updateSkillFeedbackAggregates(skillId)` function (similar to `updateSkillRating`) that recalculates from `skill_feedback` rows and updates the skills table atomically. Call it after every feedback insert.

### Pitfall 5: Middleware blocking `/api/feedback`
**What goes wrong:** The feedback API returns 401 or redirects because middleware intercepts it.
**Why it happens:** The middleware in `apps/web/middleware.ts` has an explicit allow-list for exempt paths. `/api/feedback` is not on it.
**How to avoid:** Add `pathname === "/api/feedback"` to the exempt paths list in middleware, just like `/api/track` is exempted.

### Pitfall 6: Async hook cannot return additionalContext
**What goes wrong:** Setting `async: true` on the hook means `additionalContext` is delivered on the NEXT conversation turn, not immediately.
**Why it happens:** Async hooks run in the background; their output is deferred.
**How to avoid:** For the feedback prompt, use a synchronous hook (not async) that returns quickly. The usage counting is just a local file read/write (sub-millisecond). The existing tracking curl can remain async. You may need TWO hooks in the frontmatter: one async for tracking, one sync for feedback prompting.

## Code Examples

### Feedback MCP Action Handler
```typescript
// apps/mcp/src/tools/feedback.ts
import { db } from "@everyskill/db";
import { skillFeedback } from "@everyskill/db/schema/skill-feedback";
import { skills } from "@everyskill/db/schema/skills";
import { eq, sql } from "drizzle-orm";
import { trackUsage } from "../tracking/events.js";
import { getUserId, getTenantId } from "../auth.js";

export async function handleFeedback({
  skillId,
  feedbackType,
  comment,
  userId,
}: {
  skillId: string;
  feedbackType: "thumbs_up" | "thumbs_down";
  comment?: string;
  userId?: string;
}) {
  if (!db) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }],
      isError: true,
    };
  }

  const tenantId = getTenantId();
  if (!tenantId) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: "Not authenticated" }) }],
      isError: true,
    };
  }

  // Insert feedback
  await db.insert(skillFeedback).values({
    tenantId,
    skillId,
    userId: userId ?? null,
    feedbackType,
    sentiment: feedbackType === "thumbs_up" ? 1 : -1,
    comment: comment ?? null,
    source: "mcp",
  });

  // Update denormalized aggregates on skills table
  await updateSkillFeedbackAggregates(skillId);

  // Track usage
  await trackUsage({
    toolName: "feedback",
    skillId,
    userId: getUserId() ?? undefined,
    metadata: { feedbackType, hasComment: !!comment },
  }, { skipIncrement: true });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        success: true,
        message: `Feedback recorded: ${feedbackType === "thumbs_up" ? "thumbs up" : "thumbs down"}${comment ? " with comment" : ""}`,
      }),
    }],
  };
}

async function updateSkillFeedbackAggregates(skillId: string): Promise<void> {
  if (!db) return;

  const result = await db
    .select({
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) FILTER (WHERE feedback_type = 'thumbs_up')::int`,
    })
    .from(skillFeedback)
    .where(eq(skillFeedback.skillId, skillId));

  const total = result[0]?.total ?? 0;
  const positive = result[0]?.positive ?? 0;
  const pct = total > 0 ? Math.round((positive / total) * 100) : null;

  await db.update(skills).set({
    totalFeedback: total,
    positiveFeedbackPct: pct,
    updatedAt: new Date(),
  }).where(eq(skills.id, skillId));
}
```

### Feedback API Endpoint
```typescript
// apps/web/app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sanitizePayload } from "@/lib/sanitize-payload";
import { z } from "zod";

const feedbackSchema = z.object({
  skill_id: z.string().min(1, "skill_id required"),
  feedback_type: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
  }
  const apiKey = authHeader.slice(7);

  const keyResult = await validateApiKey(apiKey);
  if (!keyResult) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  if (!checkRateLimit(keyResult.keyId)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Sanitize comment
  const sanitizedComment = parsed.data.comment
    ? sanitizePayload(parsed.data.comment).sanitized
    : undefined;

  // Insert feedback (use db service)
  // ... insertFeedback call ...

  return new NextResponse(null, { status: 200 });
}
```

### PostToolUse Hook Frontmatter (Feedback Prompt)
```yaml
# Added to skill frontmatter alongside existing tracking hook
hooks:
  PostToolUse:
    - matcher: "*"
      hooks:
        # Existing async tracking hook (unchanged)
        - type: command
          command: >-
            bash -c '...existing tracking curl...'
          async: true
          timeout: 30
        # NEW: Sync feedback prompt hook
        - type: command
          command: >-
            bash -c '
            SKILL_ID="PLACEHOLDER_SKILL_ID";
            CF="/tmp/everyskill-fb-${SKILL_ID}.cnt";
            C=$(cat "$CF" 2>/dev/null || echo 0);
            C=$((C + 1));
            echo "$C" > "$CF";
            if [ "$C" -le 3 ] || [ $((C % 10)) -eq 0 ]; then
              printf "{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"The user just used the EverySkill skill (ID: %s). If appropriate, ask: Was this skill helpful? They can give feedback with: everyskill action:feedback skillId:%s feedbackType:thumbs_up (or thumbs_down) comment:optional\"}}" "$SKILL_ID" "$SKILL_ID";
            fi;
            '
          timeout: 5
```

### Feedback Sentiment Display Component
```typescript
// apps/web/components/feedback-sentiment.tsx
"use client";

interface FeedbackSentimentProps {
  totalFeedback: number;
  positiveFeedbackPct: number | null;
}

export function FeedbackSentiment({ totalFeedback, positiveFeedbackPct }: FeedbackSentimentProps) {
  if (totalFeedback === 0) return null;

  const pct = positiveFeedbackPct ?? 0;
  const color = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-semibold ${color}`}>{pct}% positive</span>
      <span className="text-gray-400">({totalFeedback} feedback{totalFeedback !== 1 ? "s" : ""})</span>
    </div>
  );
}
```

### Feedback Aggregation Query (for skill detail page)
```typescript
// apps/web/lib/skill-feedback-stats.ts
import { db } from "@everyskill/db";
import { skillFeedback } from "@everyskill/db/schema";
import { eq, sql, gte, and } from "drizzle-orm";

export interface SkillFeedbackStats {
  totalFeedback: number;
  positivePct: number | null;
  last30DaysTotal: number;
  last30DaysPositivePct: number | null;
  feedbackTrend: number[]; // 14-day trend of feedback count
}

export async function getSkillFeedbackStats(skillId: string): Promise<SkillFeedbackStats> {
  if (!db) {
    return { totalFeedback: 0, positivePct: null, last30DaysTotal: 0, last30DaysPositivePct: null, feedbackTrend: [] };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // All-time + last 30 days aggregation
  const [allTime, recent] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) FILTER (WHERE feedback_type = 'thumbs_up')::int`,
    }).from(skillFeedback).where(eq(skillFeedback.skillId, skillId)),

    db.select({
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) FILTER (WHERE feedback_type = 'thumbs_up')::int`,
    }).from(skillFeedback).where(
      and(eq(skillFeedback.skillId, skillId), gte(skillFeedback.createdAt, thirtyDaysAgo))
    ),
  ]);

  const total = allTime[0]?.total ?? 0;
  const positive = allTime[0]?.positive ?? 0;
  const recentTotal = recent[0]?.total ?? 0;
  const recentPositive = recent[0]?.positive ?? 0;

  return {
    totalFeedback: total,
    positivePct: total > 0 ? Math.round((positive / total) * 100) : null,
    last30DaysTotal: recentTotal,
    last30DaysPositivePct: recentTotal > 0 ? Math.round((recentPositive / recentTotal) * 100) : null,
    feedbackTrend: [], // Can be populated with daily breakdown like skill-detail-trends.ts
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ratings only (1-5 stars) | Ratings + Thumbs up/down feedback | Phase 55 (schema) / Phase 56 (implementation) | Lower friction feedback from Claude users |
| No feedback from Claude | MCP action + PostToolUse prompting | Phase 56 | Feedback collection where users actually use skills |
| Manual PostToolUse hook (command type, bash) | Same approach but with `additionalContext` | Claude Code hooks spec (current) | Enables contextual prompting without blocking |

**Deprecated/outdated:**
- The `decision` and `reason` top-level fields for PreToolUse are deprecated in favor of `hookSpecificOutput.permissionDecision` (not relevant here since we use PostToolUse, which still uses top-level `decision`)

## Open Questions

1. **Should the MCP handler call the API or insert directly?**
   - What we know: The MCP server has direct DB access via `@everyskill/db`. All other MCP handlers (describe, create, deploy) use direct DB access.
   - What's unclear: Whether we should also have the MCP handler call `/api/feedback` for consistency with external clients.
   - Recommendation: Use direct DB insertion in the MCP handler (consistent with all other handlers). The `/api/feedback` endpoint exists for future web UI or external integrations.

2. **Local counter persistence across sessions**
   - What we know: `/tmp/` files are cleared on reboot. The counter resets per system restart.
   - What's unclear: Whether this matters for feedback frequency.
   - Recommendation: Use `/tmp/` -- it's fine. A reset means the user gets prompted on the first 3 uses again after reboot, which is acceptable behavior. Alternatively, use `~/.cache/everyskill/feedback-counters/` for persistence.

3. **Two hooks vs one in frontmatter**
   - What we know: The existing tracking hook is `async: true`. Async hooks cannot return `additionalContext` that takes effect immediately. The feedback prompt needs a synchronous hook to inject `additionalContext`.
   - What's unclear: Whether having two PostToolUse hooks (one async for tracking, one sync for feedback) causes any issues.
   - Recommendation: Use two separate hooks in the same matcher group. Claude Code docs confirm "All matching hooks run in parallel, and identical handlers are deduplicated automatically." Two different commands will both run. The sync one returns additionalContext; the async one does the tracking curl.

## Sources

### Primary (HIGH confidence)
- Claude Code Hooks Reference: https://code.claude.com/docs/en/hooks -- Full PostToolUse specification, additionalContext format, async vs sync behavior, JSON output schema
- Codebase: `apps/mcp/src/tools/everyskill.ts` -- Unified tool with action discriminator pattern
- Codebase: `apps/web/app/api/track/route.ts` -- Bearer auth + Zod + rate limiting template
- Codebase: `packages/db/src/schema/skill-feedback.ts` -- Existing skill_feedback table schema
- Codebase: `packages/db/src/schema/skills.ts` -- totalFeedback, positiveFeedbackPct columns
- Codebase: `apps/mcp/src/tools/deploy.ts` -- PostToolUse hook frontmatter generation
- Codebase: `apps/mcp/src/auth.ts` -- MCP auth (getUserId, getTenantId)
- Codebase: `apps/web/lib/rate-limiter.ts` -- In-memory rate limiter
- Codebase: `apps/web/lib/sanitize-payload.ts` -- Secret detection/stripping

### Secondary (MEDIUM confidence)
- Codebase: `apps/web/middleware.ts` -- Middleware exempt paths (need to add `/api/feedback`)
- Codebase: `apps/web/components/skill-detail.tsx` -- Current stat cards layout for feedback sentiment placement

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use, no new dependencies needed
- Architecture: HIGH -- All patterns directly observable in existing codebase
- Pitfalls: HIGH -- Identified from actual codebase constraints (type mismatches, middleware allow-list, async hook behavior)
- PostToolUse additionalContext: HIGH -- Verified against official Claude Code hooks documentation

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- all patterns are established in the codebase)
