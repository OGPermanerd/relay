---
phase: 49-tenant-resolution-cleanup
verified: 2026-02-14T13:15:00Z
status: gaps_found
score: 3/5 must-haves verified
must_haves:
  truths:
    - "No runtime code path uses DEFAULT_TENANT_ID for tenant resolution"
    - "All server actions have strict tenantId guards (early return on missing)"
    - "MCP tools return errors when tenant not resolved"
    - "New user sign-in resolves tenant via domain-to-tenant mapping"
    - "All tests pass without regressions"
  artifacts:
    - path: "apps/web/app/actions/admin-settings.ts"
      provides: "Admin settings server actions (save, test, backfill)"
    - path: "apps/web/app/actions/skills.ts"
      provides: "Skill CRUD server actions"
    - path: "apps/mcp/src/tools/create.ts"
      provides: "MCP create tool with tenant guard"
    - path: "apps/mcp/src/tracking/events.ts"
      provides: "MCP usage tracking with tenant resolution"
    - path: "packages/db/src/services/skill-reviews.ts"
      provides: "Skill reviews service with required tenantId"
    - path: "apps/web/auth.ts"
      provides: "JWT callback with tenant resolution from domain"
  key_links:
    - from: "auth.ts JWT callback"
      to: "session.user.tenantId"
      via: "getTenantByDomain + token.tenantId + session callback"
    - from: "server actions"
      to: "session.user.tenantId"
      via: "auth() call + destructuring"
    - from: "MCP tools"
      to: "getTenantId()"
      via: "auth.ts cached tenant from API key validation"
gaps:
  - truth: "No runtime code path uses DEFAULT_TENANT_ID for tenant resolution"
    status: failed
    reason: "admin-settings.ts line 141 still uses transitional fallback pattern from Plan 01"
    artifacts:
      - path: "apps/web/app/actions/admin-settings.ts"
        issue: "Line 5 imports DEFAULT_TENANT_ID; line 141 uses session.user.tenantId ?? DEFAULT_TENANT_ID instead of strict guard"
    missing:
      - "Remove DEFAULT_TENANT_ID import from admin-settings.ts"
      - "Add strict tenantId guard: const tenantId = session.user.tenantId; if (!tenantId) return { error: 'Tenant not resolved' }"
      - "Replace line 141 with strict tenantId variable"
  - truth: "All tests pass without regressions"
    status: failed
    reason: "Phase 49 changed MCP tracking to skip when no tenant resolved, but tracking tests were not updated to provide tenantId"
    artifacts:
      - path: "apps/mcp/test/tracking.test.ts"
        issue: "5 of 6 tests fail because events lack tenantId and getTenantId() is not mocked -- trackUsage correctly skips, tests incorrectly expect inserts"
    missing:
      - "Update tracking tests to include tenantId in event data OR mock getTenantId() to return a test tenant ID"
      - "The 5 tools.test.ts failures are PRE-EXISTING (confirmed by running tests on pre-Phase 49 commit) and not a Phase 49 regression"
---

# Phase 49: Tenant Resolution Cleanup Verification Report

**Phase Goal:** All code paths resolve tenant from the authenticated session, eliminating the hardcoded DEFAULT_TENANT_ID constant
**Verified:** 2026-02-14T13:15:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No runtime code path uses DEFAULT_TENANT_ID for tenant resolution | FAILED | `apps/web/app/actions/admin-settings.ts` line 141: `session.user.tenantId ?? DEFAULT_TENANT_ID` -- transitional fallback from Plan 01 was never converted to strict |
| 2 | All server actions have strict tenantId guards | FAILED | 11/12 server actions have strict guards; `admin-settings.ts` backfillEmbeddingsAction uses `??` fallback instead of strict guard with early error return |
| 3 | MCP tools return errors when tenant not resolved | VERIFIED | All 4 MCP tools (create, update-skill, review-skill, submit-for-review) check `getTenantId()` and return `isError` with actionable message when null |
| 4 | New user sign-in resolves tenant via domain-to-tenant mapping | VERIFIED | `auth.ts` JWT callback: `getTenantByDomain(emailDomain)` on initial sign-in, lazy-migration for existing sessions, session callback exposes `tenantId` |
| 5 | All tests pass without regressions | FAILED | E2E: 92 passed (0 regressions). MCP tracking: 2 NEW failures introduced by Phase 49 (tests not updated for strict tenant skipping). MCP tools: 5 failures pre-existing |

