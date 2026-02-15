# Project Research Summary

**Project:** EverySkill v5.0 — Feedback, Training & Benchmarking
**Domain:** AI skill feedback loops, training data pipelines, token/cost measurement, cross-LLM benchmarking
**Researched:** 2026-02-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

EverySkill v5.0 closes the loop from skill usage to skill improvement. The milestone adds four interconnected capabilities: in-session and web-based feedback collection, a suggestion-to-fork improvement pipeline, token/cost measurement for ROI visibility, and a per-skill benchmarking dashboard. The research concludes that this milestone requires almost zero new infrastructure -- the existing stack (Next.js 16.1.6, Drizzle ORM 0.42.0, PostgreSQL + pgvector, Anthropic SDK, Recharts, MCP server) handles every requirement. The only new npm dependencies are `openai` and `@google/generative-ai` for optional cross-LLM benchmarking, plus `diff` for suggestion review UI. The Anthropic SDK already provides token counting via `response.usage`; Recharts already handles all visualization; and the existing PostToolUse hook pipeline, fork system, and rating infrastructure provide the foundation for every new feature.

The recommended approach is to build in three waves based on dependency analysis. Wave 1 (parallel) builds the feedback table schema, the in-Claude feedback mechanism via a new MCP `feedback` action, the web suggestion form, and token measurement infrastructure. Wave 2 adds the suggestion-to-fork pipeline (which requires the suggestion table from Wave 1) and author-seeded training data. Wave 3 delivers the benchmarking dashboard (which requires token/cost data from Wave 1 and benefits from feedback sentiment data). This ordering ensures each wave delivers standalone value while building toward the integrated benchmarking dashboard.

The primary risk is token measurement accuracy. PostToolUse hooks do NOT provide token counts, model name, or API metadata -- this was confirmed across all four research files with HIGH confidence. Token data must come from alternative sources: the Anthropic `response.usage` field on direct API calls, the `transcript_path` JSONL file (promising but unverified), or content-length estimation as a fallback. The secondary risk is feedback fatigue -- prompting users too often or in the wrong context will cause them to disable the hook entirely. Smart frequency gating (first 3 uses, then every 10th) and using the MCP tool pattern (not PostToolUse output injection) are the mitigations. A tertiary risk is data privacy: extending usage tracking to capture richer feedback data requires sanitization (secrets in tool_input), consent (GDPR), and tenant isolation (training data must never leak across tenants).

## Key Findings

### Recommended Stack

No significant stack changes needed. The existing infrastructure handles every requirement. See `.planning/research/STACK.md` for full details.

**Core technologies (unchanged):**
- **Next.js 16.1.6**: App framework, server actions, API routes -- all feedback forms and benchmark dashboard pages
- **Drizzle ORM 0.42.0**: New table definitions (skill_feedback, token_measurements, benchmark_runs, benchmark_results) with pgPolicy RLS
- **PostgreSQL 15+ with pgvector**: Structured tables with indexed integer columns for token aggregation -- NOT JSONB blobs
- **Anthropic SDK 0.72+**: `response.usage` for token counting, `client.messages.countTokens()` for pre-flight estimation
- **Recharts 3.7.0**: Benchmark dashboard charts (bar charts, area charts, trend lines)
- **MCP SDK 1.26+**: New `feedback` action on the existing `everyskill` unified tool

**New dependencies (minimal):**
- **openai** (npm): GPT API calls for cross-LLM benchmarking -- optional, only needed if multi-model comparison is desired
- **@google/generative-ai** (npm): Gemini API calls for benchmarking -- optional
- **diff** (npm): Text diff display for suggestion review UI

**Critical finding:** Do NOT use `@anthropic-ai/tokenizer` (v0.0.4, 3 years stale, inaccurate for Claude 3+). Do NOT use tiktoken for Claude token estimation. Do NOT add LangChain/LiteLLM for multi-model calls -- direct SDKs are simpler for 3 providers.

### Expected Features

See `.planning/research/FEATURES.md` for full feature landscape with dependency analysis.

**Must have (table stakes):**
- **In-Claude thumbs up/down feedback** via new MCP `feedback` action with smart frequency gating
- **Web suggestion form** on skill detail page (category tags, severity, actionable text)
- **Suggestion-to-fork pipeline** ("Accept & Fork" triggers existing `forkSkill()` with suggestion context)
- **Token/cost measurement** captured per skill execution with cost estimation
- **Per-skill benchmarking dashboard** showing avg cost, tokens, quality score, feedback sentiment, model comparison table, and cost trend chart

