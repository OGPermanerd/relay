# Phase 60: Token/Cost Measurement - Research

**Researched:** 2026-02-15
**Domain:** Claude Code hooks, transcript parsing, Anthropic pricing, Drizzle ORM aggregation
**Confidence:** HIGH (infrastructure) / MEDIUM (hook-based token capture)

## Summary

This phase wires up token usage capture, cost estimation, and per-skill cost aggregation. The schema foundation is already complete (Phase 55): `token_measurements` table with `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostMicrocents`, `latencyMs`, `modelName`, `modelProvider`, `source` columns, plus `avgTokenCostMicrocents` on the `skills` table. The `/api/track` endpoint and PostToolUse hook frontmatter injection are also complete (Phase 28).

The central technical question is: **what data can the PostToolUse hook access?** The answer, verified via official Claude Code docs, is that PostToolUse receives `tool_input`, `tool_response`, and -- critically -- `transcript_path`. The hook does NOT receive token counts, model name, cost, or latency directly. However, the transcript JSONL file (at `transcript_path`) contains full token usage data (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) and `model` name in each assistant message entry. The strategy is: parse the last assistant entry from the transcript to extract cumulative token/model data, then send a delta or snapshot to `/api/track`.

The pricing table is well-documented on Anthropic's official pricing page. A static lookup table mapping model ID to input/output $/MTok is sufficient and can be updated as new models release. Cost is calculated server-side as `estimatedCostMicrocents` to avoid floating-point issues in aggregation.

**Primary recommendation:** Extend the existing PostToolUse hook to read `transcript_path`, parse the most recent assistant message for token/model data, and send the enriched payload to `/api/track`. Server-side calculates cost using a static pricing table and inserts into `token_measurements`. Skill detail page adds 1-2 StatCards for cost metrics.

## Standard Stack

### Core (No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | DB queries, aggregation | Already installed |
| next.js | 16.1.6 | API routes | Already installed |
| zod | 3.25+ | Request validation | Already installed |
| crypto (Node built-in) | - | HMAC signing | Already used in /api/track |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jq (CLI) | system | JSON parsing in hook shell | Already required by existing hook |
| tail (CLI) | system | Read last lines of transcript | Standard Unix tool |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell transcript parsing | Node.js script in hook | Shell is already the hook pattern; adding Node.js script complicates deployment |
| Real-time API pricing | Static pricing table | Static is simpler, matches project decision, can be updated with model releases |
| Per-turn token deltas | Session cumulative snapshot | Deltas require tracking previous totals; snapshot is simpler for first iteration |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  services/
    token-measurements.ts      # NEW: insertTokenMeasurement(), getSkillCostStats()
  schema/
    token-measurements.ts      # EXISTS: no changes needed

apps/web/
  app/api/track/
    route.ts                   # MODIFY: accept optional token fields, insert into token_measurements
  lib/
    pricing-table.ts           # NEW: static Anthropic pricing lookup
    skill-stats.ts             # MODIFY: add cost stats to SkillStats interface
  components/
    skill-detail.tsx           # MODIFY: add cost StatCards

apps/web/app/actions/
  skills.ts                    # MODIFY: extend hook payload to capture token data from transcript

apps/mcp/src/tools/
  deploy.ts                    # MODIFY: mirror updated hook frontmatter
```

### Pattern 1: Transcript-Based Token Capture via PostToolUse Hook

**What:** The PostToolUse hook reads `transcript_path` from stdin, parses the last assistant message entry from the JSONL file to extract token counts and model name, then includes these in the `/api/track` payload.

**When to use:** Every PostToolUse hook invocation (already fires on every tool call within a skill).

**Why this works:** Claude Code passes `transcript_path` as a common input field to ALL hooks (verified in official docs). The transcript is a JSONL file where each assistant message contains:
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_read_input_tokens": 890,
      "cache_creation_input_tokens": 456
    }
  },
  "timestamp": "2026-02-15T12:00:00.000Z"
}
```

