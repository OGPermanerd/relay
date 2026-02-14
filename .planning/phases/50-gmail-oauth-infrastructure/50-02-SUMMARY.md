---
phase: 50-gmail-oauth-infrastructure
plan: 02
subsystem: api
tags: [google-oauth, gmail, oauth2, google-auth-library, api-routes]

# Dependency graph
requires:
  - phase: 50-01
    provides: "gmail_tokens table, AES-256-GCM encryption, token CRUD services"
provides:
  - "GET /api/gmail/connect -- OAuth initiation with state cookie and gmail.readonly scope"
  - "GET /api/gmail/callback -- OAuth callback with code exchange and encrypted token storage"
  - "POST /api/gmail/disconnect -- token revocation with Google and DB deletion"
  - "GET /api/gmail/status -- admin toggle + user connection check"
  - "OAuth2Client factory reusing AUTH_GOOGLE_* credentials"
affects: [50-03-gmail-settings-ui, gmail-scan, gmail-diagnostic]

# Tech tracking
tech-stack:
  added: [google-auth-library (web app)]
  patterns: [state-cookie CSRF for OAuth, best-effort token revocation, admin-toggle feature gating]

key-files:
  created:
    - apps/web/lib/gmail-oauth.ts
    - apps/web/app/api/gmail/connect/route.ts
    - apps/web/app/api/gmail/callback/route.ts
    - apps/web/app/api/gmail/disconnect/route.ts
    - apps/web/app/api/gmail/status/route.ts
  modified:
    - apps/web/middleware.ts
    - apps/web/package.json

key-decisions:
  - "Reuse AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET for Gmail OAuth (same Google project)"
  - "Only /api/gmail/callback exempted in middleware; other routes rely on session via auth() plus middleware cookie check"
  - "State cookie (gmail_oauth_state) for CSRF with 10-min TTL and base64url encoding"
  - "Best-effort Google token revocation on disconnect (non-fatal if revocation fails)"

patterns-established:
  - "Gmail OAuth state cookie pattern: base64url-encoded JSON with userId + csrf UUID"
  - "Feature gating via getSiteSettings().gmailDiagnosticEnabled before OAuth initiation"
  - "Token exchange error handling: catch-all redirect to /settings/connections?error=<reason>"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 50 Plan 02: Gmail OAuth API Routes Summary

**Four Gmail OAuth API routes (connect, callback, disconnect, status) with state-cookie CSRF protection and admin feature-gate**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T14:28:15Z
- **Completed:** 2026-02-14T14:30:41Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- OAuth2Client factory (`gmail-oauth.ts`) using existing AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET credentials
- Complete Gmail OAuth flow: connect (initiate) -> callback (exchange + store) -> disconnect (revoke + delete)
- Status endpoint with dual check: admin toggle + user connection state
- Middleware exempts only `/api/gmail/callback` for Google's redirect; other routes remain behind auth

## Task Commits

Each task was committed atomically:

1. **Task 1: Gmail OAuth client factory and API routes** - `731e0ee` (feat)

## Files Created/Modified
- `apps/web/lib/gmail-oauth.ts` - OAuth2Client factory with redirect URI helper
- `apps/web/app/api/gmail/connect/route.ts` - GET: initiates OAuth with gmail.readonly scope, state cookie, login_hint
- `apps/web/app/api/gmail/callback/route.ts` - GET: exchanges code, verifies scope, upserts encrypted tokens
- `apps/web/app/api/gmail/disconnect/route.ts` - POST: best-effort Google revocation + DB deletion
- `apps/web/app/api/gmail/status/route.ts` - GET: returns { enabled, connected } JSON
- `apps/web/middleware.ts` - Added `/api/gmail/callback` to exempt paths
- `apps/web/package.json` - Added google-auth-library dependency

## Decisions Made
- Reuse AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET for Gmail OAuth -- same Google Cloud project, simplifies credential management
- Only callback route exempted in middleware -- connect/disconnect/status need authenticated sessions
- State cookie uses base64url-encoded JSON with userId + crypto.randomUUID() for CSRF
- Google token revocation is best-effort (non-fatal on failure) -- tokens always deleted from DB regardless

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (Google Cloud Console setup for Gmail API scope was already documented in Phase 50-01.)

## Next Phase Readiness
- All 4 Gmail OAuth routes are functional and build-verified
- Ready for Plan 50-03: Gmail settings UI with connect/disconnect buttons
- `/settings/connections` page (referenced in redirects) needs to be created in Plan 50-03

## Self-Check: PASSED

- [x] apps/web/lib/gmail-oauth.ts -- FOUND
- [x] apps/web/app/api/gmail/connect/route.ts -- FOUND
- [x] apps/web/app/api/gmail/callback/route.ts -- FOUND
- [x] apps/web/app/api/gmail/disconnect/route.ts -- FOUND
- [x] apps/web/app/api/gmail/status/route.ts -- FOUND
- [x] Commit 731e0ee -- FOUND
- [x] Build passes -- VERIFIED

---
*Phase: 50-gmail-oauth-infrastructure*
*Completed: 2026-02-14*
