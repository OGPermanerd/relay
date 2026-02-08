---
phase: 32-admin-panel
plan: 03
subsystem: ui
tags: [next.js, layout, rbac, tenant-settings, zod, server-actions]

# Dependency graph
requires:
  - phase: 32-06
    provides: "isAdmin session-based checks migrated across all callers"
provides:
  - "Admin layout with role gate wrapping all /admin/* routes"
  - "Sub-navigation for admin sections (Settings, Skills, Merge, API Keys, Compliance)"
  - "Tenant settings form (name, domain, logo) with Zod-validated server action"
  - "Per-page admin checks removed (layout is sole security boundary)"
affects: [admin-pages, tenant-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Layout-level role gate as sole admin security boundary", "Zod-validated server action for tenant updates"]

key-files:
  created:
    - apps/web/app/(protected)/admin/layout.tsx
    - apps/web/app/actions/admin-tenant.ts
  modified:
    - apps/web/app/(protected)/admin/settings/page.tsx
    - apps/web/app/(protected)/admin/merge/page.tsx
    - apps/web/app/(protected)/admin/keys/page.tsx
    - apps/web/components/admin-settings-form.tsx
    - apps/web/tests/e2e/admin-settings.spec.ts

key-decisions:
  - "Layout-level gate is sole admin security boundary; per-page checks removed"
  - "Tenant settings validated with Zod schema (name required, domain/logo optional)"

patterns-established:
  - "Admin layout gate: isAdmin(session) check in layout.tsx redirects non-admins before any child page renders"
  - "TenantSettingsForm uses useActionState pattern consistent with existing AdminSettingsForm"

# Metrics
duration: 9min
completed: 2026-02-08
---

# Phase 32 Plan 03: Admin Layout + Tenant Settings Summary

**Shared admin layout with role gate, sub-navigation, and tenant settings form (name, domain, logo) via Zod-validated server action**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-08T11:21:15Z
- **Completed:** 2026-02-08T11:30:36Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Admin layout with isAdmin(session) gate redirects non-admins from all /admin/* routes
- Horizontal sub-navigation: Settings, Skills, Merge, API Keys, Compliance
- Tenant settings form with name, domain, and logo fields using useActionState
- updateTenantSettingsAction server action with Zod validation and role check
- Removed redundant per-page isAdmin checks from settings, merge, and keys pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin layout with role gate + verify gate redirects non-admins** - `c4150da` (feat)
2. **Task 2: Remove per-page admin checks + add tenant settings form** - `6573959` (feat)
3. **Test fix: Update E2E assertions for new heading structure** - `2a18c9e` (fix)

## Files Created/Modified
- `apps/web/app/(protected)/admin/layout.tsx` - Shared admin layout with role gate and sub-nav
- `apps/web/app/actions/admin-tenant.ts` - Server action for updating tenant settings with Zod validation
- `apps/web/app/(protected)/admin/settings/page.tsx` - Removed isAdmin check, added tenant settings section
- `apps/web/app/(protected)/admin/merge/page.tsx` - Removed isAdmin check, simplified wrapper
- `apps/web/app/(protected)/admin/keys/page.tsx` - Removed isAdmin check, simplified wrapper
- `apps/web/components/admin-settings-form.tsx` - Added TenantSettingsForm component
- `apps/web/tests/e2e/admin-settings.spec.ts` - Updated heading assertions for new layout structure

## Decisions Made
- Layout-level gate is the sole admin security boundary -- per-page checks are redundant and removed
- Tenant settings validated with Zod schema: name required (1-100 chars), domain and logo optional (empty string or valid URL)
- Server action still has its own isAdmin check for defense-in-depth (server actions can be called directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated E2E test heading assertions**
- **Found during:** Task 2 verification (Playwright tests)
- **Issue:** Tests expected "Admin Settings" heading but page now renders "Settings" (layout provides "Admin" heading). Also "Settings" matched both "Settings" and "Tenant Settings" headings (strict mode violation).
- **Fix:** Changed heading assertion to `{ name: "Settings", exact: true }`, updated description text assertion
- **Files modified:** apps/web/tests/e2e/admin-settings.spec.ts
- **Verification:** All heading-related E2E tests pass (5 passed, 1 pre-existing Ollama flaky test)
- **Committed in:** 2a18c9e

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix necessary for correctness after heading structure change. No scope creep.

## Issues Encountered
- Next.js build lock file and stale cache issues required `.next` directory cleanup before successful build
- Pre-existing flaky Ollama connection test still fails (unrelated to changes -- depends on Ollama being available)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin layout shell ready for all admin sub-pages
- Tenant settings form operational for name/domain/logo updates
- Skills admin page route exists but needs content (future plan)

---
*Phase: 32-admin-panel*
*Completed: 2026-02-08*