**Hook shell pattern:**
```bash
INPUT=$(cat);
TP=$(echo "$INPUT" | jq -r '.transcript_path // empty');
TN=$(echo "$INPUT" | jq -r '.tool_name // empty');
# Read last assistant message from transcript for token data
if [ -n "$TP" ] && [ -f "$TP" ]; then
  LAST_ASST=$(tac "$TP" | grep -m1 '"model"' || echo '{}');
  MODEL=$(echo "$LAST_ASST" | jq -r '.message.model // "unknown"' 2>/dev/null || echo "unknown");
  IN_TOK=$(echo "$LAST_ASST" | jq -r '.message.usage.input_tokens // 0' 2>/dev/null || echo "0");
  OUT_TOK=$(echo "$LAST_ASST" | jq -r '.message.usage.output_tokens // 0' 2>/dev/null || echo "0");
else
  MODEL="unknown"; IN_TOK=0; OUT_TOK=0;
fi;
# Build enriched payload
PL="{\"skill_id\":\"$SKILL_ID\",\"tool_name\":\"$TN\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"hook_event\":\"PostToolUse\",\"model_name\":\"$MODEL\",\"input_tokens\":$IN_TOK,\"output_tokens\":$OUT_TOK}";
```

**Critical insight:** Token counts in the transcript are CUMULATIVE per API call, not per-tool-use. The same assistant response may trigger multiple tool uses, each of which fires the PostToolUse hook. The token data captured will be the same for all tool uses within the same assistant turn. This is acceptable for cost estimation -- the server can deduplicate or attribute proportionally.

### Pattern 2: Static Pricing Table

**What:** A TypeScript object mapping model API IDs to input/output pricing in microcents per token.

**Why microcents:** 1 microcent = 1/1,000,000 of a dollar. This avoids floating-point precision issues.
- $3/MTok = 0.000003 $/token = 0.0003 cents/token = 0.3 microcents/token
- Formula: `costMicrocents = (inputTokens * inputPricePerMTok + outputTokens * outputPricePerMTok) / 1_000_000 * 100_000_000`
- Simplified: `costMicrocents = inputTokens * inputRate + outputTokens * outputRate`
  where rates are in microcents/token

**Example (verified from Anthropic pricing page 2026-02-15):**
```typescript
// Source: https://platform.claude.com/docs/en/about-claude/pricing
// Prices in microcents per token (1 microcent = $0.00000001)
// Formula: $/MTok * 100 (cents/$) * 10000 (microcents/cent) / 1_000_000 (tokens/MTok) = microcents/token
// = $/MTok / 10

export const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  // Current models
  "claude-opus-4-6":              { input: 0.5,   output: 2.5   },  // $5/$25 per MTok
  "claude-sonnet-4-5-20250929":   { input: 0.3,   output: 1.5   },  // $3/$15 per MTok
  "claude-sonnet-4-5":            { input: 0.3,   output: 1.5   },  // alias
  "claude-haiku-4-5-20251001":    { input: 0.1,   output: 0.5   },  // $1/$5 per MTok
  "claude-haiku-4-5":             { input: 0.1,   output: 0.5   },  // alias
  // Legacy models still in use
  "claude-opus-4-5-20251101":     { input: 0.5,   output: 2.5   },  // $5/$25 per MTok
  "claude-opus-4-5":              { input: 0.5,   output: 2.5   },  // alias
  "claude-opus-4-1-20250805":     { input: 1.5,   output: 7.5   },  // $15/$75 per MTok
  "claude-opus-4-1":              { input: 1.5,   output: 7.5   },  // alias
  "claude-sonnet-4-20250514":     { input: 0.3,   output: 1.5   },  // $3/$15 per MTok
  "claude-sonnet-4-0":            { input: 0.3,   output: 1.5   },  // alias
  "claude-3-7-sonnet-20250219":   { input: 0.3,   output: 1.5   },  // $3/$15 per MTok (deprecated)
  "claude-opus-4-20250514":       { input: 1.5,   output: 7.5   },  // $15/$75 per MTok
  "claude-opus-4-0":              { input: 1.5,   output: 7.5   },  // alias
  "claude-3-5-sonnet-20241022":   { input: 0.3,   output: 1.5   },  // $3/$15 per MTok (legacy)
  "claude-3-haiku-20240307":      { input: 0.025, output: 0.125 },  // $0.25/$1.25 per MTok
};

export function estimateCostMicrocents(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const pricing = ANTHROPIC_PRICING[modelName];
  if (!pricing) return null;
  return Math.round(inputTokens * pricing.input + outputTokens * pricing.output);
}
```

