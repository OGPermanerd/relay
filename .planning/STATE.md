# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v6.0 IP Dashboard & Skills Portfolio — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v6.0
Last activity: 2026-02-15 — Milestone v6.0 started

Progress: [##########################....] 85% (228/~270 est. plans across all milestones)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 21 plans - shipped 2026-02-13
- v4.0 Gmail Workflow Diagnostic - 17 plans - shipped 2026-02-14
- v5.0 Feedback, Training & Benchmarking - 7/7 phases - shipped 2026-02-15
- v6.0 IP Dashboard & Skills Portfolio - defining requirements

## Performance Metrics

**Velocity:**
- Total plans completed: 228
- Average duration: ~5 min (across milestones)
- Total execution time: ~11.7 hours

**Cumulative:**
- 228 plans across 61 phases and 9 milestones
- ~19,700 LOC TypeScript
- 8 days total development time

## Accumulated Context

### Decisions

All prior decisions archived in PROJECT.md Key Decisions table and milestone archives.

v5.0 milestone decisions:
- Single `skill_feedback` table with `feedbackType` discriminator (not separate tables per type)
- Separate `token_measurements` table with typed integer columns (not JSONB in usage_events)
- MCP `feedback` action (not PostToolUse output injection) for collecting user feedback
- Smart frequency gating: first 3 uses, then every 10th (not every use)
- Static Anthropic pricing table for cost estimation (not real-time API pricing)
- Training data requires explicit per-user opt-in consent
- Secret detection uses assignment-context gating (key=value syntax) to prevent false positives on prose
- Pattern order matters: Anthropic (sk-ant-) before OpenAI (sk-) to prevent double-matching
- usageEventId stored as plain text (no FK) due to uuid/text type mismatch with usage_events
- Multi-FK disambiguation with relationName for skill_feedback reviewer vs user relations
- Portable transcript parsing: tail -n 100 + jq select + tail -1 (no tac for macOS compatibility)
- Token fields optional in hook payload -- omitted when transcript unavailable (not defaulted to 0)
- MCP feedback handler uses inline aggregate recalculation (same SQL as DB service) for direct DB access
- MCP comment sanitization: simple trim+truncate (cannot import web app's sanitizePayload); API uses full sanitizePayload
- trackUsage with skipIncrement:true for feedback (don't inflate skill totalUses)
- Pricing table in packages/db/src/services/pricing.ts (pure TS) with re-export from apps/web/lib/pricing-table.ts
- insertTokenMeasurement is fire-and-forget (void promise) to avoid blocking /api/track response
- estimateCostMicrocents returns null for unknown models (graceful degradation)
- Suggestion functions added to existing skill-feedback.ts (colocated with thumbs feedback, not separate file)
- Alias imports (dbUpdateSuggestionStatus) used when server action names match DB function names
- Cost StatCards conditionally rendered in skill detail stats grid (only when measurementCount > 0)
- Model name suffix shortened by stripping claude- prefix and -202X date for readability
- SuggestionForm follows rating-form pattern (useActionState, hidden skillId/skillSlug, field-level errors)
- Tab props optional with defaults for backward compatibility when adding new tabs
- Sync PostToolUse hook uses file-based counter at /tmp/everyskill-fb-{skillId}.cnt for frequency gating
- Feedback StatCard uses amber (#f59e0b) trendColor to distinguish from other stat sparklines
- Skill names with single quotes stripped (not escaped) in hook frontmatter for shell safety
- Direct useState + async handler pattern (not useActionState) for suggestion action buttons, matching admin-review-detail pattern
- Reply button available on all statuses (pending, accepted, implemented) so author can communicate at any lifecycle stage
- Benchmark DB null guards: throw Error for writes (createBenchmarkRun, insertBenchmarkResult), return empty for reads
- Two default benchmark models (Sonnet 4.5 + Haiku 4.5) for fast execution under 60s
- Blinded AI judge: Claude Sonnet evaluates outputs without knowing which model produced them (BENCH-07)
- Individual model failures stored as error results via Promise.allSettled, don't fail entire run
- Ad-hoc inputs textarea as fallback when no training examples exist (newline-separated, JSON-serialized in hidden form field)
- useElapsedTimer hook copied locally into benchmark-tab.tsx (not imported from ai-review-tab where it's private)
- Both admin and author can trigger benchmarks (broader than author-only AI review)
- Staleness threshold: 90 days or never benchmarked triggers amber warning banner
- Training examples use feedbackType='training_example' discriminator (same pattern as suggestions, not separate table)
- createTrainingExample skips updateSkillFeedbackAggregates (training examples don't affect feedback sentiment)
- Author-only guard on submitTrainingExample (only skill author can add golden examples)
- trainingDataConsent is required boolean (not optional) matching Zod .default(false) output type
- captureUsageAsTraining uses void prefix for fire-and-forget (same pattern as insertTokenMeasurement)
- Dual consent gating: tenant trainingDataCaptureEnabled checked first (cached), then user trainingDataConsent
- Shared frontmatter utility at apps/web/lib/frontmatter.ts (extracted from skills.ts, fixed relay_ regex bug)
- acceptAndForkSuggestion uses direct async handler pattern (not useActionState) matching suggestion-card.tsx button pattern
- applyInlineSuggestion marks suggestion as "implemented" directly (skipping "accepted") since content is applied immediately
- autoImplementLinkedSuggestions designed as fire-and-forget for publish hook integration (Plan 59-02)
- Accept & Fork replaces old Accept button on pending suggestions -- forking is the primary acceptance action
- Redirect-safe error handling: re-throw Next.js redirect digest errors in client handlers, catch only real errors
- autoImplementLinkedSuggestions placed before embedding generation in both publish paths (submitForReview + approveSkillAction)
- Training tab conditionally visible to authors and admins (showTrainingTab prop); form renders only for authors
- trainingDataCaptureEnabled preserved as hidden field across all 4 admin form sections to prevent settings loss
- Per-user trainingDataConsent checkbox in preferences page defaults to off
- Benchmark data reuses existing trainingExamples fetch for hasTrainingExamples boolean (avoids duplicate DB query)
- Model comparison stats fetched conditionally after Promise.all (depends on run ID from latestBenchmarkRun)

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future milestone)
- Fix staging discover search without keywords
- Create aveone tenant and subdomain for staging branding/whitelabeling test
- Rename skill matching as "Operator Skills Wizard" (better branding)
- Expand work-activity analysis beyond Gmail: review Google Docs, Slack, browser history (Chrome, Safari, Edge), and any connected channels
- Estimate switching cost: look at how many different task types/contexts someone switches between; leverage academic research on optimal focus/switching productivity
- "How does your brain work" section: sliders for users to adjust how the system calculates most important skills for them (personalized weighting)
- Boot/seed the database with top skills from open source skills packages (e.g., https://mcpmarket.com/tools/skills/kung-fu-skill-manager) -- curate most valuable skills to populate initial database
- Skill visibility: expose all 4 levels in upload form (currently only tenant/personal); add ability to change visibility after upload on skill edit/detail page
- Default skill visibility scope to company-visible (tenant) instead of requiring selection
- Personal skills recommendation: revisit how skills are ranked for a user given the needs assessment process (operator wizard output should inform ranking)
- Add ability to rerun the "Operator Skills Wizard" to refresh skills recommendations on demand
- Operator Wizard: allow user to upload iPhone/Android screentime data (or API-connect to grab it) to analyze app usage patterns, optimize time use, and recommend optimal task switching based on their brain profile sliders

### Blockers/Concerns

- PostToolUse hook payload: VERIFIED -- transcript_path available in stdin, JSONL contains .message.model and .message.usage (Plan 60-02)
- transcript_path JSONL: VERIFIED -- tail+jq parsing works correctly for token extraction (Plan 60-02)
- LLM-as-judge evaluation methodology needs validation in Phase 61

## Session Continuity

Last session: 2026-02-15
Stopped at: v6.0 milestone started — defining requirements
Resume file: .planning/MILESTONE-CONTEXT.md