**Should have (differentiators):**
- **Feedback sentiment aggregation** ("85% positive over last 30 days") on skill detail page
- **Author notification** on new suggestions with Accept/Dismiss/Reply actions
- **Suggestion status tracking** (open -> accepted -> implemented) with notification to suggester
- **Author-seeded golden dataset examples** (input/expected_output pairs for future evaluation)
- **Org-wide cost dashboard** aggregating per-skill costs

**Defer to post-v5.0:**
- **Full LLM evaluation runner** (store golden datasets, export to external eval tools like deepeval/LangSmith)
- **Cross-skill benchmarking** (normalized comparison across skills)
- **AI-generated golden examples** from skill content
- **Suggestion voting** (upvotes from other users)
- **Real-time token streaming** (post-hoc measurement is sufficient)
- **Multi-provider cost comparison** (Claude-only for now)
- **Per-employee cost attribution** (creates anxiety, defeats adoption goal)

### Architecture Approach

The architecture extends the existing monorepo with 4 new database tables, 1 new API endpoint, 1 new MCP action, and 3 new web pages -- all following established patterns. See `.planning/research/ARCHITECTURE.md` for full schema definitions and data flow diagrams.

**Major components:**
1. **`skill_feedback` table** (discriminated union) -- Single table with `feedbackType` discriminator for thumbs up/down, suggestions, training examples, and bug reports. Shares lifecycle (pending -> reviewed -> approved/rejected) and relations (skill, user, version, usage_event). Avoids the anti-pattern of separate tables per feedback type.
2. **`token_measurements` table** (structured, indexed) -- Dedicated table with typed integer columns for `inputTokens`, `outputTokens`, `estimatedCostMicrocents`, `latencyMs`, `modelName`. NOT in `usage_events.metadata` JSONB (aggregation queries on JSONB are slow and unindexable).
3. **`benchmark_runs` + `benchmark_results` tables** -- Two-table design: run metadata (who triggered, models tested, aggregate results) separate from per-test-case results (model, input, output, tokens, quality score). Cascade delete from runs to results.
4. **MCP `feedback` action** -- Added to existing `everyskill` unified tool. Claude invokes `everyskill action:feedback` with vote/comment after the PostToolUse hook injects `additionalContext` prompting it to ask the user.
5. **`/api/feedback` endpoint** -- Separate from `/api/track` (different validation, rate limiting, and response needs). Bearer auth same as `/api/track`.
6. **Denormalized aggregates on `skills` table** -- `total_feedback`, `positive_feedback_pct`, `training_example_count`, `latest_benchmark_run_id`, `avg_token_cost_microcents` for O(1) dashboard reads.

**Key architectural decisions:**
- Benchmarks run asynchronously via detached Promise + polling (server actions timeout at ~30s, a 3-model x 5-case benchmark takes 30-75s)
- Feedback from MCP goes through `/api/feedback` (validated, structured response), not `/api/track` (fire-and-forget)
- Suggestion merge creates a new `skill_version` for owner-approved changes; fork path only for substantially different variants

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 14 pitfalls with detailed prevention strategies.

1. **Secret leakage in feedback payloads (CRITICAL)** -- PostToolUse hooks run unsandboxed with full user permissions. Extending data capture to include `tool_input` content risks transmitting API keys, passwords, and credentials to EverySkill's database. **Prevent:** Client-side and server-side sanitization of known secret patterns, aggressive 1000-char snippet limits, never capture full `tool_input.content` for Write operations, opt-in consent flag (`EVERYSKILL_TRAINING_DATA=true`).

2. **GDPR consent and right-to-erasure conflict (CRITICAL)** -- Training data collection from real usage requires explicit consent. Users exercising right-to-erasure need all their training examples deleted and benchmark scores recalculated. Cross-tenant training data contamination violates multi-tenant isolation. **Prevent:** Separate usage tracking from training data, tenant-level opt-in + per-user opt-out, implement full data erasure pipeline, 12-month retention policy.

3. **PostToolUse hooks CANNOT solicit user input (CRITICAL)** -- Hook output goes to Claude (not the user), cannot block, cannot collect interactive responses. **Prevent:** Use the MCP `feedback` tool for structured feedback collection. The hook injects `additionalContext` that prompts Claude to ask the user, then Claude calls the feedback MCP tool. The user approves the tool call via normal Claude Code permissions.

