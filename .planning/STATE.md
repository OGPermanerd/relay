# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 51 - Email Analysis Pipeline

## Current Position

Phase: 51 of 54 (Email Analysis Pipeline)
Plan: 2 of 5 in current phase (51-02-PLAN.md completed)
Status: In progress
Last activity: 2026-02-14 -- Completed 51-02-PLAN.md (Gmail API client for metadata fetching)

Progress: [███████████░] 40%

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
- Total plans completed: 203
- Average duration: ~5 min (across milestones)
- Total execution time: ~10 hours

**Cumulative:**
- 205 plans across 51 phases and 9 milestones
- ~18,850 LOC TypeScript
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
- Reuse AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET for Gmail OAuth (same Google Cloud project)
- Only /api/gmail/callback exempted in middleware; connect/disconnect/status need auth
- State cookie (gmail_oauth_state) with base64url-encoded JSON for CSRF, 10-min TTL
- Best-effort Google token revocation on disconnect (non-fatal)
- GmailConnectionCard uses <a href> for /api/gmail/connect (API redirect, not next/link)
- Admin form sections preserve all settings via hidden fields to prevent reset on save

Phase 51 decisions (Plan 02):
- Use format: 'metadata' with specific headers only (From, Subject, Date, List-Unsubscribe, In-Reply-To)
- Batch 100 messages per Promise.all to respect Gmail API rate limits (250 units/user/sec)
- Silent error handling for individual message fetch failures to continue batch processing

Phase 51 decisions (Plan 03):
- Two-pass email classification: rule-based first (~70% coverage), AI second for ambiguous cases
- Claude Haiku 4.5 for cost efficiency on high-volume classification (vs Sonnet)
- Batch size 75 emails per API call balances cost efficiency and rate limits
- Privacy-first AI input: only domain, subject preview (100 chars), metadata flags (no full addresses or content)
- Fallback to "direct-message" category if AI response missing email ID

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
Stopped at: Phase 51 Plan 02 complete -- Gmail API client for metadata fetching
Resume file: .planning/phases/51-email-analysis-pipeline/51-04-PLAN.md (Email insight extraction)
