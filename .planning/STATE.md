# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v2.0 Skill Ecosystem -- COMPLETE (44/44 requirements, 6 phases)

## Current Position

Phase: 39 of 39 (Fork Detection)
Plan: 04 of 04
Status: Phase complete
Last activity: 2026-02-08 -- Completed 39-04-PLAN.md (drift indicator UI + compare page)

Progress: [████████████████████████] 100% (v2.0 -- 44/44 requirements delivered)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 6 phases (34-39) - shipped 2026-02-08

## Performance Metrics

**Velocity:**
- Total plans completed: 175
- Average duration: ~5 min (across milestones)
- Total execution time: ~9.9 hours

**Cumulative:**
- 175 plans across 39 phases and 8 milestones
- ~16,000 LOC TypeScript
- 8 days total development time

*Updated after each plan completion*

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 roadmap]: MCPR tools (review_skill, submit_for_review, check_review_status) placed in Phase 35 alongside AI review integration -- natural combination of review pipeline + MCP tooling
- [v2.0 roadmap]: Phases 38 (MCP Discovery) and 39 (Fork Detection) are independent of review pipeline -- can execute in parallel with phases 36-37
- [34-01]: Status column DEFAULT 'published' for backward compat -- state machine is pure function service (no DB dependency)
- [34-02]: All 4 creation paths explicitly set status='draft' -- never rely on column DEFAULT for new skills
- [34-03]: All 18 public query paths filter by status='published' -- pattern: every new public query must include status filter
- [34-04]: Access control pattern: isPublished || isAuthor || isAdmin else 404 -- parallel session+skill fetch avoids waterfall
- [34-05]: Integration verified: full build passes, 90/92 E2E tests green (2 pre-existing env-specific failures), all 91 skills remain 'published'
- [35-01]: statusMessage is nullable TEXT, no default -- only populated on AI review failure
- [35-01]: Auto-approve threshold defaults to 7/10 -- all 3 categories must meet threshold
- [35-02]: AI review awaited inline (not fire-and-forget) -- user sees result immediately
- [35-02]: Auto-approve transitions through full state machine path (ai_reviewed -> approved -> published)
- [35-02]: Added changes_requested -> pending_review transition for resubmission support
- [35-03]: Duplicated state machine into submit-for-review.ts -- tsup DTS can't resolve @everyskill/db service exports
- [35-03]: review_skill does NOT require ownership -- any authenticated user can review any visible skill
- [35-03]: ANTHROPIC_API_KEY checked before status transitions in submit_for_review to prevent stuck states
- [36-01]: review_decisions table is insert-only (no updatedAt) for SOC2 immutable audit trail
- [36-01]: Default review queue filter is "ai_reviewed" -- skills awaiting human admin review
- [36-01]: AI scores snapshot stored as JSONB for point-in-time decision record
- [36-02]: Raw tx.insert used inside transactions instead of createReviewDecision service to maintain transaction context
- [36-02]: Approve action chains ai_reviewed -> approved -> published in a single transaction
- [36-02]: Reviews nav tab positioned first in admin nav for prominence
- [36-03]: Used diff npm package (diffLines) for line-level content comparison in review detail page
- [36-03]: previousContent fetched from most recent review_decisions record (separate query, not loaded with every decision)
- [36-03]: Two-column layout: skill content (2/3) + AI review and actions (1/3)
- [37-01]: Applied migration via psql directly -- drizzle-kit push prompted about unrelated vanity_domain constraint
- [37-01]: getAdminsInTenant returns id, email, name -- minimal projection for notification dispatch
- [37-02]: Notes quote block shown for approved, rejected, and changes_requested types (not submitted or published)
- [37-02]: Single toggle pair (reviewNotificationsInApp/reviewNotificationsEmail) controls all 5 review event types per RVNT-06
- [37-02]: buildReviewActionUrl routes: submitted -> /admin/reviews, rejected/changes -> /my-skills, approved/published -> /skills/{slug}
- [37-03]: Auto-approved skills send ONLY RVNT-05 (published) to author, NOT RVNT-01 to admins
- [37-03]: approveSkillAction sends ONLY RVNT-05 (published), NOT RVNT-02 + RVNT-05, to avoid double notification
- [37-03]: All notification dispatch happens AFTER DB transactions, never inside them
- [37-03]: Nullable authorId guarded with if-check before eq() for Drizzle ORM type safety
- [37-04]: Review notification preferences default to true (email + in-app) matching other preference defaults
- [37-04]: getNotificationIcon(type) returns {icon, color} for per-type rendering in notification bell
- [38-01]: cosineDistance from drizzle-orm/sql/functions/vector for type-safe pgvector queries
- [38-01]: MCP Ollama client is self-contained copy (no cross-app imports) for stdio protocol safety
- [38-01]: Similarity score = 1 - cosineDistance for intuitive 0-1 range (higher = more similar)
- [38-02]: Semantic search tried first, ILIKE fallback only when embedding null or zero results
- [38-02]: searchMethod field in response JSON for client transparency (semantic vs text)
- [38-04]: deriveQualityTier uses raw integer ratings (400=4.0 stars) matching DB storage format
- [38-04]: displayRating computed in MCP layer (not DB service) to keep service return type clean
- [38-03]: describe_skill aggregates 4 services in parallel: skill review, fork count, rating count, embedding
- [38-03]: Quality tier: gold (>=400 rating, >=10 uses), silver (>=300, >=5), bronze (>=200)
- [38-03]: Similar skills capped at 3, excludes current skill from embedding search
- [38-03]: guide_skill returns category-specific guidance for prompt/workflow/agent/mcp types
- [39-01]: forkedAtContentHash computed from stripped body (no frontmatter) -- distinct from version contentHash (full content)
- [39-01]: No backfill for existing forks -- hash at fork time unavailable, UI shows "unknown drift status"
- [39-01]: Fork version creation is non-fatal (try/catch) matching create.ts pattern
- [39-02]: check_skill_status strips frontmatter from BOTH local and DB content before SHA-256 hashing (FORK-02 false-positive prevention)
- [39-02]: Access control: published OR author-owned -- unpublished skills hidden from non-authors
- [39-02]: Self-contained helpers in MCP tool files (no cross-app imports) per MCP standalone pattern
- [39-03]: Author updates set status=draft for re-review rather than staying published
- [39-03]: forkedAtContentHash computed from stripped body (no frontmatter) matching check_skill_status pattern
- [39-03]: Fork description defaults to parent description when not provided
- [39-03]: Version record failure is non-fatal (try/catch) matching create.ts pattern
- [39-04]: Drift status computed server-side on skill detail page load -- no client-side hash computation
- [39-04]: DriftIndicator is a stateless server component (no use client) for zero JS overhead
- [39-04]: Compare page reuses ReviewDiffView client component for consistent diff rendering
- [39-04]: Frontmatter stripped from both fork and parent before diff to avoid noise

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future phase)

### Blockers/Concerns

- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Research]: PostgreSQL query performance at 100k+ usage_events -- add indexes if slow
- [Note]: apps/mcp tsc --noEmit has pre-existing errors from packages/db module resolution -- not blocking
- [Research]: Ollama embedding latency for conversational use must be sub-200ms -- validate during Phase 38

## Session Continuity

Last session: 2026-02-08
Stopped at: Phase 39 complete -- all v2.0 phases shipped (34-39)
Resume file: .planning/phases/39-fork-detection/
