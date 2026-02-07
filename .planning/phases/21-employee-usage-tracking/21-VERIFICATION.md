---
phase: 21-employee-usage-tracking
verified: 2026-02-05T12:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 21: Employee Usage Tracking Verification Report

**Phase Goal:** Every MCP tool call and install event is attributed to the specific employee, with a personal dashboard showing their activity.
**Verified:** 2026-02-05
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When an employee has EVERYSKILL_API_KEY configured, every MCP tool call (search, list, deploy) records their userId in usage_events | VERIFIED | `auth.ts` resolves userId from EVERYSKILL_API_KEY via `validateApiKey()`, caches result. All three tool handlers (`search.ts:57`, `list.ts:41`, `deploy.ts:50`) pass `userId: getUserId() ?? undefined` to `trackUsage()`. `trackUsage` in `events.ts` inserts directly into `usageEvents` table which has `userId` column with FK to users. |
| 2 | When no API key is configured, MCP tools continue working with anonymous tracking | VERIFIED | `auth.ts:26-28` returns null if no EVERYSKILL_API_KEY. All tools check `getUserId() === null` and call `incrementAnonymousCount()`. `trackUsage` receives `userId: undefined` and inserts with null userId. No error thrown on missing key. Nudge message shown every 5th anonymous call. |
| 3 | Install scripts send a callback to Relay on successful install, recording employee, platform, OS, and skill | VERIFIED | `install-script.ts` generates both bash (line 120-123: `curl -s -X POST .../api/install-callback`) and PowerShell (line 66: `Invoke-WebRequest`) scripts that POST to `/api/install-callback` with `{key, platform, os}`. Scripts read EVERYSKILL_API_KEY from config for attribution. The endpoint (`route.ts`) records `install_confirmed` event with userId resolved from key, plus platform/os/clientVersion in metadata. |
| 4 | The "My Usage" page shows an employee their personal skill usage history, frequency breakdown, and cumulative hours saved | VERIFIED | Home page (`page.tsx`) fetches all 4 leverage queries in parallel (`getSkillsUsed`, `getSkillsUsedStats`, `getSkillsCreated`, `getSkillsCreatedStats`) for `user.id`. `HomeTabs` component shows "My Leverage" tab. `MyLeverageView` renders stat cards (Skills Used, FTE Hours Saved, Total Actions, Most Used, Skills Published, Hours Saved by Others, Unique Users, Avg Rating) and a paginated timeline. `loadMoreUsage` server action provides pagination. |
| 5 | Install events distinguish between deploy intent (MCP deploy_skill) and confirmed installation (callback received) | VERIFIED | Deploy tool uses `toolName: "deploy_skill"` (deploy.ts:50). Install callback uses `toolName: "install_confirmed"` (route.ts:56). Both are stored in the same `usage_events` table, distinguishable by `toolName` column. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mcp/src/auth.ts` | MCP auth module | VERIFIED (80 lines) | resolveUserId, getUserId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage all exported and substantive |
| `apps/mcp/src/index.ts` | Calls resolveUserId on startup | VERIFIED (22 lines) | `await resolveUserId()` called before `server.connect()` (line 10) |
| `apps/mcp/src/tools/search.ts` | userId wiring in trackUsage | VERIFIED (107 lines) | Imports getUserId, passes to trackUsage (line 58) |
| `apps/mcp/src/tools/list.ts` | userId wiring in trackUsage | VERIFIED (89 lines) | Imports getUserId, passes to trackUsage (line 42) |
| `apps/mcp/src/tools/deploy.ts` | userId wiring in trackUsage | VERIFIED (112 lines) | Imports getUserId, passes to trackUsage (line 52) |
| `apps/mcp/src/tracking/events.ts` | trackUsage inserts with userId | VERIFIED (27 lines) | Accepts `Omit<NewUsageEvent, "id" | "createdAt">` which includes userId, inserts into usageEvents |
| `apps/web/app/api/install-callback/route.ts` | Install callback endpoint | VERIFIED (77 lines) | POST handler, resolves userId from key, inserts install_confirmed event with metadata |
| `apps/web/middleware.ts` | install-callback exemption | VERIFIED (35 lines) | Line 11: `isInstallCallback` check, line 14: early return allowing unauthenticated access |
| `apps/web/lib/install-script.ts` | Install scripts with callback | VERIFIED (155 lines) | Both bash and PowerShell scripts include POST to /api/install-callback with key/platform/os |
| `apps/web/lib/my-leverage.ts` | Analytics queries (4 functions) | VERIFIED (241 lines) | getSkillsUsed, getSkillsUsedStats, getSkillsCreated, getSkillsCreatedStats -- all with real SQL queries |
| `apps/web/components/home-tabs.tsx` | Tab toggle | VERIFIED (48 lines) | nuqs-based tab switching between Browse Skills and My Leverage |
| `apps/web/components/my-leverage-view.tsx` | Leverage view with stats + timeline | VERIFIED (227 lines) | StatCard grid, timeline list with ActionBadge/CategoryBadge, Load More pagination |
| `apps/web/app/(protected)/page.tsx` | Home page with tabs | VERIFIED (293 lines) | Parallel data fetching, HomeTabs + MyLeverageView wiring, date serialization |
| `apps/web/app/actions/my-leverage.ts` | Load more server action | VERIFIED (28 lines) | Authenticated server action, calls getSkillsUsed with offset |
| `packages/db/src/schema/usage-events.ts` | Usage events schema | VERIFIED (18 lines) | usageEvents table with userId FK to users, toolName, skillId, metadata jsonb |
| `packages/db/src/relations/index.ts` | usageEvents relations | VERIFIED | usageEventsRelations defined with skill and user relations (lines 94-103) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth.ts | api-keys service | `validateApiKey(apiKey)` import | WIRED | Line 1: imports from @everyskill/db/services/api-keys, line 32: calls validateApiKey |
| index.ts | auth.ts | `import + await resolveUserId()` | WIRED | Line 3: imports resolveUserId, line 10: awaits it before server.connect |
| search.ts | auth.ts | `getUserId()` import + call | WIRED | Line 5: imports 4 auth functions, lines 52-58: uses them |
| list.ts | auth.ts | `getUserId()` import + call | WIRED | Line 5: imports 4 auth functions, lines 36-42: uses them |
| deploy.ts | auth.ts | `getUserId()` import + call | WIRED | Line 5: imports 4 auth functions, lines 44-52: uses them |
| trackUsage | usageEvents | `db.insert(usageEvents).values(event)` | WIRED | events.ts line 15: direct insert |
| install-callback route | usageEvents | `db.insert(usageEvents).values(...)` | WIRED | route.ts line 55: inserts install_confirmed event |
| install-script.ts | install-callback | `curl POST / Invoke-WebRequest` | WIRED | bash line 120-123, PowerShell line 66 |
| middleware.ts | install-callback | path exemption | WIRED | Line 11+14: isInstallCallback allows unauthenticated access |
| page.tsx | my-leverage.ts | import + parallel fetch | WIRED | Lines 8-12: imports 4 functions, lines 113-121: Promise.all |
| page.tsx | MyLeverageView | import + props | WIRED | Line 18: imports, lines 267-274: passes all props |
| page.tsx | HomeTabs | import + render | WIRED | Line 17: imports, line 290: renders with browseContent + leverageContent |
| MyLeverageView | loadMoreUsage | import + call | WIRED | Line 5: imports server action, line 105: calls in handleLoadMore |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| TRK-01: MCP tools include userId in every trackUsage() call when API key configured | SATISFIED | None |
| TRK-02: API key resolves to userId on each MCP request | SATISFIED | None |
| TRK-03: Graceful degradation -- anonymous tracking if no API key configured | SATISFIED | None |
| TRK-04: "My Usage" page showing individual employee's skill usage, frequency, and hours saved | SATISFIED | None |
| INST-01: Install callback endpoint receives confirmation from shell install scripts | SATISFIED | None |
| INST-02: Install events tracked per platform, OS, employee, and skill | SATISFIED | None |
| INST-03: Install vs. deploy intent distinction (deploy_skill vs confirmed install) | SATISFIED | None |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/tests/e2e/install-callback.spec.ts` | 17 | TS2769: `page.evaluate` callback parameter type mismatch (`baseURL` can be `string | undefined` but callback expects `string`) | Info | Test passes at runtime; only strict TS compile issue in test file, not production code |

