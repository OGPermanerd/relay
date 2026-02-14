---
phase: 50-gmail-oauth-infrastructure
plan: 01
subsystem: database
tags: [gmail, oauth, aes-256-gcm, encryption, drizzle, postgres, google-auth-library]

# Dependency graph
requires:
  - phase: 49-default-tenant-cleanup
    provides: "Clean tenant isolation across all server actions and services"
provides:
  - "gmail_tokens table with AES-256-GCM encrypted token columns"
  - "encryptToken/decryptToken crypto utilities"
  - "Gmail token CRUD service with race-safe refresh"
  - "gmailDiagnosticEnabled column on site_settings"
  - "GmailNotConnectedError and GmailTokenRevokedError error classes"
affects: [50-02-gmail-oauth-flow, 50-03-gmail-diagnostic-ui, 51-gmail-scan-engine]

# Tech tracking
tech-stack:
  added: [google-auth-library]
  patterns: [AES-256-GCM token encryption at rest, mutex-based race-safe token refresh]

key-files:
  created:
    - packages/db/src/schema/gmail-tokens.ts
    - packages/db/src/lib/crypto.ts
    - packages/db/src/services/gmail-tokens.ts
    - packages/db/src/migrations/0028_add_gmail_tokens.sql
  modified:
    - packages/db/src/schema/site-settings.ts
    - packages/db/src/schema/index.ts
    - packages/db/src/services/index.ts
    - packages/db/src/relations/index.ts
    - packages/db/package.json
    - apps/web/package.json

key-decisions:
  - "Install google-auth-library directly in packages/db rather than dynamic imports or callbacks"
  - "Use iv:authTag:ciphertext hex format for encrypted token storage"
  - "Race-safe refresh with refreshing_at timestamp mutex and 3-retry limit"
  - "5-minute buffer before token expiry triggers proactive refresh"
  - "30-second stale lock timeout for abandoned refresh operations"

patterns-established:
  - "AES-256-GCM encryption: encryptToken/decryptToken in packages/db/src/lib/crypto.ts"
  - "Mutex pattern: refreshing_at column prevents concurrent token refreshes"
  - "Token lifecycle: upsert on connect, decrypt on read, delete on revoke"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 50 Plan 01: Gmail OAuth Schema & Token Service Summary

**AES-256-GCM encrypted gmail_tokens table with race-safe refresh service using google-auth-library**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T14:17:36Z
- **Completed:** 2026-02-14T14:22:33Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- gmail_tokens table with encrypted token columns, RLS policy, indexes, and ON DELETE CASCADE from users
- AES-256-GCM encryption utilities for token-at-rest security
- Full CRUD service: upsert, decrypted read, delete, connection check, and race-safe refresh with mutex
- gmailDiagnosticEnabled admin toggle column added to site_settings
- google-auth-library installed in both packages/db and apps/web

## Task Commits

Each task was committed atomically:

1. **Task 1: Gmail tokens schema, crypto utils, migration, and wiring** - `67ce6ec` (feat)
2. **Task 2: Gmail tokens service with CRUD, encryption, and race-safe refresh** - `3c5d1e4` (feat)

## Files Created/Modified
- `packages/db/src/schema/gmail-tokens.ts` - Gmail tokens table definition with RLS policy
- `packages/db/src/lib/crypto.ts` - AES-256-GCM encrypt/decrypt utilities
- `packages/db/src/services/gmail-tokens.ts` - Token CRUD, encryption, and race-safe refresh service
- `packages/db/src/migrations/0028_add_gmail_tokens.sql` - SQL migration for table and site_settings column
- `packages/db/src/schema/site-settings.ts` - Added gmailDiagnosticEnabled boolean column
- `packages/db/src/schema/index.ts` - Re-export gmail-tokens schema
- `packages/db/src/services/index.ts` - Re-export all gmail-tokens service exports
- `packages/db/src/relations/index.ts` - Added gmailTokens relations (user 1:1, tenant 1:N)
- `packages/db/package.json` - Added google-auth-library dependency
- `apps/web/package.json` - Added google-auth-library dependency

## Decisions Made
- Installed google-auth-library directly in packages/db (cleaner than dynamic imports or callback injection)
- Used iv:authTag:ciphertext hex format for deterministic parsing of encrypted values
- 5-minute refresh buffer and 30-second stale lock timeout balance freshness with race safety
- Maximum 3 retries on concurrent refresh to prevent infinite recursion

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**GMAIL_ENCRYPTION_KEY must be set in all environments:**
- `.env.local` - Generated and added during execution
- `.env.staging` - Must be added manually: `openssl rand -hex 32`
- `.env.production` - Must be added manually: `openssl rand -hex 32`

## Next Phase Readiness
- Schema and service layer complete, ready for Plan 02 (OAuth flow API routes)
- google-auth-library available in both packages for OAuth2Client usage
- GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars will be needed for Plan 02

## Self-Check: PASSED

- All 4 created files verified present on disk
- Commit 67ce6ec (Task 1) verified in git log
- Commit 3c5d1e4 (Task 2) verified in git log

---
*Phase: 50-gmail-oauth-infrastructure*
*Completed: 2026-02-14*