4. **Token counting is model-specific (HIGH)** -- Each LLM tokenizes differently. Anthropic has no local tokenizer; the Token Counting API is the only accurate source but is rate-limited (100-8000 RPM by tier). **Prevent:** Store token counts per model, use Anthropic API for Claude, model-specific tokenizers for others, cache aggressively (only re-count when skill content hash changes).

5. **Benchmark invalidation on model updates (HIGH)** -- Model weights change silently behind the same API endpoint. Old benchmarks show stale numbers. **Prevent:** Record exact model version string with date suffix, add `benchmarkedAt` timestamp, implement 90-day staleness warning, version-lock evaluation prompts.

## Implications for Roadmap

Based on combined research, the milestone should be structured as **6 phases across 3 implementation waves**.

### Phase 1: Schema Foundation and Data Sanitization
**Rationale:** Every subsequent phase depends on the new tables. Schema design must come first (PITFALLS.md Pitfall 9). Sanitization pipeline is a prerequisite for any richer data collection (PITFALLS.md Pitfall 1). This phase has no external dependencies and establishes the foundation.
**Delivers:**
- 4 new database tables: `skill_feedback`, `token_measurements`, `benchmark_runs`, `benchmark_results`
- Denormalized aggregate columns on `skills` table
- Migrations 0030-0033 following existing pattern
- Schema exports, relations, TypeScript types
- Sanitization utilities for secret detection in payloads
- Extended `/api/track` Zod schema (backward-compatible optional fields)
**Addresses:** Features: none directly (infrastructure). Architecture: all table definitions, migration strategy. Pitfalls: 1 (sanitization), 9 (structured tables vs JSONB).