### Playwright Test Results

All 14 E2E tests pass (14/14):
- 3 authentication flow tests
- 7 home page tab tests (Browse Skills default, My Leverage click, direct URL, headings, stat cards, tab switching)
- 4 install callback API tests (valid POST, invalid JSON 400, anonymous install, all optional fields)

### TypeScript Compilation

- `apps/mcp/tsconfig.json`: Clean (0 errors)
- `apps/web/tsconfig.json`: 1 error in test file only (TS2769 in install-callback.spec.ts line 17 -- `baseURL` typing)
- Production code compiles without errors

### Human Verification Required

#### 1. Visual appearance of My Leverage tab
**Test:** Navigate to `/?view=leverage` and verify stat cards and timeline render correctly
**Expected:** 8 stat cards in two sections (Skills Used / Skills Created), empty-state messages when no data
**Why human:** Visual layout and styling cannot be verified programmatically

#### 2. Tab switching animation/behavior
**Test:** Click between "Browse Skills" and "My Leverage" tabs
**Expected:** Smooth content switch, URL updates with `?view=leverage`, active tab highlighted blue
**Why human:** Interactive behavior and visual feedback need human observation

#### 3. Load More pagination on timeline
**Test:** With usage data, click "Load More" button on My Leverage tab
**Expected:** Additional timeline entries append below existing ones, button disappears when all loaded
**Why human:** Requires seeded usage data and real interaction

### Gaps Summary

No gaps found. All 5 success criteria are fully met by the codebase:

1. **MCP userId attribution** -- auth.ts resolves userId from EVERYSKILL_API_KEY, all 3 tool handlers pass it to trackUsage which inserts into usage_events.userId column.
2. **Anonymous graceful degradation** -- Missing/invalid key results in null userId (no error), nudge every 5th call, all tools continue working.
3. **Install script callbacks** -- Both bash and PowerShell scripts POST to /api/install-callback with key/platform/os. Endpoint records install_confirmed events with optional userId resolution.
4. **My Leverage dashboard** -- Full implementation with 4 SQL analytics queries, server-rendered stat cards, paginated timeline, "Skills Used" and "Skills Created" sections, load-more server action.
5. **Deploy vs install distinction** -- deploy_skill (MCP tool) vs install_confirmed (callback) toolName values in same usage_events table.

---

_Verified: 2026-02-05_
_Verifier: Claude (gsd-verifier)_
