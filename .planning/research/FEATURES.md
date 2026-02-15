# Feature Landscape: v5.0 Feedback, Training & Benchmarking

**Domain:** AI skill feedback loops, training data collection, LLM tool benchmarking
**Researched:** 2026-02-15
**Overall confidence:** MEDIUM-HIGH (feedback UX patterns well-established; token measurement via PostToolUse hooks has confirmed limitations requiring investigation; golden dataset patterns well-documented; benchmarking dashboard patterns proven)

## Context

EverySkill is at v3.0+ with a mature skill marketplace. v5.0 closes the loop from skill usage to skill improvement by adding feedback collection, training data pipelines, and benchmarking dashboards.

**Existing infrastructure being extended:**

| System | What Exists | What v5.0 Adds |
|--------|-------------|----------------|
| **Ratings** | 1-5 stars with comments, `hours_saved_estimate` per rating, `ratings` table | Thumbs up/down in Claude, improvement suggestions, structured feedback |
| **PostToolUse hooks** | Fire on every MCP tool call, send `tool_name`, `skill_id`, `ts`, input/output snippets to `/api/track` | Feedback prompt injection, token/cost capture (if available), smart frequency |
| **Usage events** | `usage_events` table with `toolName`, `skillId`, `userId`, JSONB `metadata` | Richer metadata: feedback signal, token counts, model name, latency |
| **Fork system** | Fork-based versioning, "Fork & Improve" with AI review, `forkedFromId`, content hash drift detection | Suggestion-to-fork pipeline: user suggestions auto-generate draft forks |
| **AI review** | `skill_reviews` with quality/clarity/completeness scores, `modelName` field | Benchmark comparison: same skill scored by different models |
| **Quality scores** | Gold/Silver/Bronze badges, usage(50%) + rating(35%) + docs(15%) formula | Quality score enriched with feedback sentiment and benchmark data |
| **Analytics** | Org-wide trends, per-employee tables, skill leaderboards, CSV export | Per-skill benchmarking: tokens, cost, quality by model version |

---

## Feature Area 1: In-Claude Feedback via MCP Hook

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Thumbs up/down after skill execution | Users expect the simplest possible feedback mechanism in their workflow | MEDIUM | PostToolUse hook modification |
| Smart frequency (not every time) | Constant prompts kill UX; first 3 uses, then every 10th | LOW | Counter in hook metadata or local state |
| Optional text feedback on thumbs down | "What went wrong?" is essential for actionable data | MEDIUM | Hook must surface a prompt to Claude |
| Feedback stored with usage context | Feedback without context (which skill, what input, what model) is useless | LOW | Existing `usage_events.metadata` JSONB |

**How PostToolUse hooks work for this (verified via official docs):**

The PostToolUse hook receives JSON on stdin containing:
```json
{
  "session_id": "abc123",
  "tool_name": "mcp__everyskill__everyskill",
  "tool_input": { "action": "search", "query": "..." },
  "tool_response": { "success": true, "skills": [...] },
  "tool_use_id": "toolu_01ABC123..."
}
```