### Pattern 3: Extended /api/track Payload (Backward-Compatible)

**What:** Add optional fields to the tracking payload schema without breaking existing hooks.

**Schema extension:**
```typescript
const trackingPayloadSchema = z.object({
  // Existing fields (unchanged)
  skill_id: z.string().min(1),
  tool_name: z.string().min(1).max(200),
  ts: z.string().refine((val) => !isNaN(Date.parse(val))),
  hook_event: z.string().optional(),
  tool_input_snippet: z.string().max(1000).optional(),
  tool_output_snippet: z.string().max(1000).optional(),
  // NEW optional fields (TOKEN-01 through TOKEN-04)
  model_name: z.string().max(100).optional(),
  input_tokens: z.number().int().min(0).optional(),
  output_tokens: z.number().int().min(0).optional(),
  latency_ms: z.number().int().min(0).optional(),
});
```

This is fully backward-compatible -- existing hooks that don't send token data will still work. New hooks that include these fields get cost tracking.

### Pattern 4: Server-Side Cost Calculation and Insertion

**What:** When `/api/track` receives a payload with token data, calculate cost server-side and insert into `token_measurements`.

**Flow:**
1. Parse enriched payload (existing `trackingPayloadSchema` + new optional fields)
2. Insert usage event (existing behavior, unchanged)
3. If `model_name` is present, calculate `estimatedCostMicrocents` using pricing table
4. Insert into `token_measurements` table
5. Optionally update `skills.avgTokenCostMicrocents` denormalized aggregate

**Why server-side cost:** The pricing table lives in the server codebase and is easier to maintain/update. The hook shell script doesn't need pricing knowledge -- it just sends raw token counts.

### Pattern 5: Per-Skill Cost Aggregation

**What:** SQL aggregation query for skill detail page metrics.

