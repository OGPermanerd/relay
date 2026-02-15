# Technology Stack: Feedback Loop, Training Data & Benchmarking

**Project:** EverySkill - AI Independence & Feedback Loop
**Researched:** 2026-02-15
**Overall confidence:** HIGH
**Scope:** Stack additions for feedback loop, training data, token measurement, and benchmarking features. Existing stack unchanged (Next.js 16.1.6, PostgreSQL + pgvector, Drizzle ORM 0.42.0, Auth.js v5, MCP SDK, Anthropic SDK, Recharts 3.7.0).

---

## Executive Summary

This milestone requires minimal new npm dependencies. Every core capability is achievable with the existing stack. The Anthropic SDK already provides token counting via `response.usage`. Recharts handles all visualization needs. Drizzle ORM supports the new table definitions including JSONB typed columns. The only new dependencies are OpenAI and Google AI SDKs for cross-LLM benchmarking -- and those are optional (benchmarking can start with Anthropic-only).

Key technical findings:

1. **Token counting** is built into every Anthropic API response via `response.usage` (`input_tokens`, `output_tokens`). The existing `@anthropic-ai/sdk` already returns this -- we just need to capture it. For pre-flight estimation, `client.messages.countTokens()` is free and available.

2. **PostToolUse hook payload** provides `tool_name`, `tool_input`, `tool_response`, `session_id`, and `tool_use_id` via stdin JSON. The existing hook in `deploy.ts` already extracts `tool_name` -- extending it for richer data capture is a configuration change.

3. **Cost calculation** uses a static pricing table (model -> $/MTok) applied to token counts. The Anthropic Usage/Cost API requires Admin API keys and provides org-level aggregates only -- not suitable for per-skill tracking.

4. **Cross-LLM benchmarking** requires OpenAI and Google AI SDKs. These are lightweight, well-maintained, and only used server-side. No client bundle impact.

---

## Recommended Stack

### Core Framework (NO CHANGES)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 16.1.6 | App framework, server actions, API routes | Already installed |
| Drizzle ORM | 0.42.0 | Database ORM with pgPolicy support | Already installed |
| PostgreSQL | 15+ | Database with pgvector, RLS | Already running |
| Zod | 3.25+ | Schema validation | Already installed |
| Recharts | 3.7.0 | Dashboard charts | Already installed |

### AI & Token Measurement (EXTEND)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @anthropic-ai/sdk | 0.72+ | Claude API calls + `response.usage` token counting | Already installed; `response.usage` provides per-request token counts |
| openai | New dep | GPT model API calls for cross-LLM benchmarking | Official SDK, lightweight, needed for multi-model comparison |
| @google/generative-ai | New dep | Gemini model API calls for cross-LLM benchmarking | Official SDK, needed for multi-model comparison |

### Supporting Libraries (MINIMAL NEW)

| Library | Purpose | Why This One |
|---------|---------|-------------|
| diff | Text diffs for suggestion review UI | Standard diff library, used for showing suggested content changes vs original |

### Infrastructure (NO CHANGES)

| Technology | Version | Purpose | Why No Change |
|------------|---------|---------|---------------|
| @modelcontextprotocol/sdk | 1.26+ | MCP server with PostToolUse hooks | Already configured in skill frontmatter |
| Node.js crypto (built-in) | - | HMAC signing for hook callbacks | Already used in `apps/web/lib/hmac.ts` |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Token counting | `response.usage` from SDK | `@anthropic-ai/tokenizer` npm | v0.0.4, 3 years stale, inaccurate for Claude 3+ |
| Token estimation | `client.messages.countTokens()` | tiktoken (OpenAI) | Different tokenizer, approximate only, extra dependency |
| Cost tracking | Static pricing table | Anthropic Usage/Cost API | Requires admin key, org-level only, 5-min delay |
| Multi-model SDK | Individual SDKs per provider | LangChain / LiteLLM | Heavy abstraction for 3 simple API calls. Direct SDKs give full control |
| Job queue (benchmarks) | Detached Promise + polling | pg-boss / BullMQ | Overkill at current scale. Add later if benchmark volume justifies |
| Analytics aggregation | Cron + PostgreSQL | TimescaleDB / ClickHouse | Premature, volume is low, PostgreSQL handles aggregation fine |
| Feedback collection | Custom table + routes | Sentry / PostHog | Product analytics tools, not skill-specific feedback |
| Training data storage | PostgreSQL JSONB | MongoDB / DynamoDB | Already have PostgreSQL, JSONB is sufficient |
| Benchmarking visualization | Recharts (existing) | Grafana / Chart.js / D3 | Recharts already handles all chart types needed |
| LLM evaluation | Simple AI-judged scoring | promptfoo / langsmith | Adds operational complexity and vendor lock-in for features buildable in ~50 lines |