The hook can return JSON on stdout with `additionalContext` to inject a feedback prompt into Claude's context:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "After completing this task, ask the user: 'Was this skill helpful? (thumbs up/down)'"
  }
}
```

**Critical limitation (HIGH confidence):** PostToolUse hooks do NOT receive token counts, model name, or cost data. The `tool_response` contains whatever the MCP tool returned, not Anthropic API metadata. Token/cost measurement must come from a different mechanism (see Feature Area 5).

**Implementation approach:**

The existing tracking hook (auto-injected into skill frontmatter) already fires PostToolUse callbacks to `/api/track`. Extend this hook to:

1. Track a local use counter per skill (file-based or env var)
2. On qualifying uses (1st, 2nd, 3rd, then every 10th), return `additionalContext` asking Claude to solicit feedback
3. Claude asks: "Was [skill name] helpful? (thumbs up / thumbs down)"
4. User responds; Claude calls a new MCP tool `everyskill.feedback` to record it
5. Feedback is stored in a new `skill_feedback` table or as structured metadata in `usage_events`

**UX pattern (modeled after LangWatch and Microsoft Copilot Studio):**

The LangWatch pattern uses: `trace_id` to correlate feedback with execution, `vote` (1/-1), and optional `feedback` text. Microsoft Copilot Studio similarly provides thumbs up/down reactions directly on agent responses with aggregated analytics.

For EverySkill in Claude, the flow is:
```
1. User uses skill via MCP
2. PostToolUse hook fires (smart frequency check)
3. Hook injects additionalContext: "Ask the user for brief feedback on [skill]"
4. Claude asks naturally: "How was the [skill]? Quick thumbs up or down?"
5. User: "thumbs up" or "it was off, the output format was wrong"
6. Claude: [calls everyskill.feedback with vote=1 or vote=-1 + reason]
7. Stored with skill_id, user_id, usage_event_id, model context
```

**What to avoid:**
- Do NOT ask for feedback on every single use. Users will disable the hook. Smart frequency (first 3, then every 10th) is critical.
- Do NOT block the user's workflow to collect feedback. The hook injects context; Claude asks naturally. If the user ignores it, move on.
- Do NOT try to collect structured forms via MCP. Thumbs up/down + optional text is the ceiling for in-Claude feedback.

**Confidence:** MEDIUM-HIGH. The PostToolUse hook mechanism is well-documented and already used for usage tracking. The `additionalContext` injection pattern is the correct approach. The main risk is whether users will actually respond to feedback prompts in Claude.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sentiment aggregation per skill | "85% positive over last 30 days" displayed on skill page | LOW | Aggregation query on feedback data |
| Feedback-triggered notifications | Author notified when skill gets negative feedback | LOW | Existing notification system |
| Auto-skip for consistently positive skills | Stop asking once a skill has 10+ thumbs up and >90% positive | LOW | Threshold logic in hook |

---

## Feature Area 2: Web Feedback with Improvement Suggestions

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Structured feedback form on skill detail page | Web UI supports richer feedback than in-Claude thumbs up/down | MEDIUM | New component on skill detail page |
| Improvement suggestion text area | "This skill would be better if..." drives specific improvements | LOW | Text field with validation |
| Category tags (output quality, missing feature, error, too slow) | Structured categories enable aggregate analysis | LOW | Multi-select tags |
| Suggestion visibility to skill author | Authors must see feedback to act on it | LOW | Query + display component |

**Expected UX Flow:**

```
Skill detail page (/skills/[slug]):
  Existing: Star rating (1-5) with comment + hours saved estimate
  New section: "Improvement Suggestions"

  1. User clicks "Suggest an Improvement"
  2. Form appears (inline accordion, not modal):
     - Category: [Output quality] [Missing feature] [Error/bug] [Too slow] [Other]
     - Suggestion: "The output should include source citations..."
     - Severity: [Nice to have] [Important] [Critical]
  3. Submit stores suggestion with user_id, skill_id, category, text
  4. Author sees suggestion count badge on their skill management page
  5. Author can: Accept (triggers fork), Dismiss (with reason), or Reply
```

**How this differs from the existing rating system:**

The existing `ratings` table captures retrospective evaluation (how good was this?). Improvement suggestions capture prospective direction (how should this change?). They are complementary:

| Existing Ratings | New Suggestions |
|-----------------|-----------------|
| 1-5 stars | Category tags |
| "Great tool!" (comment) | "Add CSV export support" (actionable) |
| Hours saved estimate | Severity indicator |
| One per user per skill | Multiple per user per skill |

**Data model recommendation:**

New `skill_suggestions` table:
```sql
id TEXT PK
tenant_id TEXT NOT NULL FK tenants
skill_id TEXT NOT NULL FK skills
user_id TEXT NOT NULL FK users
category TEXT NOT NULL  -- 'output_quality' | 'missing_feature' | 'error' | 'performance' | 'other'
suggestion TEXT NOT NULL
severity TEXT NOT NULL DEFAULT 'nice_to_have'  -- 'nice_to_have' | 'important' | 'critical'
status TEXT NOT NULL DEFAULT 'open'  -- 'open' | 'accepted' | 'dismissed' | 'implemented'
author_response TEXT  -- Author's reply
created_at TIMESTAMP NOT NULL DEFAULT NOW()
resolved_at TIMESTAMP
```

**What to avoid:**
- Do NOT merge suggestions into the existing `ratings` table. They serve different purposes and have different schemas.
- Do NOT build a full issue tracker. Suggestions have 4 statuses max (open/accepted/dismissed/implemented). No assignees, no due dates, no priority levels beyond severity.
- Do NOT allow anonymous suggestions. All feedback tied to authenticated users for accountability and anti-spam.

**Confidence:** HIGH. Improvement suggestion UX follows established patterns from UserVoice, Canny, and feature request tools. The implementation is straightforward: new table, form component, author notification.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Suggestion voting | Other users upvote suggestions: "I want this too" | LOW | Vote counter on suggestions |
| AI-generated improvement plan | LLM reads top suggestions and drafts improvement plan | MEDIUM | Structured output from existing Anthropic SDK |
| Public suggestion board per skill | Transparency: users see what's been suggested and status | LOW | Filtered view of suggestions table |

---

## Feature Area 3: Suggestion-to-Fork Pipeline

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| "Accept" on suggestion auto-creates draft fork | Bridge from feedback to action without manual copy-paste | MEDIUM | Existing `forkSkill()` action + new trigger |
| Suggestion context injected into fork | Fork pre-populated with improvement context from the suggestion | LOW | Pass suggestion text to fork metadata |
| Author notification queue | Author sees pending suggestions that could become forks | LOW | Existing notification system |
| Link back from fork to originating suggestion | Traceability: which suggestion drove which improvement | LOW | FK `suggestion_id` on skills or fork metadata |

**Expected UX Flow:**

```
1. User submits suggestion: "Add error handling for malformed input"
   - Stored in skill_suggestions table (Feature Area 2)

