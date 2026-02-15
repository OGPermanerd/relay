# Requirements: EverySkill v5.0 Feedback, Training & Benchmarking

**Defined:** 2026-02-15
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v5.0 Requirements

Requirements for Feedback, Training & Benchmarking milestone. Each maps to roadmap phases.

### Schema Foundation

- [ ] **SCHEMA-01**: New `skill_feedback` table stores thumbs up/down votes, suggestions, and training examples with `feedbackType` discriminator
- [ ] **SCHEMA-02**: New `token_measurements` table with typed integer columns for inputTokens, outputTokens, estimatedCostMicrocents, latencyMs, modelName
- [ ] **SCHEMA-03**: New `benchmark_runs` table for benchmark execution metadata (who triggered, models tested, aggregate results)
- [ ] **SCHEMA-04**: New `benchmark_results` table for per-test-case results (model, input, output, tokens, quality score) with cascade delete from runs
- [ ] **SCHEMA-05**: Denormalized aggregate columns on `skills` table (total_feedback, positive_feedback_pct, avg_token_cost_microcents)
- [ ] **SCHEMA-06**: Payload sanitization utility detects and strips secrets (API keys, passwords, tokens) from feedback and tracking data
- [ ] **SCHEMA-07**: All new tables include tenant_id with RLS policies following existing multi-tenancy pattern

### In-Claude Feedback

- [ ] **FDBK-01**: User can give thumbs up/down feedback on a skill via MCP `feedback` action in Claude
- [ ] **FDBK-02**: PostToolUse hook injects `additionalContext` prompting Claude to ask user for feedback with smart frequency (first 3 uses, then every 10th)
- [ ] **FDBK-03**: User can include optional text comment with thumbs up/down vote
- [ ] **FDBK-04**: `/api/feedback` endpoint with Bearer auth, Zod validation, and rate limiting
- [ ] **FDBK-05**: Feedback sentiment aggregation displayed on skill detail page ("85% positive over last 30 days")
- [ ] **FDBK-06**: Feedback trend visible in skill metrics (positive/negative ratio over time)

### Web Feedback & Suggestions

- [ ] **SUGGEST-01**: User can submit improvement suggestion on skill detail page with category (output quality, missing feature, error, performance, other)
- [ ] **SUGGEST-02**: Suggestions include severity indicator (nice to have, important, critical)
- [ ] **SUGGEST-03**: Skill author sees pending suggestions with Accept/Dismiss/Reply actions
- [ ] **SUGGEST-04**: Suggestion status tracks through lifecycle (open -> accepted -> dismissed -> implemented)
- [ ] **SUGGEST-05**: Author receives notification when new suggestion is submitted on their skill
- [ ] **SUGGEST-06**: Suggester receives notification when their suggestion status changes

### Suggestion-to-Fork Pipeline

- [ ] **SFORK-01**: Author can "Accept & Fork" a suggestion, creating a fork pre-populated with suggestion context
- [ ] **SFORK-02**: For small changes, author can create new skill_version inline without full fork
- [ ] **SFORK-03**: Accepted suggestion links to resulting fork or version for traceability
- [ ] **SFORK-04**: Suggestion status automatically updates to "implemented" when linked fork/version is published

### Training Data / Golden Dataset

- [ ] **TRAIN-01**: Author can seed golden examples (input/expected_output pairs) on skill detail page
- [ ] **TRAIN-02**: Golden examples stored in skill_feedback table with feedbackType='training_example'
- [ ] **TRAIN-03**: Real usage data can be captured as training examples with explicit per-user opt-in consent
- [ ] **TRAIN-04**: Captured training data sanitized for secrets before storage
- [ ] **TRAIN-05**: Training example count displayed on skill detail page
- [ ] **TRAIN-06**: Tenant-level opt-in setting controls whether usage capture is available

### Token/Cost Measurement

- [ ] **TOKEN-01**: Token counts (input + output) captured per skill execution via PostToolUse hook or transcript parsing
- [ ] **TOKEN-02**: Cost estimation calculated using static Anthropic pricing table (model -> $/MTok)
- [ ] **TOKEN-03**: Model name captured per execution for accurate cost attribution
- [ ] **TOKEN-04**: Latency (ms) tracked per skill execution
- [ ] **TOKEN-05**: Enriched `/api/track` payload accepts optional token_count, model_name, latency_ms fields (backward-compatible)
- [ ] **TOKEN-06**: Per-skill cost aggregation visible on skill detail page (avg cost per use, total cost)

### Benchmarking Dashboard

- [ ] **BENCH-01**: Per-skill "Benchmark" tab on skill detail page showing key metrics
- [ ] **BENCH-02**: Quick stats display: avg cost, avg tokens, quality score, feedback sentiment
- [ ] **BENCH-03**: Model comparison table when multi-model data is available
- [ ] **BENCH-04**: Cost trend chart (Recharts AreaChart) showing cost over time
- [ ] **BENCH-05**: Admin can trigger benchmark run (async execution with polling for results)
- [ ] **BENCH-06**: Cross-model benchmark execution using Anthropic SDK (Claude), with optional OpenAI and Google AI SDKs
- [ ] **BENCH-07**: AI-judged quality scoring with anti-bias measures (cross-model evaluation, pairwise comparison)
- [ ] **BENCH-08**: Benchmark staleness detection (90-day warning, "Re-benchmark" button)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Extended Evaluation

- **EVAL-01**: Full LLM evaluation runner with golden dataset export to external tools (deepeval, LangSmith)
- **EVAL-02**: Cross-skill benchmarking with normalized comparison across skills
- **EVAL-03**: AI-generated golden examples from skill content
- **EVAL-04**: Suggestion voting (upvotes from other users)

### Extended Workspace Integration

- **GWORK-01**: Google Calendar integration for meeting time analysis
- **GWORK-02**: Google Drive integration for document collaboration patterns
- **GWORK-03**: Periodic re-analysis with progress tracking over time

### AI Independence

- **AIIND-01**: Translate/port skills to other LLMs (Google, Llama, on-prem)
- **AIIND-02**: Real-time token streaming (post-hoc measurement sufficient for now)
- **AIIND-03**: Per-employee cost attribution (deferred — creates anxiety, defeats adoption goal)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time token streaming | Post-hoc measurement is sufficient; streaming adds complexity |
| Per-employee cost attribution | Creates anxiety, defeats adoption goal |
| Multi-provider cost comparison | Claude-only pricing sufficient for v5.0 |
| Suggestion voting/upvotes | Low value without large user base; defer |
| Full LLM evaluation runner | Store golden data now, export to external eval tools later |
| AI-generated golden examples | Author-seeded + usage-captured is sufficient |
| LangChain/LiteLLM abstraction | Direct SDKs simpler for 3 providers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| _(to be filled by roadmapper)_ | | |

**Coverage:**
- v5.0 requirements: 38 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 38

---
*Requirements defined: 2026-02-15*