---

## Token Counting Implementation

### Per-Request (Actual)

Every `client.messages.create()` call returns `response.usage`:

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  messages: [{ role: "user", content: "..." }],
});

// response.usage = {
//   input_tokens: 150,
//   output_tokens: 423,
//   cache_creation_input_tokens: 0,
//   cache_read_input_tokens: 0,
// }
```

**Current gap:** `apps/web/lib/ai-review.ts` and `apps/web/lib/skill-recommendations.ts` call `client.messages.create()` but discard `response.usage`. Fix: wrap to extract and store.

### Pre-Flight (Estimate)

```typescript
const estimate = await client.messages.countTokens({
  model: "claude-sonnet-4-5-20250929",
  messages: [{ role: "user", content: "..." }],
});
// { input_tokens: 14 }
```

Free (no charges), rate-limited (100-8000 RPM by tier).

**Do NOT use `@anthropic-ai/tokenizer`:** v0.0.4, published 3+ years ago, explicitly inaccurate for Claude 3+ models.

---

## Cost Calculation

Static pricing table applied to token counts. Updated at deploy time (pricing changes are infrequent).

```typescript
// apps/web/lib/anthropic-pricing.ts
export const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-haiku-4-5":    { inputPerMTok: 1.00,  outputPerMTok: 5.00 },
  "claude-sonnet-4-5":   { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
  "claude-opus-4-6":     { inputPerMTok: 5.00,  outputPerMTok: 25.00 },
  // OpenAI and Google pricing added when benchmarking those models
};

export function estimateCostMicrocents(
  model: string, inputTokens: number, outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const costUsd = (inputTokens / 1_000_000) * pricing.inputPerMTok
                + (outputTokens / 1_000_000) * pricing.outputPerMTok;
  return Math.round(costUsd * 100 * 1000); // convert to microcents
}
```

**Why NOT Anthropic Usage/Cost API:** Requires Admin API key (`sk-ant-admin...`), provides org-level aggregates only, 5-min delay, cannot attribute cost to specific skills.

---

## PostToolUse Hook Payload (Verified)

The PostToolUse hook receives this JSON on stdin:

```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "..." },
  "tool_response": { "filePath": "/path/to/file.txt", "success": true },
  "tool_use_id": "toolu_01ABC123..."
}
```

**Key fields for training data:** `tool_input` and `tool_response` provide input/output pairs. `session_id` groups events. `tool_use_id` enables deduplication.

**Important limitation:** The hook does NOT receive conversation-level token counts. Token measurement from hooks is limited to what we can infer. Primary token data comes from benchmark runs and direct MCP API calls.

---

## Environment Variables (New)

```env
# apps/web/.env.local
OPENAI_API_KEY=sk-...           # For GPT benchmarks (optional)
GOOGLE_AI_API_KEY=AIza...       # For Gemini benchmarks (optional)
# ANTHROPIC_API_KEY already exists
```

---

## Installation

```bash
# New dependencies (optional -- only needed for cross-LLM benchmarking)
cd apps/web && pnpm add openai @google/generative-ai diff
cd apps/web && pnpm add -D @types/diff

# Schema changes
pnpm db:migrate
```

---

## Sources

### HIGH Confidence
- Anthropic Token Counting API -- `client.messages.countTokens()`, free, all active models
- Anthropic Pricing -- per-model $/MTok verified from docs
- Existing codebase (read directly): `apps/mcp/src/tools/deploy.ts`, `apps/web/app/api/track/route.ts`, `apps/web/lib/ai-review.ts`

### MEDIUM Confidence
- Anthropic Messages API -- `response.usage` object structure (verified via SDK types)
- PostToolUse hook input schema (verified from Claude Code hooks documentation)

### LOW Confidence
- OpenAI and Google AI SDK integration patterns -- standard but not verified against latest versions