2. Author views suggestion on skill management page
   - Sees: category, text, severity, user who submitted, date
   - Actions: [Accept & Fork] [Dismiss] [Reply]

3. Author clicks "Accept & Fork":
   a. System calls existing forkSkill() with additional context
   b. Fork is created as draft with:
      - Original skill content
      - Suggestion text prepended as a comment: "// Improvement: Add error handling..."
      - If "Fork & Improve" is selected, AI review auto-triggered with suggestion as guidance
   c. suggestion.status set to 'accepted'
   d. Notification sent to suggestion author: "Your suggestion was accepted!"

4. Author iterates on fork, publishes improved version
   - suggestion.status set to 'implemented'
   - Notification: "The improvement you suggested has been published!"

5. Original suggestion author can rate the implementation
```

**How this extends the existing fork system:**

The existing `forkSkill()` action (in `apps/web/app/actions/fork-skill.ts`) already:
- Creates a new skill with `forkedFromId` pointing to parent
- Copies content, tags, category from parent
- Generates embedding for the fork
- Supports `?improve=1` query param for auto-triggered AI review

The suggestion-to-fork pipeline adds:
- A trigger from the suggestion UI (instead of manual "Fork" button)
- Suggestion context injected into the fork's initial content or metadata
- Status tracking linking suggestion to resulting fork

**Depends on:** Feature Area 2 (suggestions table must exist first)

**What to avoid:**
- Do NOT auto-create forks from every suggestion. Only author-accepted suggestions should generate forks.
- Do NOT allow suggestions to modify the original skill directly. All improvements go through the fork flow for proper versioning and review.
- Do NOT build a merge-back workflow yet. Forks are independent skills. A future milestone could add "merge upstream" if needed.

**Confidence:** HIGH. This is a thin orchestration layer over two existing features (suggestions + forks). The main new work is the UI trigger and status tracking.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-assisted fork from suggestion | LLM applies the suggestion to the skill content automatically | HIGH | Uses existing AI review infrastructure |
| Community-driven improvement queue | Most-upvoted suggestions surface first for author attention | LOW | Sort by vote count |
| Suggestion leaderboard | "Top Improvers" -- users whose suggestions led to published improvements | LOW | Join suggestions -> forks -> published |

---

## Feature Area 4: Training Data (Golden Dataset)

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Author-seeded input/output pairs per skill | Authors define "this is what good output looks like" | MEDIUM | New table + form on skill edit page |
| Structured golden format: input, expected_output, context, expected_tools | Industry-standard format (matches deepeval, LangSmith, Confident AI) | LOW | Schema design matching ecosystem standards |
| Real usage capture (with permission) | Actual usage data is more representative than author examples | HIGH | Consent flow + usage event enrichment |
| Export as JSON/CSV for external evaluation | Training data must be portable to evaluation tools | LOW | API endpoint + download |

**What a golden dataset looks like (based on deepeval/Confident AI patterns):**

A golden is a test case without runtime outputs -- it defines what the ideal behavior should be:

```json
{
  "skill_id": "code-review-helper",
  "goldens": [
    {
      "input": "Review this Python function for security issues: def login(user, pwd): ...",
      "expected_output": "Found 2 security issues: 1. Password stored in plaintext...",
      "context": "Enterprise security review context",
      "expected_tools": ["everyskill"],
      "additional_metadata": {
        "category": "security_review",
        "difficulty": "medium",
        "author_verified": true,
        "created_by": "author"
      }
    }
  ]
}
```

At evaluation time, the golden is augmented with runtime data:
- `actual_output`: What the LLM actually produced
- `tools_called`: What tools were actually invoked
- `model`: Which model was used
- `tokens`: Input/output token counts
- `latency_ms`: Time to completion

**Data model recommendation:**

New `skill_training_data` table:
```sql
id TEXT PK
tenant_id TEXT NOT NULL FK tenants
skill_id TEXT NOT NULL FK skills
created_by TEXT NOT NULL FK users
source TEXT NOT NULL  -- 'author_seeded' | 'usage_captured' | 'ai_generated'
input TEXT NOT NULL
expected_output TEXT
context TEXT
expected_tools TEXT[]
additional_metadata JSONB
is_verified BOOLEAN DEFAULT false  -- Author has verified this example
created_at TIMESTAMP NOT NULL DEFAULT NOW()
```

New `skill_eval_results` table (for captured runtime data):
```sql
id TEXT PK
tenant_id TEXT NOT NULL FK tenants
training_data_id TEXT FK skill_training_data  -- Null for ad-hoc captures
skill_id TEXT NOT NULL FK skills
actual_output TEXT NOT NULL
model_name TEXT NOT NULL
input_tokens INTEGER
output_tokens INTEGER
latency_ms INTEGER
quality_score NUMERIC  -- LLM-as-judge or human rating
evaluated_at TIMESTAMP NOT NULL DEFAULT NOW()
```

**Expected UX Flow:**

```
Author perspective (seeding golden data):
  1. Navigate to skill edit page
  2. New "Training Examples" tab
  3. Click "Add Example"
  4. Fill in: Input (required), Expected Output (required), Context (optional)
  5. Example saved to skill_training_data
  6. Can add multiple examples (recommend 5-10 per skill)
  7. Each example shows "Verified" checkbox