### Phase 2: In-Claude Feedback Collection
**Rationale:** Feedback is the highest-value, lowest-risk feature. It extends the existing PostToolUse hook and MCP tool with well-understood patterns. Must be built before the suggestion pipeline (Phase 4) or benchmarking dashboard (Phase 6) since both benefit from feedback data.
**Delivers:**
- New `feedback` action on the `everyskill` MCP tool (thumbs up/down + optional comment)
- PostToolUse hook `additionalContext` injection with smart frequency (first 3 uses, then every 10th)
- `/api/feedback` endpoint with Bearer auth, Zod validation, rate limiting
- `skill_feedback` service layer (insert, query by skill, aggregate sentiment)
- Denormalized feedback aggregates on `skills` table
**Addresses:** Features: In-Claude feedback (#1), feedback sentiment aggregation. Pitfalls: 5 (feedback fatigue via smart frequency), 7 (hook cannot solicit input -- use MCP tool instead), 13 (async timing -- keep hooks silent).

### Phase 3: Web Feedback and Suggestions
**Rationale:** Web feedback provides richer structured input than in-Claude thumbs up/down. Can be built in parallel with Phase 2 (no shared dependencies). Must exist before the suggestion-to-fork pipeline (Phase 4).
**Delivers:**
- Suggestion form component on skill detail page (inline accordion, not modal)
- Category tags (output quality, missing feature, error, performance, other)
- Severity indicator (nice to have, important, critical)
- Author view of pending suggestions with Accept/Dismiss/Reply actions
- Author notification on new suggestions
- Suggestion status tracking (open/accepted/dismissed/implemented)
**Addresses:** Features: Web feedback (#2), author notification. Pitfalls: 6 (fork spam -- suggestions are NOT forks, separate table with quality gates).

### Phase 4: Suggestion-to-Fork Pipeline
**Rationale:** Connects feedback to action. Requires Phase 3 (suggestions table must exist). Thin orchestration layer over two existing features (suggestions + forks).
**Delivers:**
- "Accept & Fork" button on suggestion triggers `forkSkill()` with suggestion context
- New `skill_version` creation for owner-approved changes (simpler path)
- Fork creation with suggestion attribution for substantial changes
- Notification to suggestion author on accept/implement
- Status lifecycle: suggestion -> accepted -> fork created -> implemented
**Addresses:** Features: Suggestion-to-fork pipeline (#3). Architecture: fork system integration. Pitfalls: 6 (only author-accepted suggestions generate forks, not auto-generated).

### Phase 5: Token/Cost Measurement
**Rationale:** Requires phase-specific research on `transcript_path` JSONL contents (unverified). Independent of feedback features (Phases 2-4) but blocks the benchmarking dashboard (Phase 6). Higher technical risk than other phases.
**Delivers:**
- Investigation of `transcript_path` JSONL for token usage data
- Content-length-based token estimation as fallback
- Model name capture via SessionStart hook or transcript parsing
- Cost calculation using hardcoded Anthropic pricing table (model -> $/MTok)
- Token measurement insertion into `token_measurements` table
- Enriched `/api/track` payload with optional `token_count`, `model_name`, `latency_ms`
- Rate limiter adjustment for enriched payloads (batch endpoint or increased limit)
**Addresses:** Features: Token/cost measurement (#5), per-skill cost aggregation. Stack: Anthropic `response.usage`, static pricing table. Pitfalls: 3 (model-specific token counting), 10 (rate limiter throttling), 11 (cost estimate staleness).

### Phase 6: Benchmarking Dashboard
**Rationale:** Final phase -- requires token/cost data (Phase 5) and benefits from feedback sentiment (Phase 2) and training data (golden examples). Highest complexity but also highest integration payoff.
**Delivers:**
- Per-skill benchmark tab on skill detail page (`/skills/[slug]/benchmark`)
- Quick stats: avg cost, avg tokens, quality score, feedback sentiment
- Model comparison table (if multi-model data available from usage events)
- Cost trend chart (Recharts AreaChart following existing analytics patterns)
- Benchmark run trigger (async with polling, admin-only initially)
- Cross-model benchmark execution using Anthropic, OpenAI, Google AI SDKs
- AI-judged quality scoring with anti-bias measures (cross-model evaluation, pairwise comparison)
- Benchmark staleness detection (90-day warning, "Re-benchmark" button)
**Addresses:** Features: Benchmarking dashboard (#6). Stack: OpenAI SDK, Google AI SDK (optional). Architecture: benchmark_runs + benchmark_results tables, async execution. Pitfalls: 4 (model version invalidation), 8 (LLM-as-judge bias), 14 (API tier limits).

### Phase Ordering Rationale

- **Phase 1 (Schema) must come first** because every other phase writes to the new tables. Schema design before implementation prevents the JSONB blob anti-pattern (Pitfall 9).
- **Phases 2 and 3 can run in parallel** (Wave 1) because they have no shared database tables or code paths. In-Claude feedback writes to `skill_feedback` via MCP; web suggestions write to `skill_feedback` via server actions. Same table, independent code paths.
- **Phase 4 depends on Phase 3** because suggestion-to-fork requires the suggestions table and UI to exist.
- **Phase 5 is independent of Phases 2-4** but should run in Wave 2 alongside Phase 4 to parallelize work. It has the highest technical uncertainty (transcript_path parsing) so starting it earlier allows time for investigation.
- **Phase 6 depends on Phase 5** for cost/token data and benefits from Phases 2-3 for sentiment data. It should be the final phase.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Token/Cost Measurement):** The `transcript_path` JSONL file is the most promising source for accurate token data, but its contents are unverified. Phase research must investigate what data the transcript contains, whether it includes `usage.input_tokens`/`usage.output_tokens` per API call, and how to correlate transcript entries with `tool_use_id`. If transcript parsing fails, the fallback is content-length estimation (LOW accuracy) supplemented by Anthropic Token Counting API calls (HIGH accuracy but rate-limited).
- **Phase 6 (Benchmarking Dashboard):** LLM-as-judge evaluation methodology needs validation. Research should determine the evaluation prompt, scoring rubric, and anti-bias measures before storing any quality scores. Also verify Anthropic API tier for rate limit capacity.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Schema Foundation):** All table definitions are fully specified in ARCHITECTURE.md. Migration pattern is established (0030-0033). No unknowns.
- **Phase 2 (In-Claude Feedback):** PostToolUse hook `additionalContext` injection pattern is verified from official Claude Code docs. MCP action pattern follows existing `everyskill` tool architecture.
- **Phase 3 (Web Feedback):** Standard form + table + notification pattern. Same component patterns used throughout EverySkill.
- **Phase 4 (Suggestion-to-Fork):** Thin orchestration over existing `forkSkill()` action and `skill_versions` system. No new integrations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | Zero new infrastructure needed. Anthropic SDK already provides `response.usage`. Recharts handles all charts. Optional OpenAI/Google SDKs are standard. All verified from official docs. |
| **Features** | **HIGH** | Feedback UX patterns (thumbs up/down, suggestions, suggestion-to-fork) are well-established across LangWatch, Canny, UserVoice. Feature dependencies mapped clearly. Anti-features identified to prevent scope creep. |
| **Architecture** | **HIGH** | All table schemas fully specified with Drizzle syntax, indexes, RLS policies. Component boundaries follow existing monorepo patterns. Data flow verified against existing tracking pipeline. Derived entirely from codebase analysis. |
| **Pitfalls** | **HIGH** | 14 pitfalls identified. Critical pitfalls (secret leakage, GDPR, hook limitations) verified from official Claude Code docs and Anthropic API docs. Phase-specific warnings mapped to each implementation phase. |

**Overall confidence:** **MEDIUM-HIGH**

The HIGH confidence applies to everything except token measurement (LOW-MEDIUM) and LLM-as-judge evaluation methodology (MEDIUM). These two areas have known unknowns that require phase-specific research.

### Gaps to Address

1. **Token measurement via transcript_path (MUST INVESTIGATE IN PHASE 5):**
   - **Issue:** PostToolUse hooks do not provide token counts. The `transcript_path` JSONL file is received by every hook but its contents for token data are unverified.
   - **Impact:** Without accurate token data, cost estimation is unreliable and the benchmarking dashboard shows estimates only.
   - **Resolution:** During Phase 5 research, parse a real `transcript_path` file and document what fields are available. If token usage data is present, build a parser. If not, fall back to Anthropic Token Counting API + content-length estimation.

2. **LLM-as-judge reliability for benchmark quality scores (VALIDATE IN PHASE 6):**
   - **Issue:** Using Claude to evaluate Claude's output introduces self-evaluation bias. Verbosity bias and positional bias further reduce reliability.
   - **Impact:** Quality scores in the benchmarking dashboard may be inconsistent or misleading.
   - **Resolution:** Use cross-model evaluation (evaluate Claude output with GPT, and vice versa). Use pairwise comparison ("Is A better than B?") rather than absolute scoring. Version-lock the evaluation prompt. Supplement with objective metrics (token count, error rate, tool call count).

3. **Rate limiter capacity for enriched payloads (ADDRESS IN PHASE 5):**
   - **Issue:** Current 100 RPM rate limit on `/api/track` is insufficient for intensive sessions (100+ tool calls/minute during bulk operations).
   - **Impact:** Usage events silently dropped during the busiest (most interesting) sessions.
   - **Resolution:** Implement client-side batching (accumulate events, flush every 10 seconds) and/or server-side batch endpoint (`POST /api/track/batch`).

4. **Training data consent framework (DESIGN IN PHASE 1, IMPLEMENT INCREMENTALLY):**
   - **Issue:** Capturing real usage data as training examples requires explicit consent under GDPR. Tenant-level opt-in + per-user opt-out + data erasure pipeline.
   - **Impact:** Without consent framework, training data collection is a compliance risk.
   - **Resolution:** Design the consent model during Phase 1 schema work. Implement tenant settings UI and user opt-out in Phase 3 (web feedback). Full erasure pipeline can follow in a later phase.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- PostToolUse input schema, async limitations, `additionalContext` injection, no sandbox, `transcript_path`
- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- Free pre-flight estimation, rate limits by tier, estimate disclaimer
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) -- `response.usage` fields (input_tokens, output_tokens, cache tokens)
- Existing codebase analysis (17+ files verified): schema definitions, tracking pipeline, fork system, AI review, analytics queries, MCP tool architecture

### Secondary (MEDIUM confidence)
- [LangWatch: Thumbs Up/Down API](https://langwatch.ai/docs/user-events/thumbs-up-down) -- Feedback collection pattern (trace_id + vote + feedback)
- [Confident AI: Test Cases, Goldens, Datasets](https://www.confident-ai.com/docs/llm-evaluation/core-concepts/test-cases-goldens-datasets) -- Golden dataset format (input, expected_output, context, expected_tools)
- [Artificial Analysis Methodology](https://artificialanalysis.ai/methodology) -- Benchmarking metrics (3:1 blended cost, TTFT, output speed)
- [HoneyHive: LLM Evaluation Pitfalls](https://www.honeyhive.ai/post/avoiding-common-pitfalls-in-llm-evaluation) -- LLM-as-judge biases, model version opacity, benchmark contamination
- [Enterprise LLM Privacy Concerns](https://www.protecto.ai/blog/enterprise-llm-privacy-concerns/) -- GDPR consent, right to erasure, data minimization

### Tertiary (LOW confidence -- needs validation)
- OpenAI and Google AI SDK integration patterns -- standard but not verified against latest versions
- `transcript_path` JSONL contents for token usage data -- promising lead, unverified

---
*Research completed: 2026-02-15*
*Ready for roadmap: YES*
*Critical unknowns: transcript_path token data (Phase 5), LLM-as-judge methodology (Phase 6)*