**Score:** 2/5 truths verified (truths 3 and 4 passed; 1, 2, and 5 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/actions/skills.ts` | Strict tenantId from session | VERIFIED | Line 183, 386: `const tenantId = session.user.tenantId; if (!tenantId) { ... }` |
| `apps/web/app/actions/ratings.ts` | Strict tenantId from session | VERIFIED | Line 50-51: strict guard |
| `apps/web/app/actions/fork-skill.ts` | Strict tenantId from session | VERIFIED | Line 30-31: strict guard |
| `apps/web/app/actions/api-keys.ts` | Strict tenantId from session | VERIFIED | Line 29-30: strict guard |
| `apps/web/app/actions/user-preferences.ts` | Strict tenantId from session | VERIFIED | Line 24-25: strict guard, returns null |
| `apps/web/app/actions/notification-preferences.ts` | Strict tenantId from session | VERIFIED | Line 27-28: strict guard, returns null |
| `apps/web/app/actions/export-claude-md.ts` | Strict tenantId from session | VERIFIED | Line 24-25: strict guard |
| `apps/web/app/actions/skill-messages.ts` | Strict tenantId from session | VERIFIED | Line 22-23: strict guard |
| `apps/web/app/actions/discover.ts` | Strict tenantId from session | VERIFIED | Line 98-99: strict guard, returns empty array |
| `apps/web/app/actions/get-skill-content.ts` | Conditional tracking with tenantId | VERIFIED | Line 32: skips tracking when no tenantId |
| `apps/web/app/actions/ai-review.ts` | Strict tenantId from session | VERIFIED | Line 62-63: strict guard, passes tenantId to upsertSkillReview |
| `apps/web/app/actions/submit-for-review.ts` | Strict tenantId from session | VERIFIED | Line 27-28: strict guard |
| `apps/web/app/actions/admin-settings.ts` | Strict tenantId from session | STUB | Line 141: uses `?? DEFAULT_TENANT_ID` fallback instead of strict guard |
| `apps/web/app/(protected)/page.tsx` | Strict tenantId with redirect | VERIFIED | Line 27-28: strict guard with redirect |
| `apps/web/app/(protected)/admin/layout.tsx` | Strict tenantId with redirect | VERIFIED | Line 23-24: strict guard |
| `apps/web/app/(protected)/admin/reviews/page.tsx` | Strict tenantId with redirect | VERIFIED | Line 23-24: strict guard |
| `apps/web/app/(protected)/admin/reviews/[skillId]/page.tsx` | Strict tenantId with redirect | VERIFIED | Line 18-19: strict guard |
| `apps/web/app/(protected)/admin/search/page.tsx` | Strict tenantId with redirect | VERIFIED | Line 18-19: strict guard |
| `apps/web/app/(protected)/skills/page.tsx` | Conditional search logging | VERIFIED | Line 43: conditional on both userId and tenantId |
| `packages/db/src/services/skill-reviews.ts` | tenantId required in UpsertSkillReviewParams | VERIFIED | Line 11: `tenantId: string` (not optional) |
| `apps/web/lib/embedding-generator.ts` | tenantId as explicit parameter | VERIFIED | Line 16: `tenantId: string` parameter, no internal DEFAULT_TENANT_ID |
| `apps/web/lib/greeting-pool.ts` | tenantId as explicit parameter | VERIFIED | Line 96, 174: accepts tenantId parameter |
| `apps/mcp/src/tools/create.ts` | Strict getTenantId() guard | VERIFIED | Line 137-138: guard with error return |
| `apps/mcp/src/tools/update-skill.ts` | Strict getTenantId() guard | VERIFIED | Line 88-89: guard with error return |
| `apps/mcp/src/tools/review-skill.ts` | Strict getTenantId() guard | VERIFIED | Line 219, 252: guard with error return |
| `apps/mcp/src/tools/submit-for-review.ts` | Strict getTenantId() guard | VERIFIED | Line 130, 208: guard with error return |
| `apps/mcp/src/tracking/events.ts` | Skip tracking when no tenant | VERIFIED | Line 20-21 (committed): skips with console.warn when no tenantId resolved |
| `apps/web/app/api/mcp/[transport]/route.ts` | tenantId from API key validation | VERIFIED | Line 99: extractTenantId from extra.authInfo; line 478: tenantId from validateApiKey result |
| `apps/web/app/api/install-callback/route.ts` | DEFAULT_TENANT_ID for anonymous only | VERIFIED | Line 10: documented constant; line 42-48: overrides with API key tenant when available |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth.ts JWT callback | session.user.tenantId | getTenantByDomain + token.tenantId | WIRED | Lines 54-58: domain lookup, lines 112-114: session exposure |
| Server actions (11 of 12) | session.user.tenantId | auth() + destructuring | WIRED | All 11 use `const tenantId = session.user.tenantId; if (!tenantId)` pattern |
| admin-settings.ts | session.user.tenantId | auth() + ?? fallback | PARTIAL | Uses `?? DEFAULT_TENANT_ID` instead of strict guard |
| MCP tools (4) | getTenantId() | auth.ts cached tenant | WIRED | All 4 tools call getTenantId() and return error when null |
| HTTP MCP route | API key validation | extractTenantId(extra) | WIRED | tenantId flows from validateApiKey result through extra.tenantId |
| E2E auth.setup.ts | JWT payload | tenantId: DEFAULT_TENANT_ID | WIRED | Line 66: tenantId included in test JWT tokens |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| CLEAN-01: DEFAULT_TENANT_ID resolved from session in all code paths | BLOCKED | admin-settings.ts still uses DEFAULT_TENANT_ID fallback |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/actions/admin-settings.ts` | 141 | `session.user.tenantId ?? DEFAULT_TENANT_ID` | BLOCKER | Transitional fallback pattern that should have been converted to strict guard |
| `apps/web/app/actions/admin-settings.ts` | 5 | `import { ... DEFAULT_TENANT_ID } from "@everyskill/db"` | BLOCKER | Should be removed along with the fallback |
| `apps/mcp/test/tracking.test.ts` | multiple | Test events lack tenantId field | WARNING | Tests don't reflect the new strict tenant checking behavior, causing 5 failures |

### Human Verification Required

### 1. Admin Backfill Embeddings Action

**Test:** Navigate to admin settings, trigger embedding backfill
**Expected:** Should work identically -- the fallback means it will use DEFAULT_TENANT_ID when session.user.tenantId is missing, which is the same value the test JWT now provides
**Why human:** Functional behavior unchanged due to test JWT including tenantId, but the code pattern is still wrong per the phase goal

### Gaps Summary

Two gaps block full goal achievement:

1. **admin-settings.ts missed in cleanup** -- Plan 02's SUMMARY explicitly notes "admin-settings.ts still has DEFAULT_TENANT_ID (out of scope for this plan, will be in Plan 03)" but Plan 03 only addressed MCP tools, tracking, and API routes. The file fell through the cracks between plans. This is a single-file fix: remove the import, add a strict guard, replace the fallback.

2. **MCP tracking tests not updated** -- Phase 49 correctly changed `events.ts` to skip tracking when no tenant is resolved, but the 5 tracking tests that previously passed (because tracking always used DEFAULT_TENANT_ID as fallback) were not updated to provide a tenantId in their test event data. The fix is to either add `tenantId` to the test events or mock `getTenantId()` to return a value. Note: there is also an uncommitted change in the working tree that REVERTS the Phase 49 behavior in events.ts (adds back DEFAULT_TENANT_ID fallback), which should NOT be committed as it contradicts the phase goal.

**Root cause:** Both gaps stem from the same issue: admin-settings.ts was acknowledged as out-of-scope for Plan 02 and was never picked up by Plan 03 or any subsequent plan. The MCP tracking tests were not considered in Plan 03's scope either.

**Note on tools.test.ts:** The 5 failures in `apps/mcp/test/tools.test.ts` are confirmed PRE-EXISTING -- they fail identically on the commit immediately before Phase 49 began. These are not Phase 49 regressions.

### TypeScript Compilation

| Target | Status | Notes |
|--------|--------|-------|
| apps/web | PASSED | Zero errors with `npx tsc --noEmit` |
| apps/mcp | N/A | Pre-existing moduleResolution errors in packages/db (not Phase 49 related) |

### E2E Test Results

| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| Playwright E2E | 92 | 0 | 10 |

### MCP Test Results

| Suite | Passed | Failed | Phase 49 Regressions |
|-------|--------|--------|---------------------|
| tracking.test.ts | 1 | 5 | 2 (3 were pre-existing) |
| tools.test.ts | 23 | 5 | 0 (all pre-existing) |

### DEFAULT_TENANT_ID Usage Census

**Runtime code (violations):**
- `apps/web/app/actions/admin-settings.ts` -- lines 5, 141 (VIOLATION: should be strict session guard)

**Runtime code (acceptable exceptions):**
- `apps/web/app/api/install-callback/route.ts` -- lines 8, 10, 42 (anonymous install tracking, documented)
- `apps/web/app/api/dev-login/route.ts` -- lines 12, 40, 64 (dev-only login, not production)

**Test infrastructure (acceptable):**
- `apps/web/tests/e2e/auth.setup.ts` -- lines 12, 40, 66
- `apps/web/tests/e2e/*.spec.ts` -- 6 test files with fixture data
- `apps/mcp/test/setup.ts` -- line 26

**DB/schema infrastructure (acceptable, explicitly out of scope):**
- `packages/db/src/client.ts` -- lines 26, 41 (constant definition + DB connection default)
- `packages/db/src/index.ts` -- line 6 (re-export)
- `packages/db/src/scripts/backfill-embeddings.ts` -- lines 13, 63 (admin script)

**Documentation/planning (not code):**
- `.planning/` directory -- 100+ references across research, plans, summaries, roadmap

---

_Verified: 2026-02-14T13:15:00Z_
_Verifier: Claude (gsd-verifier)_