Usage capture perspective (with consent):
  1. Admin enables "Training Data Collection" in tenant settings
  2. Users see consent banner: "Your usage data may be used to improve skills"
  3. On each MCP tool use, if consent is given:
     a. Input snippet (already captured via hook)
     b. Output snippet (already captured via hook)
     c. Model name (from hook context if available)
     d. User's thumbs up/down (from Feature Area 1)
  4. Positive-rated usage events (thumbs up) are candidates for golden data
  5. Author can "promote" a usage capture to verified golden example
```

**The consent model is critical:**

| Level | What's Captured | Who Decides |
|-------|----------------|-------------|
| Off | Nothing beyond existing usage events | Admin per tenant |
| Anonymous | Aggregated patterns only (no individual data) | Admin per tenant |
| Opt-in | Individual usage with user consent | User opt-in |
| Full | All usage data captured for training | Enterprise agreement |

**What to avoid:**
- Do NOT capture full input/output by default. This requires explicit consent due to data sensitivity.
- Do NOT build a full evaluation pipeline in v5.0. Store the data in golden dataset format; running evaluations against it is a future milestone.
- Do NOT require training data for skill publishing. It's an optional enhancement for skill quality.
- Do NOT conflate training data with the existing `usage_events` table. Training data has different schema needs (expected_output, verification status) and different retention requirements.

**Confidence:** MEDIUM. The golden dataset format is well-established (deepeval, LangSmith, Confident AI all use similar structures). The risk is in the consent/capture pipeline -- this touches privacy concerns and requires careful UX.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-generated golden examples | LLM generates training pairs from skill content | MEDIUM | Uses existing Anthropic SDK |
| Training data completeness score | "This skill has 3/10 recommended examples" | LOW | Count query |
| Cross-skill evaluation | Run same golden set across similar skills to compare | HIGH | Requires evaluation runner (future) |

---

## Feature Area 5: Token/Cost Measurement

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Token count capture per skill execution | Foundation for cost calculation | HIGH | PostToolUse hook limitations -- see below |
| Model name capture | Different models have different costs | MEDIUM | Must extract from available context |
| Estimated cost calculation | Translate tokens to dollars using pricing tables | LOW | Static pricing lookup |
| Per-skill cost aggregation | "This skill costs ~$0.03 per use on average" | LOW | Aggregation query on captured data |

**Critical technical constraint (HIGH confidence):**

The PostToolUse hook's `tool_response` contains what the MCP tool returned, NOT Anthropic API metadata. The hook does NOT receive:
- `input_tokens` / `output_tokens`
- Model name
- Cache hit rates
- API response headers

This means token/cost data cannot be captured directly from the existing PostToolUse tracking hook.

**Viable approaches for token measurement:**

| Approach | How | Accuracy | Complexity | Recommendation |
|----------|-----|----------|------------|----------------|
| **A. Estimate from content length** | Count characters/words in tool_input and tool_response, estimate tokens using ~4 chars/token rule | LOW | LOW | Fallback only |
| **B. Token counting API** | Call Anthropic's `/v1/messages/count_tokens` endpoint with the tool input/output | HIGH for input | MEDIUM | Good for input tokens |
| **C. Session transcript analysis** | PostToolUse hook receives `transcript_path` -- parse the JSONL transcript for token usage data | HIGH | HIGH | Best accuracy if transcript contains usage data |
| **D. Client-side instrumentation** | Modify the MCP client wrapper to capture API response headers before forwarding to the hook | HIGH | HIGH | Requires changes to user-side code |
| **E. Proxy approach** | Route API calls through a LiteLLM-style proxy that logs token usage | HIGH | HIGH | Infrastructure change, out of scope for v5.0 |

**Recommended approach: Combination of A + B + C**

1. **Always capture content length estimates** (approach A) as a baseline -- cheap, always available
2. **Use Anthropic token counting API** (approach B) for input token measurement when the skill's input is known
3. **Investigate transcript parsing** (approach C) during phase research -- the `transcript_path` field in every hook input points to a JSONL file that may contain API usage data

The `transcript_path` is the most promising lead: every hook receives it, and Claude Code's transcript likely logs token usage per turn. If the transcript contains `usage.input_tokens` and `usage.output_tokens` per API call, we can correlate these with tool invocations by `tool_use_id`.

**Model name capture:**

The PostToolUse hook does NOT receive model name directly. Options:
1. **Session-level**: The `SessionStart` hook receives `model` field -- store it in a file, read from PostToolUse hooks
2. **Transcript parsing**: The transcript likely contains model information per API call
3. **MCP tool response**: The EverySkill MCP tool could include the model name in its response metadata

**Cost calculation:**

Once tokens and model are known, cost is a lookup:

```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-opus-4-6": { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
  "claude-haiku-3-5": { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
};
// Blended price using Artificial Analysis 3:1 input:output ratio
const blendedCost = (inputTokens * pricing.input * 3 + outputTokens * pricing.output) / 4;
```

**Data model extension:**

Extend `usage_events.metadata` JSONB to include:
```json
{
  "existing_fields": "...",
  "token_measurement": {
    "input_tokens": 1234,
    "output_tokens": 567,
    "measurement_method": "transcript_parse|api_count|estimate",
    "model_name": "claude-sonnet-4-5",
    "estimated_cost_usd": 0.0123,
    "latency_ms": 2340
  }
}
```

No new table needed -- enriching the existing `usage_events.metadata` JSONB is sufficient.

**What to avoid:**
- Do NOT block on getting perfect token counts. Estimates are useful. Ship estimates, improve accuracy over time.
- Do NOT build a pricing management UI. Hardcode current Anthropic pricing. Update when prices change.
- Do NOT try to capture costs for non-Anthropic models in v5.0. Start with Claude models only.

**Confidence:** LOW-MEDIUM. The PostToolUse hook definitely does not provide token data directly. The transcript parsing approach is the most promising but unverified -- this needs phase-specific research to confirm what data the `transcript_path` JSONL actually contains.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cost alerting | "This skill costs >$0.10 per use, consider optimization" | LOW | Threshold check on aggregated costs |
| Cost comparison across models | "Same skill: $0.02 on Haiku, $0.15 on Opus" | MEDIUM | Requires multi-model data |
| Org-wide cost dashboard | "Total AI spend this month: $X across Y skill uses" | LOW | Aggregation of per-use costs |

---

## Feature Area 6: Benchmarking Dashboard

### Table Stakes

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Per-skill benchmark view | Show tokens, cost, quality score for each skill | MEDIUM | Feature Area 5 (token data) + existing quality scores |
| Model comparison table | Same skill's metrics across different model versions | MEDIUM | Model name capture from Feature Area 5 |
| Time series of cost/quality trends | "This skill got cheaper and better over the last month" | LOW | Existing Recharts infrastructure |
| Blended price calculation | Industry-standard 3:1 input:output ratio for comparison | LOW | Static calculation |

**Dashboard layout (modeled after Artificial Analysis, Klu, Vellum leaderboards):**

```
/skills/[slug]/benchmarks (new tab on skill detail page)

