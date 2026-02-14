# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 50 - Gmail OAuth Infrastructure

## Current Position

Phase: 50 of 54 (Gmail OAuth Infrastructure)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-14 -- Completed 50-01-PLAN.md (schema, crypto, service)

Progress: [███░░░░░░░] 33%

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
- Total plans completed: 201
- Average duration: ~5 min (across milestones)
- Total execution time: ~10 hours

**Cumulative:**
- 201 plans across 50 phases and 9 milestones
- ~18,200 LOC TypeScript
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
- All server actions derive tenantId strictly from session.user.tenantId (no fallback)
- Server actions return error matching existing pattern per file; server components redirect
- Utility functions (embedding-generator, greeting-pool) accept tenantId as parameter, never hardcode it
- MCP tools return explicit error when tenant not resolved (not silent fallback)
- Tracking functions silently skip when no tenant (non-critical fire-and-forget)
- install-callback keeps DEFAULT_TENANT_ID as sole legitimate anonymous fallback
- upsertSkillReview tenantId is now required (not optional)

Phase 50 decisions:
- google-auth-library installed directly in packages/db (not dynamic import)
- iv:authTag:ciphertext hex format for AES-256-GCM encrypted token storage
- 5-minute refresh buffer, 30-second stale lock timeout, 3 retry max for race-safe token refresh
- GMAIL_ENCRYPTION_KEY env var (64-char hex) required for token encryption

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future milestone)
- DEFAULT_TENANT_ID cleanup -- DONE (Phase 49)

### Blockers/Concerns

- Gmail API requires Google Cloud Console configuration (enable Gmail API, add `gmail.readonly` scope to OAuth consent screen)
- GMAIL_ENCRYPTION_KEY env var needed for AES-256-GCM token encryption -- ADDED to .env.local (Phase 50-01)
- DEFAULT_TENANT_ID cleanup complete for server actions, components, and DB services (Phase 49)
- Google OAuth verification needed if serving >100 external users (Internal user type bypasses this)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 50 Plan 01 complete -- ready for Plan 02 (OAuth flow API routes)
Resume file: .planning/phases/50-gmail-oauth-infrastructure/50-02-PLAN.md
