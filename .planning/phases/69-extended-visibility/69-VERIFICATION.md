---
phase: 69-extended-visibility
verified: 2026-02-16T19:54:00Z
status: gaps_found
score: 8/9 must-haves verified
gaps:
  - truth: "Migration adds CHECK constraint and updates RLS policy in database"
    status: failed
    reason: "Migration 0038 exists in source but was never applied to database"
    artifacts:
      - path: "packages/db/src/migrations/0038_extend_visibility.sql"
        issue: "Migration file exists but not applied - no CHECK constraint or updated RLS policy in database"
    missing:
      - "Run `pnpm db:migrate` to apply migration 0038"
      - "Verify CHECK constraint exists: `SELECT conname FROM pg_constraint WHERE conrelid = 'skills'::regclass AND conname = 'skills_visibility_check'`"
      - "Verify RLS policy includes global_approved: `SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid = 'skills'::regclass`"
---

# Phase 69: Extended Visibility Verification Report

**Phase Goal:** Users and admins can manage skills across 4 graduated visibility levels with correct tenant isolation

**Verified:** 2026-02-16T19:54:00Z

**Status:** gaps_found

**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | buildVisibilityFilter returns global_approved and tenant skills for anonymous users | VERIFIED | visibility.ts line 44: `or(eq(skills.visibility, "global_approved"), eq(skills.visibility, "tenant"))` when no userId |
| 2 | buildVisibilityFilter returns global_approved, tenant, personal (own), and private (own) for authenticated users | VERIFIED | visibility.ts lines 47-52: all 4 levels with author_id checks for personal/private |
| 3 | visibilitySQL produces the same filtering logic as raw SQL strings | VERIFIED | visibility.ts lines 61-66: SQL template mirrors buildVisibilityFilter logic |
| 4 | orgVisibleSQL returns clause matching only global_approved and tenant | VERIFIED | visibility.ts line 33: `` sql`visibility IN ('global_approved', 'tenant')` `` |
| 5 | VISIBILITY_LEVELS constant exports all 4 levels | VERIFIED | visibility.ts line 11: `["global_approved", "tenant", "personal", "private"]` |
| 6 | Migration adds CHECK constraint and updates RLS policy | FAILED | Migration file exists but not applied - database still has old RLS policy without global_approved clause |
| 7 | Trending, leaderboard, portfolio, company-approved, and tag aggregation include global_approved | VERIFIED | All 5+ lib files updated to `IN ('global_approved', 'tenant')` or `inArray` equivalent |
| 8 | Server action Zod accepts 4 levels with admin gate for global_approved | VERIFIED | skills.ts line 48 has 4-level enum, lines 155+366 enforce admin gate |
| 9 | MCP tools accept 4 levels in Zod but reject global_approved at handler level | VERIFIED | create.ts line 154 rejects global_approved, all tools accept 4-level enum |
| 10 | Upload form shows 4 visibility options with Global admin-only | VERIFIED | skill-upload-form.tsx lines 200-268: Team/Personal/Private for all, Global wrapped in `{isAdmin && ...}` |
| 11 | VisibilityBadge displays correct label and color for all 4 levels | VERIFIED | Both portfolio-view.tsx and resume-view.tsx have identical 4-case switch with Global=purple, Company=blue, Portable=green, Private=gray |