+--------------------------------------------------+
| Benchmark: Code Review Helper                     |
| Period: [7d] [30d] [90d] [1y]                    |
+--------------------------------------------------+
|                                                    |
| Quick Stats                                        |
| +-----------+----------+---------+----------+      |
| | Avg Cost  | Avg Tkns | Quality | Feedback |      |
| | $0.023    | 1,234    | Gold    | 92% pos  |      |
| +-----------+----------+---------+----------+      |
|                                                    |
| Model Comparison                                   |
| +--------+-------+--------+-------+---------+      |
| | Model  | Uses  | Tokens | Cost  | Quality |      |
| +--------+-------+--------+-------+---------+      |
| | Sonnet | 145   | 1,100  | $0.02 | 8.5/10  |      |
| | Opus   | 23    | 1,450  | $0.15 | 9.2/10  |      |
| | Haiku  | 67    | 980    | $0.005| 7.1/10  |      |
| +--------+-------+--------+-------+---------+      |
|                                                    |
| Cost & Quality Trend            [Recharts]         |
| [Line chart: cost per use over time]               |
| [Line chart: feedback score over time]             |
|                                                    |
| Recent Evaluations (from golden dataset)           |
| +--------+-------+--------+--------+              |
| | Input  | Model | Score  | Cost   |              |
| | "Rev..."| Son  | Pass   | $0.02  |              |
| | "Rev..."| Opus | Pass   | $0.14  |              |
| +--------+-------+--------+--------+              |
+--------------------------------------------------+
```

**Key metrics displayed (following Artificial Analysis methodology):**

| Metric | Source | Calculation |
|--------|--------|-------------|
| Average cost per use | `usage_events.metadata.token_measurement` | `AVG(estimated_cost_usd)` grouped by skill |
| Average tokens | Same source | `AVG(input_tokens + output_tokens)` |
| Quality score | Existing `skill_reviews.categories` | Weighted average of quality/clarity/completeness |
| Feedback sentiment | Feature Area 1 (thumbs up/down) | `positive_count / total_count * 100` |
| Model distribution | Model name from usage events | `COUNT(*) GROUP BY model_name` |
| Cost trend | Time series of per-use costs | Recharts AreaChart (existing pattern) |
| Time to first token | Latency capture from hooks | `AVG(latency_ms)` when available |

**How this integrates with the existing analytics dashboard:**

The existing analytics dashboard (`/analytics`) shows org-wide usage: total hours saved, active employees, skill leaderboard. The benchmarking view is per-skill (on the skill detail page), not org-wide. They are complementary:

- `/analytics` answers: "How is the org using EverySkill?"
- `/skills/[slug]/benchmarks` answers: "How well does this specific skill perform?"

**What to avoid:**
- Do NOT try to replicate Artificial Analysis or LLM Stats. Those compare models across standardized benchmarks. EverySkill compares models within the context of a specific skill's usage.
- Do NOT display raw token counts to end users. Show cost (dollars) as the primary metric, tokens as the secondary detail. Users care about cost, not tokens.
- Do NOT build interactive benchmark comparisons (select model A vs model B scatter plot). Start with a simple table + trend chart. Add interactivity if users request it.

**Confidence:** MEDIUM. The dashboard UI patterns are well-established (Recharts already used for analytics). The main risk is data availability -- the dashboard is only useful if Feature Area 5 (token measurement) successfully captures data.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skill cost optimization recommendations | "Switch to Haiku for this skill -- quality is comparable, 85% cheaper" | MEDIUM | Cross-model quality comparison |
| Org-wide benchmarking roll-up | "Average cost per skill use across the org: $0.04" | LOW | Aggregation across all skills |
| Golden dataset evaluation runner | Auto-run golden examples against new model versions | HIGH | Future milestone -- requires evaluation orchestration |

---

## Anti-Features

Features to explicitly NOT build. Tempting but counterproductive.

| Anti-Feature | Why Tempting | Why Problematic | Do Instead |
|--------------|-------------|-----------------|------------|
| **Full LLM evaluation pipeline** | "Run evals automatically on every model release" | Enormous scope. Requires eval runner, scoring pipeline, model API integration, result comparison. This is what LangSmith/deepeval/LangWatch do. | Store golden datasets in standard format. Export for use in external eval tools. Build runner in future milestone. |
| **Inline skill editing from feedback** | "Let users fix the skill right from the feedback form" | Bypasses the quality review pipeline. Unreviewed edits to published skills breaks the entire governance model. | Suggestion-to-fork pipeline. Improvements go through fork + review. |
| **Real-time token usage streaming** | "Show live token counter as skill executes" | Requires client-side instrumentation, WebSocket connection, significant UI complexity. Not worth the engineering cost. | Post-hoc token measurement. Show aggregated data on benchmarking dashboard. |
| **Multi-provider cost comparison** | "Compare Claude vs GPT vs Gemini costs" | EverySkill skills are Claude-native (MCP protocol). Supporting multiple providers requires different skill formats, API integrations, and evaluation frameworks. | Claude-only cost tracking. If multi-provider is needed later, build as separate milestone. |
| **Automated skill improvement from feedback** | "AI reads negative feedback and auto-improves the skill" | Unsupervised AI editing of production skills is dangerous. Quality regression, hallucinated improvements, loss of author intent. | AI-assisted fork from suggestion (author reviews before publishing). Human in the loop always. |
| **Feedback gamification** | "Points for feedback, badges for top feedback givers" | Incentivizes quantity over quality. Users submit garbage feedback to earn points. | Show feedback impact: "Your suggestion led to 3 improvements used by 45 people." |
| **Detailed per-request cost attribution to employees** | "Show each employee how much their AI usage costs" | Creates anxiety about using AI tools. Defeats the purpose of driving adoption. | Aggregate cost data at skill and org level, not per-employee. |

---

## Feature Dependencies

```
[In-Claude Feedback] (#1)
    |--extends---> existing PostToolUse tracking hook
    |--creates---> new everyskill.feedback MCP tool
    |--creates---> feedback storage (new table or metadata extension)
    |--depends on--> existing usage_events table
    |--independent of--> web feedback (#2)

[Web Feedback / Suggestions] (#2)
    |--creates---> skill_suggestions table
    |--creates---> suggestion form component
    |--extends---> skill detail page
    |--independent of--> in-Claude feedback (#1)
    |--blocks----> Suggestion-to-Fork Pipeline (#3)

[Suggestion-to-Fork Pipeline] (#3)
    |--requires---> Web Feedback (#2) for suggestions table
    |--extends----> existing forkSkill() action
    |--extends----> existing notification system
    |--requires---> Feature Area 2 suggestions to exist

[Training Data / Golden Dataset] (#4)
    |--creates---> skill_training_data table
    |--creates---> training examples form on skill edit page
    |--optional---> usage capture consent flow
    |--benefits from--> in-Claude feedback (#1) for quality signals
    |--independent of--> suggestion pipeline (#3)

[Token/Cost Measurement] (#5)
    |--extends---> PostToolUse tracking hook
    |--enriches--> usage_events.metadata
    |--requires--> Phase research on transcript_path parsing
    |--independent of--> feedback features (#1, #2, #3)
    |--blocks----> Benchmarking Dashboard (#6) for cost data

[Benchmarking Dashboard] (#6)
    |--requires--> Token/Cost Measurement (#5) for cost data
    |--requires--> existing quality scores (quality_score.ts)
    |--benefits from--> in-Claude feedback (#1) for sentiment data
    |--benefits from--> Training Data (#4) for eval results
    |--extends---> skill detail page (new tab)
    |--reuses----> existing Recharts infrastructure
```

### Critical Path

```
Wave 1 (parallel, no dependencies):
    In-Claude Feedback (#1) -- extends existing hook
    Web Feedback / Suggestions (#2) -- new table + form
    Token/Cost Measurement (#5) -- research + hook extension

Wave 2 (depends on Wave 1):
    Suggestion-to-Fork Pipeline (#3) -- requires #2
    Training Data (#4) -- benefits from #1, independent otherwise

Wave 3 (depends on Wave 1+2):
    Benchmarking Dashboard (#6) -- requires #5, benefits from #1 and #4
```

---

## MVP Recommendation

### Must Have for v5.0

**In-Claude Feedback (build in Wave 1):**
- [ ] `everyskill.feedback` MCP tool accepting vote (1/-1) + optional text
- [ ] PostToolUse hook smart frequency (first 3 uses, then every 10th)
- [ ] `additionalContext` injection asking Claude to solicit feedback
- [ ] Feedback stored in `usage_events.metadata` or new `skill_feedback` table
- [ ] Feedback sentiment aggregation on skill detail page

**Web Suggestions (build in Wave 1):**
- [ ] `skill_suggestions` table with category, text, severity, status
- [ ] Suggestion form on skill detail page (inline accordion)
- [ ] Author view of suggestions with Accept/Dismiss/Reply actions
- [ ] Notification to author on new suggestions

**Suggestion-to-Fork (build in Wave 2):**
- [ ] "Accept & Fork" button on suggestion triggers `forkSkill()` with context
- [ ] Suggestion status tracking (open -> accepted -> implemented)
- [ ] Notification to suggestion author on accept/implement

**Token/Cost Measurement (build in Wave 1, research first):**
- [ ] Investigate `transcript_path` JSONL for token usage data
- [ ] Content-length-based token estimation as fallback
- [ ] Model name capture via SessionStart hook or transcript
- [ ] Cost calculation using hardcoded Anthropic pricing
- [ ] Enriched `usage_events.metadata` with token_measurement object

**Benchmarking Dashboard (build in Wave 3):**
- [ ] Per-skill benchmark tab on skill detail page
- [ ] Quick stats: avg cost, avg tokens, quality score, feedback sentiment
- [ ] Model comparison table (if multi-model data available)
- [ ] Cost trend chart (Recharts AreaChart)

### Defer to Post-v5.0

- [ ] **Training data / golden dataset**: Valuable but complex consent pipeline. Seed with author examples in v5.0; usage capture requires careful privacy engineering.
- [ ] **Evaluation runner**: Running golden examples against models is a dedicated tool (LangSmith, deepeval). Export data to these tools rather than building a runner.
- [ ] **Cross-skill benchmarking**: Comparing skills against each other requires normalized metrics. Build after per-skill benchmarking is validated.
- [ ] **AI-generated golden examples**: LLM generates training pairs from skill content. Useful but secondary to author-seeded examples.
- [ ] **Suggestion voting**: Upvoting suggestions is nice-to-have. Build if suggestion volume warrants prioritization.
- [ ] **Cost alerting**: Threshold notifications for expensive skills. Build after baseline cost data is established.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| In-Claude feedback (thumbs up/down) | HIGH (closes feedback loop) | MEDIUM | MEDIUM (user adoption) | P0 |
| Web suggestions form | HIGH (actionable improvements) | LOW | LOW | P0 |
| Suggestion-to-fork pipeline | HIGH (feedback -> action) | LOW | LOW | P0 |
| Token/cost measurement | HIGH (ROI visibility) | HIGH | HIGH (data availability) | P0 |
| Benchmarking dashboard | MEDIUM (power users, admins) | MEDIUM | MEDIUM (depends on data) | P0 |
| Training data storage | MEDIUM (future eval capability) | MEDIUM | MEDIUM (consent/privacy) | P1 |
| Author-seeded golden examples | MEDIUM (quality improvement) | LOW | LOW | P1 |
| Feedback sentiment aggregation | MEDIUM (skill health signal) | LOW | LOW | P1 |
| Suggestion voting | LOW (scale feature) | LOW | LOW | P2 |
| Evaluation runner | HIGH (if built) | HIGH | HIGH (scope) | P3 (future) |
| Multi-provider cost comparison | LOW (Claude-only platform) | HIGH | MEDIUM | P3 (future) |

---

## Sources

### PostToolUse Hook Architecture (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Complete hook event schema, PostToolUse input/output format, `additionalContext` injection, `transcript_path` availability
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Practical hook configuration examples
- [Claude Blog: How to Configure Hooks](https://claude.com/blog/how-to-configure-hooks) -- PostToolUse patterns

### LLM Feedback Collection (HIGH confidence)
- [LangWatch: Thumbs Up/Down API](https://langwatch.ai/docs/user-events/thumbs-up-down) -- `trace_id` + `vote` (1/-1) + optional `feedback` text pattern
- [Langfuse: User Feedback](https://langfuse.com/docs/observability/features/user-feedback) -- Feedback capture and aggregation patterns
- [Microsoft Copilot Studio: Feedback Collection](https://learn.microsoft.com/en-us/power-platform/release-plan/2025wave1/microsoft-copilot-studio/collect-thumbs-up-or-down-feedback-comments-agents) -- Enterprise agent feedback UX
- [NN/g: User Feedback Requests Guidelines](https://www.nngroup.com/articles/user-feedback/) -- UX best practices for feedback collection

### Golden Dataset / Training Data (HIGH confidence)
- [Confident AI: Test Cases, Goldens, and Datasets](https://www.confident-ai.com/docs/llm-evaluation/core-concepts/test-cases-goldens-datasets) -- Golden structure: input, expected_output, context, expected_tools
- [deepeval: Evaluation Datasets](https://deepeval.com/docs/evaluation-datasets) -- Dataset format, tool_calls, expected_tools parameters
- [Sigma AI: Golden Datasets](https://sigma.ai/golden-datasets/) -- Quality requirements for golden data
- [Maxim AI: Building a Golden Dataset](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/) -- Step-by-step golden dataset creation
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation) -- Annotation queues, trace-to-dataset conversion

### LLM Benchmarking Dashboards (HIGH confidence)
- [Artificial Analysis Methodology](https://artificialanalysis.ai/methodology) -- Cost metrics (3:1 input:output blended), speed metrics (TTFT, output speed), quality benchmarks
- [Klu AI LLM Leaderboard](https://klu.ai/llm-leaderboard) -- Real-world performance + cost + speed comparison
- [Vellum LLM Leaderboard](https://www.vellum.ai/llm-leaderboard) -- Price, context window, capability comparison

### Token/Cost Tracking (MEDIUM confidence)
- [Langfuse: Token and Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) -- PostgreSQL-based cost tracking architecture
- [LiteLLM with PostgreSQL](https://medium.com/@hithasrinivas4/tracking-llm-usage-spend-with-litellm-postgresql-and-litellm-ui-8ca9e6773f17) -- Token usage dashboard with PostgreSQL
- [Anthropic: Messages API](https://docs.anthropic.com/en/api/messages) -- Usage response fields: input_tokens, output_tokens, cache tokens
- [Anthropic: Token Counting API](https://docs.anthropic.com/en/api/messages-count-tokens) -- Pre-request token estimation endpoint

### Feature Request / Suggestion Pipelines (MEDIUM confidence)
- [Canny: Feature Request Management](https://canny.io/use-cases/feature-request-management) -- Suggestion collection, voting, status tracking
- [UserVoice / Supahub / Frill patterns](https://supahub.com/blog/feature-voting-tools) -- Feature voting tool landscape
- [Userpilot: Feature Requests](https://userpilot.com/blog/feature-request/) -- In-app feedback collection patterns

### Existing Codebase (HIGH confidence)
- `packages/db/src/schema/usage-events.ts` -- UsageEvent with JSONB metadata, tenant isolation
- `packages/db/src/services/usage-tracking.ts` -- `insertTrackingEvent()` with hook metadata
- `apps/web/app/api/track/route.ts` -- API endpoint receiving hook callbacks with `tool_input_snippet`, `tool_output_snippet`
- `apps/web/lib/quality-score.ts` -- QualityScoreResult: usage(50%) + rating(35%) + docs(15%)
- `packages/db/src/schema/ratings.ts` -- 1-5 stars with comment and hours_saved_estimate
- `apps/web/app/actions/fork-skill.ts` -- `forkSkill()` with content hash, embedding generation, version tracking
- `apps/web/lib/analytics-queries.ts` -- Recharts-ready time series, employee breakdown, skill usage
- `apps/mcp/src/tracking/events.ts` -- `trackUsage()` with audit log, skill use increment
- `apps/mcp/src/server.ts` -- McpServer with everyskill-skills name

---

*Feature research for: EverySkill v5.0 Feedback, Training & Benchmarking*
*Researched: 2026-02-15*
*Confidence: HIGH for feedback UX (thumbs up/down, suggestions, suggestion-to-fork -- all well-established patterns with existing infrastructure). MEDIUM for benchmarking dashboards (UI patterns proven, data availability uncertain). LOW-MEDIUM for token measurement (PostToolUse hook confirmed to not provide token data; transcript_path approach unverified). MEDIUM for golden datasets (format well-documented, consent pipeline needs careful design).*
