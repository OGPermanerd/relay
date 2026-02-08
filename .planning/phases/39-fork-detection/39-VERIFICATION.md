---
phase: 39-fork-detection
verified: 2026-02-08T22:15:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 39: Fork Detection Verification Report

**Phase Goal:** Users know when their local skill copy has diverged from the published version and can push changes back or create forks

**Verified:** 2026-02-08T22:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Forking a skill stores the parent's content hash at fork time for drift detection | ✓ VERIFIED | `fork-skill.ts` computes `parentBodyHash` from stripped content, stores in `forkedAtContentHash` column (line 64, 80) |
| 2 | Forking a skill creates a skill_versions record so fork is not orphaned | ✓ VERIFIED | `fork-skill.ts` inserts into `skillVersions` table and sets `publishedVersionId` (lines 96-119) |
| 3 | check_skill_status compares local file hash against DB published version | ✓ VERIFIED | `check-skill-status.ts` reads local file, fetches DB content, computes hashes, returns "current", "diverged", or "not_installed" (lines 32-150) |
| 4 | Hash comparison strips YAML frontmatter before hashing | ✓ VERIFIED | Both `check-skill-status.ts` and `update-skill.ts` use `stripFrontmatter()` helper (lines 15-18) that removes YAML frontmatter with regex before hashing |
| 5 | Authors can push local modifications back as new version via update_skill | ✓ VERIFIED | `update-skill.ts` author path (lines 119-179) creates new `skill_versions` record, updates content, sets status to draft |
| 6 | Non-authors who call update_skill get a fork created with proper records | ✓ VERIFIED | `update-skill.ts` non-author path (lines 182-251) creates fork with `forkedAtContentHash`, `skill_versions` record, and `publishedVersionId` |
| 7 | Fork detail pages show drift indicator when fork diverged from parent | ✓ VERIFIED | `page.tsx` computes `driftStatus` by comparing current body hash to `forkedAtContentHash` (lines 90-100), passes to `DriftIndicator` component (line 195) |
| 8 | /skills/[slug]/compare page shows side-by-side content comparison | ✓ VERIFIED | `compare/page.tsx` exists, fetches fork and parent, strips frontmatter from both, renders `ReviewDiffView` (lines 1-107) |
| 9 | Forks without forkedAtContentHash show unknown drift status | ✓ VERIFIED | `page.tsx` checks `!skill.forkedAtContentHash` and sets `driftStatus = "unknown"` (lines 98-100) |
| 10 | Forks whose parent was deleted show graceful message on compare page | ✓ VERIFIED | `compare/page.tsx` handles `!parent` case with "Parent skill is no longer available" message (lines 56-72) |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/skills.ts` | forkedAtContentHash column definition | ✓ VERIFIED | Line 70: `forkedAtContentHash: text("forked_at_content_hash")` — nullable text column |
| `packages/db/src/migrations/0017_add_forked_at_content_hash.sql` | ALTER TABLE migration | ✓ VERIFIED | File exists with `ALTER TABLE skills ADD COLUMN forked_at_content_hash text;` |
| `apps/web/app/actions/fork-skill.ts` | Updated fork action with hash + version record | ✓ VERIFIED | 137 lines, exports `forkSkill`, computes `parentBodyHash`, creates `skillVersions` record, sets `publishedVersionId` |
| `apps/mcp/src/tools/check-skill-status.ts` | check_skill_status MCP tool | ✓ VERIFIED | 171 lines, exports `handleCheckSkillStatus`, strips frontmatter from both local and DB before hashing, registered with MCP server |
| `apps/mcp/src/tools/update-skill.ts` | update_skill MCP tool with branching | ✓ VERIFIED | 274 lines, exports `handleUpdateSkill`, author path creates version, non-author path creates fork with `forkedAtContentHash` |
| `apps/mcp/src/tools/index.ts` | Tool registrations | ✓ VERIFIED | Lines 14-15: imports `check-skill-status.js` and `update-skill.js` |
| `apps/web/components/drift-indicator.tsx` | DriftIndicator badge component | ✓ VERIFIED | 37 lines, renders green/amber/gray badge based on drift status, includes compare link for diverged state |
| `apps/web/components/skill-detail.tsx` | DriftIndicator wired into component | ✓ VERIFIED | Line 10: imports `DriftIndicator`, line 81: renders component when `driftStatus` defined |
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | Drift computation and props | ✓ VERIFIED | Lines 90-100: computes drift status with inline `stripFm`, lines 195-196: passes `driftStatus` and `compareSlug` to `SkillDetail` |
| `apps/web/app/(protected)/skills/[slug]/compare/page.tsx` | Side-by-side comparison page | ✓ VERIFIED | 107 lines, fetches fork and parent, handles non-fork/deleted parent gracefully, strips frontmatter, renders `ReviewDiffView` |

**All artifacts present and substantive.**

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `fork-skill.ts` | `skills.forkedAtContentHash` | Column insert | ✓ WIRED | Line 80: `forkedAtContentHash: parentBodyHash` in INSERT values |
| `fork-skill.ts` | `skill_versions` table | INSERT | ✓ WIRED | Lines 99-113: `db.insert(skillVersions).values(...)` with version 1 record |
| `check-skill-status.ts` | `skills` table | DB query | ✓ WIRED | Lines 51-62: `db.select().from(skills).where(eq(skills.id, skillId))` |
| `check-skill-status.ts` | Local filesystem | fs.readFileSync | ✓ WIRED | Line 116: `fs.readFileSync(localPath, "utf-8")` |
| `update-skill.ts` | `skills` table | INSERT or UPDATE | ✓ WIRED | Line 133: INSERT version (author), line 142: UPDATE skill (author), line 196: INSERT fork (non-author) |
| `update-skill.ts` | `skill_versions` table | INSERT | ✓ WIRED | Line 133: INSERT for author path, line 219: INSERT for fork path |
| `page.tsx` | `DriftIndicator` | Component import and render | ✓ WIRED | Line 10: import from `@/components/drift-indicator`, line 195: `<DriftIndicator driftStatus={...} />` |
| `compare/page.tsx` | `ReviewDiffView` | Component import and render | ✓ WIRED | Line 4: import from `@/components/review-diff-view`, line 99: `<ReviewDiffView oldContent={...} newContent={...} />` |

**All key links verified as wired.**

### Requirements Coverage

| Requirement | Status | Supporting Truths |
|-------------|--------|-------------------|
| FORK-01: check_skill_status compares local hash vs DB hash | ✓ SATISFIED | Truth 3 — check-skill-status.ts compares hashes |
| FORK-02: Hash strips frontmatter before hashing | ✓ SATISFIED | Truth 4 — stripFrontmatter() applied to both local and DB content |
| FORK-03: update_skill pushes back or forks | ✓ SATISFIED | Truths 5, 6 — update-skill.ts has both author and non-author paths |
| FORK-04: forkedAtContentHash stored at fork time | ✓ SATISFIED | Truth 1 — fork-skill.ts computes and stores parentBodyHash |
| FORK-05: Fork creates skill_version record | ✓ SATISFIED | Truth 2 — fork-skill.ts creates version record and sets publishedVersionId |
| FORK-06: Web UI shows drift indicator | ✓ SATISFIED | Truth 7 — skill detail page computes drift status and renders DriftIndicator |
| FORK-07: Web UI comparison page shows diff | ✓ SATISFIED | Truth 8 — compare/page.tsx exists with ReviewDiffView |

**All 7 requirements satisfied.**

### Anti-Patterns Found

None — all files are substantive, no TODO/FIXME/placeholder comments, all implementations complete.

### Human Verification Required

#### 1. Visual Drift Indicator Appearance

**Test:** Navigate to a forked skill detail page in the web UI.
**Expected:** DriftIndicator badge appears below ForkAttribution, showing "In sync with parent" (green), "Diverged from parent" with "Compare" link (amber), or "Drift status unknown" (gray).
**Why human:** Visual appearance and color rendering requires browser verification.

#### 2. Fork Comparison Page Rendering

**Test:** Click "Compare" link on a diverged fork, or navigate to `/skills/{slug}/compare` directly.
**Expected:** Side-by-side diff view with parent content on left, fork content on right, with line-by-line additions/deletions highlighted.
**Why human:** Diff rendering quality and readability best assessed visually.

#### 3. MCP Tool Execution

**Test:** Install a skill via MCP, modify the local file, run `check_skill_status` with the skill ID.
**Expected:** Tool returns JSON with `status: "diverged"`, `localHash`, `dbHash`, and message suggesting to use `update_skill`.
**Why human:** MCP tool registration and execution requires MCP server runtime and CLI interaction.

#### 4. Fork Creation via update_skill (Non-Author)

**Test:** As a non-author user, run `update_skill` with modified content for a skill you don't own.
**Expected:** Tool creates a fork with name "{original} (Fork)", sets status to draft, stores `forkedAtContentHash`, creates `skill_versions` record.
**Why human:** Requires multi-user setup and MCP tool execution to verify complete flow.

#### 5. Version Creation via update_skill (Author)

**Test:** As the skill author, run `update_skill` with modified content.
**Expected:** Tool creates a new version, updates skill content, sets status to draft for re-review, does NOT create a fork.
**Why human:** Author path behavior differs from non-author, requires authenticated MCP execution.

---

## Verification Details

### Database Schema

Column `forked_at_content_hash` verified in `everyskill` database:
```
      column_name       | data_type | is_nullable 
------------------------+-----------+-------------
 forked_at_content_hash | text      | YES
```

Migration file `0017_add_forked_at_content_hash.sql` exists and contains:
```sql
ALTER TABLE skills ADD COLUMN forked_at_content_hash text;
```

### Code Verification

**TypeScript compilation:** Clean — no type errors in web app or MCP tools.

**Build verification:** Web app builds successfully, `/skills/[slug]/compare` route compiled.

**Frontmatter stripping consistency:** All four implementations use identical regex pattern `^---\n[\s\S]*?\n---\n` to strip YAML frontmatter.

**Hash function consistency:** Both MCP tools use identical SHA-256 implementation with `crypto.subtle.digest()` and hex encoding.

### Wiring Verification

**MCP tool registration:** Both `check-skill-status.js` and `update-skill.js` imported in `tools/index.ts` (lines 14-15).

**Component imports:** `DriftIndicator` imported in `skill-detail.tsx`, `ReviewDiffView` imported in `compare/page.tsx`.

**Database queries:** All DB queries use correct Drizzle ORM patterns with `eq()` filters and proper column selections.

**File I/O:** `check-skill-status.ts` uses `fs.existsSync()` before `fs.readFileSync()` to avoid errors.

---

_Verified: 2026-02-08T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
