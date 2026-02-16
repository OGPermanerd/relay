---
phase: 70-mcp-preference-sync
verified: 2026-02-16T21:15:00Z
status: passed
score: 8/8 must-haves verified
must_haves:
  truths:
    - "Authenticated MCP user can call get_preferences and receive their preferredCategories and defaultSort"
    - "Authenticated MCP user can call set_preferences with preferredCategories and/or defaultSort and the change persists"
    - "set_preferences preserves claudeMdWorkflowNotes and trainingDataConsent fields (read-modify-write)"
    - "Unauthenticated MCP user calling get_preferences or set_preferences receives a clear auth error"
    - "Authenticated MCP search results boost skills in user's preferred categories to top of results"
    - "Authenticated MCP recommend results boost skills in user's preferred categories via similarity score multiplier"
    - "Authenticated MCP list results respect user's defaultSort preference"
    - "Anonymous (no API key) MCP search/recommend/list still works without errors (no boost, default sort)"
  artifacts:
    - path: "apps/mcp/src/tools/preferences.ts"
      provides: "handleGetPreferences and handleSetPreferences handler functions"
      exports: ["handleGetPreferences", "handleSetPreferences"]
    - path: "apps/mcp/src/tools/everyskill.ts"
      provides: "get_preferences and set_preferences in ACTIONS, schema fields, switch cases"
      contains: "get_preferences"
    - path: "apps/mcp/src/tools/search.ts"
      provides: "Preference boost reranking for text search"
      contains: "getOrCreateUserPreferences"
    - path: "apps/mcp/src/tools/recommend.ts"
      provides: "Preference boost for semantic search via PREFERENCE_BOOST multiplier"
      contains: "PREFERENCE_BOOST"
    - path: "apps/mcp/src/tools/list.ts"
      provides: "defaultSort preference applied to list ordering"
      contains: "getOrCreateUserPreferences"
  key_links:
    - from: "apps/mcp/src/tools/everyskill.ts"
      to: "apps/mcp/src/tools/preferences.ts"
      via: "import handleGetPreferences, handleSetPreferences"
      pattern: "import.*handleGetPreferences.*preferences"
    - from: "apps/mcp/src/tools/preferences.ts"
      to: "@everyskill/db/services/user-preferences"
      via: "getOrCreateUserPreferences, updateUserPreferences"
      pattern: "getOrCreateUserPreferences|updateUserPreferences"
    - from: "apps/mcp/src/tools/search.ts"
      to: "@everyskill/db/services/user-preferences"
      via: "getOrCreateUserPreferences"
      pattern: "getOrCreateUserPreferences"
    - from: "apps/mcp/src/tools/recommend.ts"
      to: "@everyskill/db/services/user-preferences"
      via: "getOrCreateUserPreferences"
      pattern: "getOrCreateUserPreferences"
    - from: "apps/mcp/src/tools/list.ts"
      to: "@everyskill/db/services/user-preferences"
      via: "getOrCreateUserPreferences for defaultSort"
      pattern: "getOrCreateUserPreferences"
---

# Phase 70: MCP Preference Sync Verification Report