**Query pattern (follows existing skill-metrics.ts style):**
```typescript
const costStats = await db
  .select({
    totalCostMicrocents: sql<number>`COALESCE(sum(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
    avgCostMicrocents: sql<number>`COALESCE(avg(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
    measurementCount: sql<number>`count(*)::int`,
    avgInputTokens: sql<number>`COALESCE(avg(${tokenMeasurements.inputTokens}), 0)::int`,
    avgOutputTokens: sql<number>`COALESCE(avg(${tokenMeasurements.outputTokens}), 0)::int`,
    predominantModel: sql<string>`mode() WITHIN GROUP (ORDER BY ${tokenMeasurements.modelName})`,
  })
  .from(tokenMeasurements)
  .where(eq(tokenMeasurements.skillId, skillId));
```

### Anti-Patterns to Avoid
- **Don't calculate cost in the hook shell script:** Pricing changes; keep it server-side
- **Don't store cost as floating point:** Use integer microcents for aggregation accuracy
- **Don't create a separate API endpoint for token data:** Extend existing `/api/track`
- **Don't require token data:** Make all token fields optional for backward compatibility
- **Don't try to track per-tool-use token deltas:** Transcript has cumulative per-API-call data; per-tool deltas would require maintaining state between hook invocations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pricing data | Custom API to fetch Anthropic prices | Static pricing table in code | Simpler, no external dependency, update on model releases |
| Token capture | Custom Claude Code extension | transcript_path parsing in existing hook | Hook system already deployed; transcript has the data |
| Cost aggregation | Custom cron job to compute averages | SQL aggregation at query time + denormalized column | Follow existing pattern (averageRating, totalUses) |
| Currency formatting | Custom formatter | `(microcents / 100_000_000).toFixed(4)` + Intl.NumberFormat | Standard approach, no library needed |

**Key insight:** The existing hook infrastructure (PostToolUse + /api/track) is already deployed to all skill users. This phase extends the payload, not the architecture.

## Common Pitfalls

### Pitfall 1: Cumulative vs. Delta Token Counts
**What goes wrong:** The transcript JSONL contains cumulative token counts per API call, not per-tool-use. If an assistant response triggers 3 tool uses, the PostToolUse hook fires 3 times, each reading the same cumulative token count.
**Why it happens:** Claude Code's internal accounting is per-API-call, not per-tool-call.
**How to avoid:** Either: (a) deduplicate on the server by checking if a measurement with the same token counts already exists for the same session, or (b) accept per-turn-per-skill granularity (which is the more useful metric anyway -- "how much did this skill cost per turn"), or (c) only capture on the FIRST tool use per assistant turn by tracking a flag.
**Warning signs:** Token counts that are identical across multiple measurements for the same skill in the same second.
**Recommendation:** Accept per-turn measurements. The deduplication approach is simplest: if a `token_measurements` row exists with the same `usageEventId` or same `skillId + inputTokens + outputTokens + modelName` within a 5-second window, skip the insert.

### Pitfall 2: Transcript File Not Accessible
**What goes wrong:** `transcript_path` might point to a file the hook process can't read, or the file might not exist yet early in a session.
**Why it happens:** Permissions, race conditions, or non-standard Claude Code configurations.
**How to avoid:** Always check `[ -f "$TP" ]` before reading. Fall back to sending the payload without token data (backward compatible).
**Warning signs:** All measurements have `model_name: "unknown"` and zero tokens.

### Pitfall 3: Shell Parsing Fragility
**What goes wrong:** Complex JSON parsing in bash is fragile. Edge cases with special characters, empty fields, or malformed JSONL lines can cause the hook to fail silently.
**Why it happens:** Shell string manipulation is not designed for structured data.
**How to avoid:** Use `jq` for all JSON operations. Use `2>/dev/null` fallbacks. Always have a default value for every parsed field. Keep the hook `async: true` so failures don't block Claude Code.
**Warning signs:** Hook errors visible in `Ctrl+O` verbose mode.

### Pitfall 4: Microcent Arithmetic Overflow
**What goes wrong:** Very large token counts (>100M tokens) multiplied by pricing rates could overflow 32-bit integers.
**Why it happens:** `integer` column in PostgreSQL is 32-bit, max ~2.1 billion.
**How to avoid:** Maximum realistic scenario: 1M tokens * 7.5 microcents/token = 7.5M microcents ($0.75). Even 100M tokens * 7.5 = 750M microcents. This fits comfortably in 32-bit int. For SUM aggregation over many measurements, consider checking that the total stays within range (2.1B microcents = $21,000 -- extremely unlikely per-skill).
**Warning signs:** Negative cost values in aggregation.

### Pitfall 5: Hook Frontmatter Migration
**What goes wrong:** Existing deployed skills have the old hook format (no transcript parsing). They continue sending payloads without token data.
**Why it happens:** Skills are deployed as files on user machines; updating requires re-deploy.
**How to avoid:** Make all token fields optional in the schema. The system works without token data (just no cost tracking). Users who re-deploy their skills get the new hook. Consider a migration path in the admin dashboard to flag skills with outdated hooks.
**Warning signs:** Low coverage of token measurements despite active skill usage.

### Pitfall 6: tac Command Not Available on macOS
**What goes wrong:** The `tac` command is a GNU coreutils tool and is NOT available by default on macOS.
**Why it happens:** macOS ships with BSD tools, not GNU coreutils.
**How to avoid:** Use `tail -r` on macOS, or use a portable alternative: `tail -n 50 "$TP" | grep '"model"' | tail -1`. Better yet: use `jq` to parse the last relevant entry.
**Warning signs:** Hook fails silently on macOS users' machines.

## Code Examples

### Example 1: Extended Hook Frontmatter (Portable)
```bash
# Source: Existing buildEverySkillFrontmatter pattern + transcript_path docs
INPUT=$(cat);
TN=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "unknown");
TP=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || echo "");
MODEL="unknown"; IN_TOK=0; OUT_TOK=0;
if [ -n "$TP" ] && [ -f "$TP" ]; then
  # Read last 100 lines, find most recent assistant message with model+usage
  LAST=$(tail -n 100 "$TP" | jq -r 'select(.message.model != null) | .message' 2>/dev/null | tail -n 1);
  if [ -n "$LAST" ]; then
    MODEL=$(echo "$LAST" | jq -r '.model // "unknown"' 2>/dev/null || echo "unknown");
    IN_TOK=$(echo "$LAST" | jq -r '.usage.input_tokens // 0' 2>/dev/null || echo "0");
    OUT_TOK=$(echo "$LAST" | jq -r '.usage.output_tokens // 0' 2>/dev/null || echo "0");
  fi;
fi;
PL="{\"skill_id\":\"SKILL_ID\",\"tool_name\":\"$TN\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"hook_event\":\"PostToolUse\",\"model_name\":\"$MODEL\",\"input_tokens\":$IN_TOK,\"output_tokens\":$OUT_TOK}";
```

### Example 2: Server-Side Token Measurement Insert
```typescript
// Source: Pattern follows existing insertTrackingEvent in packages/db/src/services/usage-tracking.ts
import { db } from "../client";
import { tokenMeasurements } from "../schema/token-measurements";
import { skills } from "../schema/skills";
import { eq, sql } from "drizzle-orm";
import { estimateCostMicrocents } from "./pricing-table";

export async function insertTokenMeasurement(input: {
  tenantId: string;
  skillId: string;
  userId: string;
  usageEventId?: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
}): Promise<void> {
  if (!db) return;
  try {
    const totalTokens = input.inputTokens + input.outputTokens;
    const costMicrocents = estimateCostMicrocents(
      input.modelName,
      input.inputTokens,
      input.outputTokens
    );

    await db.insert(tokenMeasurements).values({
      tenantId: input.tenantId,
      skillId: input.skillId,
      userId: input.userId,
      usageEventId: input.usageEventId,
      modelName: input.modelName,
      modelProvider: "anthropic",
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens,
      estimatedCostMicrocents: costMicrocents,
      latencyMs: input.latencyMs,
      source: "hook",
    });

    // Update denormalized avgTokenCostMicrocents on skill
    if (costMicrocents !== null) {
      await db.update(skills).set({
        avgTokenCostMicrocents: sql`(
          SELECT COALESCE(avg(estimated_cost_microcents), 0)::int
          FROM token_measurements
          WHERE skill_id = ${input.skillId}
        )`,
        updatedAt: new Date(),
      }).where(eq(skills.id, input.skillId));
    }
  } catch (error) {
    console.error("Failed to insert token measurement:", error);
  }
}
```

### Example 3: Cost Stats for Skill Detail Page
```typescript
// Source: Follows getSkillStats pattern in apps/web/lib/skill-stats.ts
export interface SkillCostStats {
  totalCostMicrocents: number;
  avgCostPerUseMicrocents: number;
  measurementCount: number;
  predominantModel: string | null;
}

export async function getSkillCostStats(skillId: string): Promise<SkillCostStats> {
  if (!db) {
    return { totalCostMicrocents: 0, avgCostPerUseMicrocents: 0, measurementCount: 0, predominantModel: null };
  }
  const result = await db
    .select({
      totalCost: sql<number>`COALESCE(sum(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
      avgCost: sql<number>`COALESCE(avg(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
      count: sql<number>`count(*)::int`,
      topModel: sql<string>`mode() WITHIN GROUP (ORDER BY ${tokenMeasurements.modelName})`,
    })
    .from(tokenMeasurements)
    .where(eq(tokenMeasurements.skillId, skillId));

  return {
    totalCostMicrocents: result[0]?.totalCost ?? 0,
    avgCostPerUseMicrocents: result[0]?.avgCost ?? 0,
    measurementCount: result[0]?.count ?? 0,
    predominantModel: result[0]?.topModel ?? null,
  };
}

// Display helper: convert microcents to readable format
export function formatCostMicrocents(microcents: number): string {
  if (microcents === 0) return "$0.00";
  const dollars = microcents / 100_000_000;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(2)}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No token data in hooks | `transcript_path` provides access to token data | Claude Code hooks v2 (2025) | Enables cost tracking without custom extensions |
| Honor-system MCP logging | PostToolUse hooks with async curl | Phase 28 (2026-02-08) | Deterministic, invisible tracking |
| No cost estimation | Static pricing table | This phase | Per-skill cost visibility |

**What's NOT available (verified):**
- PostToolUse hook payload does NOT include `token_count`, `model_name`, `latency`, or `cost` fields directly
- Claude Code does NOT expose granular token data in the statusline JSON (only `cost.total_cost_usd` at session level)
- There is no per-tool-use token accounting -- only per-API-call cumulative counts in the transcript

## Open Questions

1. **Transcript parsing reliability across platforms**
   - What we know: transcript_path is a common field in all hook inputs (verified in official docs). The JSONL format includes `message.model` and `message.usage` fields (verified via multiple analysis tools).
   - What's unclear: Whether the JSONL structure is stable/guaranteed across Claude Code versions, or if it's an internal format subject to change.
   - Recommendation: Parse defensively with fallbacks. All token fields are optional, so if parsing fails, the system degrades gracefully to tracking without cost data.

2. **Token count deduplication strategy**
   - What we know: Multiple PostToolUse firings within the same assistant turn will read the same cumulative token counts.
   - What's unclear: Best deduplication approach -- time-window-based, session_id-based, or accept duplicates.
   - Recommendation: Start simple -- accept all measurements. Add deduplication in a follow-up if data analysis shows excessive duplication. The cost of duplicate measurements is low (slightly inflated per-skill cost estimates that can be refined).

3. **Latency measurement**
   - What we know: TOKEN-04 requires latency tracking. The hook can measure time between receiving input and completing (wall-clock latency of the tool), but this measures the TOOL latency, not the LLM latency.
   - What's unclear: Whether LLM API latency is available in the transcript.
   - Recommendation: For v1, capture `total_duration_ms` from the `cost` statusline object if accessible, or skip latency initially and add it when Claude Code exposes it. Tool latency is measurable but not the primary metric users care about.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Complete PostToolUse input schema, common input fields including `transcript_path`
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) - PostToolUse lifecycle, matchers, async hooks
- [Anthropic Model Pricing](https://platform.claude.com/docs/en/about-claude/pricing) - All model pricing verified 2026-02-15
- [Anthropic Models Overview](https://platform.claude.com/docs/en/docs/about-claude/models) - Model IDs and aliases

### Secondary (MEDIUM confidence)
- [Claude Code Token Usage Issue #11535](https://github.com/anthropics/claude-code/issues/11535) - Statusline JSON structure with cost fields
- [Claude Code Context Calculation](https://codelynx.dev/posts/calculate-claude-code-context) - Transcript JSONL field structure (input_tokens, output_tokens, model)
- [Claude Code Log Analysis with DuckDB](https://liambx.com/blog/claude-code-log-analysis-with-duckdb) - Complete JSONL entry schema: type, message.model, message.usage

### Tertiary (LOW confidence)
- [ccusage CLI tool](https://github.com/ryoppippi/ccusage) - Parses same JSONL format, confirms field names
- [claude-code-log](https://github.com/daaain/claude-code-log) - Python parser for transcript format

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns exist in codebase
- Architecture (API extension): HIGH - Extending existing /api/track with optional fields is straightforward
- Architecture (hook modification): MEDIUM - transcript_path access is documented, but JSONL format is not officially guaranteed
- Pricing table: HIGH - Verified directly from official Anthropic pricing page
- Pitfalls: HIGH - Well-documented concerns from prior research and Claude Code community
- Cost aggregation UI: HIGH - Follows existing StatCard pattern exactly

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- pricing changes are the main risk, and those are backward-compatible)
