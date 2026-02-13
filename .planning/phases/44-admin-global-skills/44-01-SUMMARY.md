---
phase: 44-admin-global-skills
plan: 01
subsystem: database, api, ui
tags: [drizzle, postgres, server-actions, admin, company-approved]

# Dependency graph
requires: []
provides:
  - "companyApproved, approvedAt, approvedBy columns on skills table"
  - "toggleCompanyApproval server action with admin auth guard"
  - "Admin skills table Approved column with toggle UI"
  - "Partial index on company_approved=true for query performance"
affects: [44-admin-global-skills, homepage-company-recommended]

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-row form toggle using hidden fields + useActionState"]

key-files:
  created:
    - "packages/db/src/migrations/0022_add_company_approved.sql"
  modified:
    - "packages/db/src/schema/skills.ts"
    - "packages/db/src/relations/index.ts"
    - "apps/web/app/actions/admin-skills.ts"
    - "apps/web/components/admin-skills-table.tsx"

key-decisions:
  - "Used per-row form with hidden fields pattern (same as deleteSkillAdminAction) for toggle"
  - "Approval removal clears both approvedAt and approvedBy (full audit reset on unapprove)"

patterns-established:
  - "Company approval toggle: green shield-check badge when approved, gray dash when not"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 44 Plan 01: Company Approved Schema, Action, and Admin Toggle Summary

**Company-approved boolean column with audit trail (approvedAt/approvedBy), admin toggle server action, and Approved column in admin skills table with shield-check badge UI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T22:04:35Z
- **Completed:** 2026-02-13T22:09:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added companyApproved (boolean default false), approvedAt (timestamp), approvedBy (text FK to users) columns to skills table
- Created and ran migration 0022 with partial index on company_approved=true
- Added approvedByUser relation to skillsRelations with relationName to avoid conflict with author relation
- Added toggleCompanyApproval server action with admin auth guard, toggling approval state with audit fields
- Added Approved column to admin skills table with per-row toggle button (green shield-check / gray dash)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, migration, and relations** - `77b6a64` (feat)
2. **Task 2: Server action and admin table toggle** - `dcaeb17` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added companyApproved, approvedAt, approvedBy columns with boolean import
- `packages/db/src/migrations/0022_add_company_approved.sql` - Migration adding 3 columns + partial index
- `packages/db/src/relations/index.ts` - Added approvedByUser relation to skillsRelations
- `apps/web/app/actions/admin-skills.ts` - Added companyApproved to AdminSkill type/query, toggleCompanyApproval action
- `apps/web/components/admin-skills-table.tsx` - Added Approved column header, per-row toggle form with shield-check icon

## Decisions Made
- Used per-row form with hidden fields (skillId, currentlyApproved) for the toggle, matching the existing deleteSkillAdminAction pattern
- Approval removal clears both approvedAt and approvedBy to null (full reset, not preserving last approver on unapprove)
- Revalidates both /admin/skills and / (homepage) paths to keep Company Recommended section fresh

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DATABASE_URL env var not set in shell**
- **Found during:** Task 1 (running migration)
- **Issue:** `psql "$DATABASE_URL"` failed because env var pointed to wrong/empty database
- **Fix:** Ran migration directly with `psql everyskill` against the correct database name
- **Files modified:** None (runtime fix only)
- **Verification:** Migration ran successfully, columns verified with SELECT query

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial environment issue, no scope creep.

## Issues Encountered
None beyond the DATABASE_URL env var issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Company-approved schema and admin controls are ready
- Homepage "Company Recommended" section can now query `WHERE company_approved = true` using the partial index
- Future plans can add bulk approval, approval history, and approval-based filtering

## Self-Check: PASSED

All 5 files verified present. Both commits (77b6a64, dcaeb17) confirmed in git log.

---
*Phase: 44-admin-global-skills*
*Completed: 2026-02-13*
