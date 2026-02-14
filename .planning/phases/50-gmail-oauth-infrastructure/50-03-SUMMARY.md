---
phase: 50-gmail-oauth-infrastructure
plan: 03
subsystem: ui
tags: [gmail, oauth, settings, react, nextjs, tailwind]

# Dependency graph
requires:
  - phase: 50-gmail-oauth-infrastructure
    provides: "gmail_tokens schema, hasActiveGmailConnection service, OAuth API routes, gmailDiagnosticEnabled site setting"
provides:
  - "Settings /connections page with Gmail connection card"
  - "Connections tab in settings nav"
  - "Admin toggle for Gmail diagnostic feature in admin settings"
affects: [51-gmail-scan-engine, 52-gmail-results-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Hidden fields to preserve form state across multi-section admin forms sharing one server action"]

key-files:
  created:
    - apps/web/app/(protected)/settings/connections/page.tsx
    - apps/web/app/(protected)/settings/connections/gmail-connection-card.tsx
  modified:
    - apps/web/app/(protected)/settings/settings-nav.tsx
    - apps/web/components/admin-settings-form.tsx
    - apps/web/app/actions/admin-settings.ts
    - apps/web/app/(protected)/admin/settings/page.tsx

key-decisions:
  - "GmailConnectionCard uses <a href> for /api/gmail/connect (not next/link) since it is an API redirect"
  - "Three-state card: feature disabled, not connected, connected"
  - "Each admin settings form section includes hidden fields for all other settings to prevent reset on save"

patterns-established:
  - "OAuth connection card pattern: server page fetches status, client card handles connect/disconnect"
  - "Feature-gated UI: check site settings server-side, pass enabled flag to client component"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 50 Plan 03: Gmail Settings UI Summary

**Settings connections page with Gmail connect/disconnect card and admin toggle for enabling Gmail diagnostics**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T14:32:36Z
- **Completed:** 2026-02-14T14:37:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Settings nav now includes Connections tab between Preferences and Notifications
- /settings/connections page shows Gmail connection card with three states: disabled, not connected, connected
- Admin settings form has Gmail Diagnostics section with enable/disable toggle
- Error and success messages display from OAuth callback query params

## Task Commits

Each task was committed atomically:

1. **Task 1: Settings connections page and Gmail connection card** - `6373054` (feat)
2. **Task 2: Admin toggle for Gmail diagnostic feature** - `a79b3d5` (feat)

## Files Created/Modified
- `apps/web/app/(protected)/settings/connections/page.tsx` - Server component fetching feature toggle and connection status
- `apps/web/app/(protected)/settings/connections/gmail-connection-card.tsx` - Client component with connect/disconnect/disabled states
- `apps/web/app/(protected)/settings/settings-nav.tsx` - Added Connections tab to nav
- `apps/web/components/admin-settings-form.tsx` - Added Gmail Diagnostics toggle section and gmailDiagnosticEnabled to interface/defaults
- `apps/web/app/actions/admin-settings.ts` - Parse gmailDiagnosticEnabled from form, revalidate /settings/connections
- `apps/web/app/(protected)/admin/settings/page.tsx` - Pass gmailDiagnosticEnabled to AdminSettingsForm

## Decisions Made
- Used `<a href="/api/gmail/connect">` instead of next/link since this triggers an API redirect, not client navigation
- GmailConnectionCard renders three mutually exclusive states based on `enabled` and `connected` props
- Each form section in admin settings preserves all other settings via hidden fields to avoid data loss when saving

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added hidden fields for allowSkillDownload and gmailDiagnosticEnabled in Semantic Similarity form**
- **Found during:** Task 2 (Admin toggle)
- **Issue:** The Semantic Similarity section form shares `saveSettingsAction` but lacked hidden fields for `allowSkillDownload` and `gmailDiagnosticEnabled`, meaning saving semantic similarity settings would reset both to false
- **Fix:** Added hidden input fields for `allowSkillDownload` and `gmailDiagnosticEnabled` to the Semantic Similarity form section
- **Files modified:** apps/web/components/admin-settings-form.tsx
- **Verification:** Build passes, all form sections now preserve all settings
- **Committed in:** a79b3d5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential bug fix preventing data loss when saving from Semantic Similarity section. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gmail OAuth infrastructure (Phase 50) is now complete: schema, crypto, services, API routes, and UI
- Ready for Phase 51 (Gmail Scan Engine) which will use the connection established through this UI
- Gmail API must be enabled in Google Cloud Console and `gmail.readonly` scope added to OAuth consent screen before end-to-end testing

## Self-Check: PASSED

All 6 files verified present. Both task commits (6373054, a79b3d5) verified in git log. Build passes. 13/13 E2E tests pass.

---
*Phase: 50-gmail-oauth-infrastructure*
*Completed: 2026-02-14*