**Score:** 10/11 truths verified (1 failed due to unapplied migration)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/lib/visibility.ts` | Centralized visibility helpers for all 4 levels | VERIFIED | 68 lines, exports VISIBILITY_LEVELS, VisibilityLevel, ORG_VISIBLE_LEVELS, isOrgVisible, orgVisibleSQL, buildVisibilityFilter, visibilitySQL |
| `packages/db/src/migrations/0038_extend_visibility.sql` | CHECK constraint + modified RLS policy | PARTIAL | File exists (24 lines) with correct SQL but NOT APPLIED to database |
| `packages/db/src/lib/__tests__/visibility.test.ts` | Unit tests for all visibility helpers | VERIFIED | 203 lines, 17 tests covering all helpers, all pass |
| `apps/web/lib/trending.ts` | Trending query with global_approved | VERIFIED | Line 55: `AND s.visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/leaderboard.ts` | Leaderboard query with global_approved | VERIFIED | Line 59: `AND s.visibility IN ('global_approved', 'tenant')` |
| `apps/web/app/actions/skills.ts` | Skill creation with 4-level Zod + admin gate | VERIFIED | Line 48: 4-level enum, lines 155+366: admin gates, line 12: isAdmin imported |
| `apps/web/components/skill-upload-form.tsx` | Upload form with 4 visibility radio buttons | VERIFIED | Lines 200-268: all 4 options, Global wrapped in isAdmin conditional |
| `apps/web/app/(protected)/skills/new/page.tsx` | Server component passing isAdmin prop | VERIFIED | Lines 5-7: auth() + isAdmin() called, line 16: passed as prop |
| `apps/web/components/portfolio-view.tsx` | VisibilityBadge handling 4 levels | VERIFIED | Lines 27-56: 4-case switch with distinct colors |
| `apps/web/components/resume-view.tsx` | VisibilityBadge handling 4 levels | VERIFIED | Lines 51-80: identical to portfolio-view |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| skill-upload-form.tsx | skills.ts | form submission with visibility field | WIRED | 4 radio inputs with `name="visibility"`, server action reads `formData.get("visibility")` at 3 locations |
| skills/new/page.tsx | admin.ts | isAdmin(session) check | WIRED | Line 3: imports isAdmin, line 7: calls it, line 16: passes result |
| skills/new/page.tsx | skill-upload-form.tsx | isAdmin boolean prop | WIRED | Line 16: `<SkillUploadForm isAdmin={admin} />`, form accepts prop line 13 |
| buildVisibilityFilter | schema/skills | imports skills table | WIRED | visibility.ts line 2: imports skills, used in lines 44+47-52 |
| hybrid-search.ts | visibility.ts | visibilitySQL helper | WIRED | Line 3: imports visibilitySQL, used lines 33+107 |
| semantic-search.ts | visibility.ts | buildVisibilityFilter helper | WIRED | Line 6: imports buildVisibilityFilter, used line 50 |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| VIS-01: Skills support 4 visibility levels | SATISFIED | All 4 levels in code, schema comment updated, helpers support all levels |
| VIS-02: Visibility filter enforces all 4 levels correctly | SATISFIED | buildVisibilityFilter and visibilitySQL implement correct logic, 17 unit tests pass |
| VIS-03: Global approved skills visible across tenants via RLS | BLOCKED | Drizzle schema has updated policy but migration not applied to DB - RLS still tenant-only |
| VIS-04: Author can select visibility when creating/editing | SATISFIED | Upload form has 4 radio buttons, server action accepts all 4 via Zod |
| VIS-05: Only admins can promote to global_approved | SATISFIED | Server-side admin gate at 2 locations blocks non-admins, MCP tools reject global_approved |

### Anti-Patterns Found

No blocking anti-patterns detected. Scanned 19 modified files - all substantive implementations with no stub patterns, placeholder logic, or empty returns.

### Human Verification Required

#### 1. Visual Upload Form Rendering

**Test:** Sign in as non-admin, navigate to /skills/new, observe visibility radio buttons.

**Expected:** Should see exactly 3 options: Team, Personal, Private. Should NOT see Global option.

**Why human:** Visual layout verification - need to confirm radio buttons render correctly and Global is hidden.

#### 2. Admin Global Option Visibility

**Test:** Sign in as admin user, navigate to /skills/new, observe visibility radio buttons.

**Expected:** Should see all 4 options: Team, Personal, Private, Global. Global option should have "(admin only)" in description.

**Why human:** Admin role detection requires testing with actual admin account.

#### 3. Admin Gate Enforcement

**Test:** As non-admin, attempt to create skill with visibility=global_approved via direct form manipulation (browser DevTools).

**Expected:** Server action should reject with error "Only admins can set global visibility". Skill should NOT be created.

**Why human:** Security boundary testing requires adversarial form manipulation.

#### 4. Badge Color Display

**Test:** View portfolio or resume page with skills of different visibility levels.

**Expected:** Global badge is purple, Company badge is blue, Portable badge is green, Private badge is gray.

**Why human:** Visual color verification across different visibility levels.

#### 5. Cross-Tenant Global Skill Visibility (BLOCKED)

**Test:** After migration applied - Create global_approved skill in tenant A, search from tenant B.

**Expected:** Global skill appears in tenant B search results but tenant A's tenant-scoped skills do not.

**Why human:** Multi-tenant testing with two different tenant contexts. Currently blocked on migration application.

### Gaps Summary

**One critical gap blocks full phase completion:**

The migration 0038 was created and committed but never applied to the database. This means:

1. No CHECK constraint exists - database allows invalid visibility values (though application layer prevents this via Zod)
2. RLS policy still restricts to same-tenant only - global_approved skills CANNOT be seen across tenants
3. Success criterion 2 cannot be verified: "A user in tenant A can see global_approved skills from tenant B"

The Drizzle schema file (packages/db/src/schema/skills.ts) has the CORRECT RLS policy definition with the global_approved clause, but Drizzle's pgPolicy() is a schema-level construct that doesn't auto-apply to the database - it's for documentation/type generation only. The actual policy change requires running the SQL migration.

**All other work is complete and correct:**
- Centralized helpers support 4 levels
- All inline queries updated
- UI shows 4 options with admin gating
- Server actions enforce admin gate
- MCP tools reject global_approved
- 17 unit tests pass
- No type errors

**To close this gap:** Run `pnpm db:migrate` to apply migration 0038, then verify the RLS policy and CHECK constraint in the database.

---

_Verified: 2026-02-16T19:54:00Z_
_Verifier: Claude (gsd-verifier)_
