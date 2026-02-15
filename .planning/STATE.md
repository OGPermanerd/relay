# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v5.0 Phase 55 - Schema Foundation & Data Sanitization

## Current Position

Phase: 55 of 61 (Schema Foundation & Data Sanitization)
Plan: 2 of TBD in current phase
Status: In progress
Last activity: 2026-02-15 -- Completed 55-02-PLAN.md (Payload Sanitization Utility)

Progress: [####################..........] 78% (212/~270 est. plans across all milestones)

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
- v5.0 Feedback, Training & Benchmarking - 0/7 phases - in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 212
- Average duration: ~5 min (across milestones)
- Total execution time: ~10.7 hours

**Cumulative:**
- 212 plans across 55 phases and 9 milestones
- ~19,500 LOC TypeScript
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

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future milestone)
- Fix staging discover search without keywords
- Create aveone tenant and subdomain for staging branding/whitelabeling test
- Rename skill matching as "Operator Skills Wizard" (better branding)
- Expand work-activity analysis beyond Gmail: review Google Docs, Slack, and any connected channels
- Estimate switching cost: look at how many different task types/contexts someone switches between; leverage academic research on optimal focus/switching productivity
- "How does your brain work" section: sliders for users to adjust how the system calculates most important skills for them (personalized weighting)
- Boot/seed the database with top skills from open source skills packages (e.g., https://mcpmarket.com/tools/skills/kung-fu-skill-manager) -- curate most valuable skills to populate initial database
- Skill visibility: expose all 4 levels in upload form (currently only tenant/personal); add ability to change visibility after upload on skill edit/detail page
- Default skill visibility scope to company-visible (tenant) instead of requiring selection
- Personal skills recommendation: revisit how skills are ranked for a user given the needs assessment process (operator wizard output should inform ranking)
- Add ability to rerun the "Operator Skills Wizard" to refresh skills recommendations on demand
- Operator Wizard: allow user to upload iPhone/Android screentime data (or API-connect to grab it) to analyze app usage patterns, optimize time use, and recommend optimal task switching based on their brain profile sliders

### Blockers/Concerns

- PostToolUse hook payload capabilities unknown -- need research in Phase 60
- transcript_path JSONL contents unverified for token data -- highest technical risk
- LLM-as-judge evaluation methodology needs validation in Phase 61

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 55-02 (Payload Sanitization Utility) -- continue Phase 55
Resume file: .planning/phases/55-schema-foundation-data-sanitization/55-02-SUMMARY.md