**Phase Goal:** Users' search preferences flow bidirectionally between the web UI and MCP tools
**Verified:** 2026-02-16T21:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Authenticated MCP user can call get_preferences and receive their preferredCategories and defaultSort | ✓ VERIFIED | handleGetPreferences in preferences.ts (lines 28-58) returns preferredCategories array and defaultSort string from DB |
| 2 | Authenticated MCP user can call set_preferences with preferredCategories and/or defaultSort and the change persists | ✓ VERIFIED | handleSetPreferences (lines 64-117) calls updateUserPreferences which writes to userPreferences table via Drizzle ORM |
| 3 | set_preferences preserves claudeMdWorkflowNotes and trainingDataConsent fields (read-modify-write) | ✓ VERIFIED | Lines 78-86 in preferences.ts: reads current prefs, builds merged object with all 4 fields, conditionally overwrites only provided fields |
| 4 | Unauthenticated MCP user calling get_preferences or set_preferences receives a clear auth error | ✓ VERIFIED | authError() helper (lines 9-22) returns "Authentication required" + "Set EVERYSKILL_API_KEY" message when !userId or !tenantId |
| 5 | Authenticated MCP search results boost skills in user's preferred categories to top of results | ✓ VERIFIED | search.ts lines 28-48: loads prefs, tags results with isBoosted, stable sort moves boosted to top |
| 6 | Authenticated MCP recommend results boost skills in user's preferred categories via similarity score multiplier | ✓ VERIFIED | recommend.ts lines 66-99: PREFERENCE_BOOST=1.3 (line 8), multiplies similarity for semantic (lines 74-81), stable rerank for text fallback (lines 84-93) |
| 7 | Authenticated MCP list results respect user's defaultSort preference | ✓ VERIFIED | list.ts lines 45-67: loads defaultSort from prefs, switch/case maps to Drizzle orderBy (uses/quality/rating/days_saved) |
| 8 | Anonymous (no API key) MCP search/recommend/list still works without errors (no boost, default sort) | ✓ VERIFIED | All three handlers guard with "if (userId && tenantId)" and wrap in try/catch — anonymous path skips boost/sort logic entirely |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mcp/src/tools/preferences.ts` | handleGetPreferences and handleSetPreferences exported | ✓ VERIFIED | 118 lines, exports both handlers (lines 28, 64), imports from @everyskill/db/services/user-preferences (lines 3-6) |
| `apps/mcp/src/tools/everyskill.ts` | get_preferences and set_preferences in ACTIONS, schema, types, switch cases | ✓ VERIFIED | ACTIONS array includes both (lines 37-38), EverySkillInputSchema has preferredCategories + defaultSort (lines 126-133), switch cases route to handlers (lines 273-283) |
| `apps/mcp/src/tools/search.ts` | Preference boost reranking for text search | ✓ VERIFIED | Imports getOrCreateUserPreferences (line 2), applies stable sort reranking (lines 28-48) |
| `apps/mcp/src/tools/recommend.ts` | Preference boost for semantic search via PREFERENCE_BOOST multiplier | ✓ VERIFIED | PREFERENCE_BOOST constant = 1.3 (line 8), multiplies similarity for semantic results (lines 74-81), stable rerank for text (lines 84-93) |
| `apps/mcp/src/tools/list.ts` | defaultSort preference applied to list ordering | ✓ VERIFIED | Imports getOrCreateUserPreferences (line 5), resolves defaultSort (lines 45-67), applies orderBy to DB query (lines 69-80) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| everyskill.ts | preferences.ts | import handleGetPreferences, handleSetPreferences | ✓ WIRED | Line 17: import statement confirmed, switch cases (273-283) call handlers |
| preferences.ts | @everyskill/db/services/user-preferences | getOrCreateUserPreferences, updateUserPreferences | ✓ WIRED | Lines 3-6: imports confirmed, called in handleGetPreferences (line 34) and handleSetPreferences (lines 79, 89) |
| search.ts | @everyskill/db/services/user-preferences | getOrCreateUserPreferences | ✓ WIRED | Line 2: import confirmed, called line 31 |
| recommend.ts | @everyskill/db/services/user-preferences | getOrCreateUserPreferences | ✓ WIRED | Line 3: import confirmed, called line 69 |
| list.ts | @everyskill/db/services/user-preferences | getOrCreateUserPreferences | ✓ WIRED | Line 5: import confirmed, called line 49 |

**Critical bidirectional wiring verified:**
- MCP → DB: All 5 MCP handlers call getOrCreateUserPreferences/updateUserPreferences from @everyskill/db/services/user-preferences
- Web → DB: apps/web/app/actions/user-preferences.ts (lines 5-8) imports same services, calls in getMyUserPreferences (line 28) and saveMyUserPreferences (line 75)
- DB service layer: packages/db/src/services/user-preferences.ts provides getOrCreateUserPreferences (lines 21-48) and updateUserPreferences (lines 54-63) using Drizzle ORM
- **Bidirectional proof:** Both MCP and web UI call the same DB service functions, so changes flow in both directions through the same persistence layer

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| VIS-06: MCP tools can read and write user search preferences | ✓ SATISFIED | Truths 1-4 verified (get_preferences + set_preferences actions implemented) |
| VIS-07: MCP search applies user preference boosts when authenticated | ✓ SATISFIED | Truths 5-7 verified (search, recommend, list all apply preference boosts) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

**Scan details:**
- No TODO/FIXME/PLACEHOLDER comments in modified files
- No empty implementations (return null/{}/)
- No console.log-only implementations
- All handlers have substantive logic (auth guards, DB calls, response formatting)
- All handlers use try/catch for graceful degradation
- Read-modify-write pattern correctly implemented in set_preferences

### Human Verification Required

None. All truths are verifiable programmatically via code inspection:
1. **Handler logic verified:** get_preferences returns DB values, set_preferences persists via updateUserPreferences
2. **Persistence verified:** DB service layer uses Drizzle ORM with real UPDATE statement (user-preferences.ts line 59-62)
3. **Boost logic verified:** PREFERENCE_BOOST=1.3 matches web UI value in apps/web/app/actions/discover.ts
4. **Wiring verified:** All imports and function calls traced through codebase
5. **Bidirectionality verified:** Same DB service layer (@everyskill/db/services/user-preferences) used by both MCP and web UI

If manual testing is desired (not required for verification):
- **Test 1:** Update preferences in web UI settings page, call MCP get_preferences, confirm values match
- **Test 2:** Call MCP set_preferences, reload web UI settings page, confirm values match
- **Test 3:** Set preferred category "productivity", search via MCP, confirm productivity skills appear first

### Gaps Summary

None. Phase goal fully achieved.

---

## Detailed Verification Evidence

### Truth 1: MCP get_preferences returns current preferences
**Code location:** apps/mcp/src/tools/preferences.ts, lines 28-58
**Verification:**
- Line 34: `const prefs = await getOrCreateUserPreferences(userId, tenantId);`
- Lines 49-50: Returns `preferredCategories: prefs?.preferredCategories ?? []` and `defaultSort: prefs?.defaultSort ?? "days_saved"`
- DB service (packages/db/src/services/user-preferences.ts line 28-48) queries userPreferences table, returns JSONB preferences field

### Truth 2: MCP set_preferences persists changes
**Code location:** apps/mcp/src/tools/preferences.ts, lines 64-117
**Verification:**
- Line 79: `const current = await getOrCreateUserPreferences(userId, tenantId);` — reads current state
- Lines 80-87: Builds merged object with current + new values
- Line 89: `await updateUserPreferences(userId, merged);` — persists to DB
- DB service (packages/db/src/services/user-preferences.ts line 59-62) runs Drizzle UPDATE statement

### Truth 3: set_preferences preserves non-exposed fields
**Code location:** apps/mcp/src/tools/preferences.ts, lines 78-87
**Verification:**
- Line 79: Reads current preferences (includes all 4 fields: preferredCategories, defaultSort, claudeMdWorkflowNotes, trainingDataConsent)
- Lines 80-84: Initializes merged object with all 4 fields from current state
- Lines 85-86: Conditionally spreads preferredCategories and defaultSort ONLY if provided (not undefined)
- Result: claudeMdWorkflowNotes and trainingDataConsent are never overwritten, only carried forward

### Truth 4: Unauthenticated users receive clear auth error
**Code location:** apps/mcp/src/tools/preferences.ts, lines 9-22, 29, 32, 73, 76
**Verification:**
- authError() helper (lines 9-22) returns structured error: `{ error: "Authentication required", message: "Set EVERYSKILL_API_KEY to access your preferences" }`
- handleGetPreferences guards: line 29 (!userId), line 32 (!tenantId)
- handleSetPreferences guards: line 73 (!userId), line 76 (!tenantId)
- All guards return authError() immediately

### Truth 5: MCP search applies preference boost
**Code location:** apps/mcp/src/tools/search.ts, lines 28-48
**Verification:**
- Line 29: Guards with `if (userId && tenantId)` — skips for anonymous
- Line 31: Loads preferences via `getOrCreateUserPreferences`
- Line 32: Extracts preferredCategories as `string[]`
- Lines 34-37: Tags each result with `isBoosted: preferred.includes(r.category)`
- Lines 38-42: Stable sort — boosted items move to top, preserving relative order within groups
- Line 43: Assigns boosted results back

### Truth 6: MCP recommend applies preference boost (similarity multiplier)
**Code location:** apps/mcp/src/tools/recommend.ts, lines 8, 66-99
**Verification:**
- Line 8: `const PREFERENCE_BOOST = 1.3;` — matches web UI (apps/web/app/actions/discover.ts)
- Line 67: Guards with `if (userId && tenantId)` — skips for anonymous
- Line 69: Loads preferences via `getOrCreateUserPreferences`
- Line 70: Extracts preferredCategories as `string[]`
- Lines 72-81: If semantic search, multiplies similarity score by 1.3 for preferred categories, re-sorts by similarity desc
- Lines 83-93: If text fallback, uses stable reranking (same as search.ts)

### Truth 7: MCP list respects defaultSort preference
**Code location:** apps/mcp/src/tools/list.ts, lines 45-67, 79
**Verification:**
- Line 46: Default `sortColumn = desc(skills.hoursSaved)` (days_saved)
- Line 47: Guards with `if (userId && tenantId)` — skips for anonymous
- Line 49: Loads preferences via `getOrCreateUserPreferences`
- Line 50: Extracts `defaultSort ?? "days_saved"`
- Lines 51-63: Switch/case maps to Drizzle orderBy:
  - "uses" → `desc(skills.totalUses)`
  - "quality"/"rating" → `desc(skills.averageRating)`
  - "days_saved" → `desc(skills.hoursSaved)`
- Line 79: Applies `orderBy(sortColumn)` to DB query

### Truth 8: Anonymous users unaffected
**Code location:** All three handlers (search.ts, recommend.ts, list.ts)
**Verification:**
- **search.ts line 29:** `if (userId && tenantId)` — boost logic only runs for authenticated users
- **recommend.ts line 67:** `if (userId && tenantId)` — boost logic only runs for authenticated users
- **list.ts line 47:** `if (userId && tenantId)` — defaultSort resolution only runs for authenticated users, otherwise uses default (line 46)
- **All wrapped in try/catch** (search.ts line 30-47, recommend.ts line 68-98, list.ts line 48-66) — preference failures never break core functionality
- **Anonymous path:** All three handlers work without userId — search/recommend return unmodified results, list uses default sort

---

## Commit Verification

All commits from both plans are present in git history and match the summaries:

1. **829a687** — feat(70-01): add get_preferences and set_preferences MCP actions
   - Created apps/mcp/src/tools/preferences.ts (117 lines)
   - Modified apps/mcp/src/tools/everyskill.ts (30 lines added)
   - Matches 70-01-SUMMARY.md

2. **0da1557** — feat(70-02): add preference-based reranking to MCP search
   - Modified apps/mcp/src/tools/search.ts (25 lines added)
   - Matches 70-02-SUMMARY.md task 1

3. **6964a4a** — feat(70-02): add preference boost to recommend and defaultSort to list
   - Modified apps/mcp/src/tools/recommend.ts (38 lines added)
   - Modified apps/mcp/src/tools/list.ts (28 lines added)
   - Matches 70-02-SUMMARY.md task 2

---

## Bidirectional Flow Validation

**Question:** Do preferences truly flow bidirectionally between web UI and MCP?

**Answer:** YES — verified via shared persistence layer.

**Evidence chain:**

1. **Shared DB service layer:**
   - Package: `@everyskill/db/services/user-preferences`
   - Functions: `getOrCreateUserPreferences`, `updateUserPreferences`
   - Implementation: Drizzle ORM queries against `userPreferences` table (JSONB column)

2. **MCP usage:**
   - preferences.ts: imports and calls (lines 3-6, 34, 79, 89)
   - search.ts: imports and calls (lines 2, 31)
   - recommend.ts: imports and calls (lines 3, 69)
   - list.ts: imports and calls (lines 5, 49)

3. **Web UI usage:**
   - apps/web/app/actions/user-preferences.ts: imports and calls (lines 5-8, 28, 75)
   - apps/web/app/actions/discover.ts: imports and calls (lines 3-8, 31) — applies PREFERENCE_BOOST=1.3
   - apps/web/app/actions/export-claude-md.ts: imports and calls (lines 3, 19)

4. **Same data structure:**
   - Both MCP and web UI use `UserPreferencesData` interface (defined in packages/db/src/schema/user-preferences.ts lines 10-15)
   - Both read/write the same 4 fields: preferredCategories, defaultSort, claudeMdWorkflowNotes, trainingDataConsent

5. **Persistence proof:**
   - DB service (packages/db/src/services/user-preferences.ts):
     - Line 28-31: SELECT query reads from userPreferences table
     - Line 59-62: UPDATE query writes to userPreferences table with `preferences` JSONB column
   - Schema (packages/db/src/schema/user-preferences.ts line 36): `preferences: jsonb("preferences").notNull().default("{}").$type<UserPreferencesData>()`

**Conclusion:** MCP set_preferences → DB update → web UI reads updated value on next page load. Web UI save → DB update → MCP get_preferences reads updated value on next call. Both directions use the same Postgres table, same JSONB column, same service functions.

---

_Verified: 2026-02-16T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
