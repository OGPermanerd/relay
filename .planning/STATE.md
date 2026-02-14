# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 49 - Tenant Resolution Cleanup

## Current Position

Phase: 49 of 54 (Tenant Resolution Cleanup)
Plan: 2 of 3 in current phase (01+03 done, 02 remaining)
Status: In progress
Last activity: 2026-02-14 -- Completed 49-03-PLAN.md (MCP & API route tenant resolution)

Progress: [██████░░░░] 67%

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 21 plans - shipped 2026-02-13
- v4.0 Gmail Workflow Diagnostic - 6 phases, in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 199
- Average duration: ~5 min (across milestones)
- Total execution time: ~10 hours

**Cumulative:**
- 199 plans across 49 phases and 8 milestones
- ~18,000 LOC TypeScript
- 8 days total development time

## Accumulated Context

### Decisions

All decisions archived in PROJECT.md Key Decisions table and milestone archives.

Key v4.0 research decisions:
- Auth.js v5 does NOT support incremental OAuth scopes -- Gmail needs SEPARATE OAuth flow
- Use `gmail.readonly` scope + `format: 'metadata'` (not `gmail.metadata` which blocks date filtering)
- Tokens in dedicated `gmail_tokens` table with AES-256-GCM encryption (not Auth.js accounts table)
- Two-pass categorization: rule-based first (~70%), AI for ambiguous ~30%
- Analyze and discard: raw metadata only in memory, persist only aggregate stats
- ~$0.17-0.20 per scan cost (Claude Sonnet for classification)

Phase 49 decisions:
- Transitional `session.user.tenantId ?? DEFAULT_TENANT_ID` pattern in callers (Plan 02 will make strict)
- Utility functions (embedding-generator, greeting-pool) accept tenantId as parameter, never hardcode it
- MCP tools return explicit error when tenant not resolved (not silent fallback)
- Tracking functions silently skip when no tenant (non-critical fire-and-forget)
- install-callback keeps DEFAULT_TENANT_ID as sole legitimate anonymous fallback

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future milestone)
- DEFAULT_TENANT_ID cleanup -- Phase 49 of v4.0

### Blockers/Concerns

- Gmail API requires Google Cloud Console configuration (enable Gmail API, add `gmail.readonly` scope to OAuth consent screen)
- GMAIL_ENCRYPTION_KEY env var needed for AES-256-GCM token encryption
- DEFAULT_TENANT_ID hardcoded in 18+ files -- Phase 49 addresses this first
- Google OAuth verification needed if serving >100 external users (Internal user type bypasses this)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 49 Plans 01+03 complete -- MCP & API route tenant resolution
Resume file: .planning/phases/49-tenant-resolution-cleanup/49-02-PLAN.md
