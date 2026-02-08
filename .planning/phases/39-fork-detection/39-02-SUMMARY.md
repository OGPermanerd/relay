---
phase: 39-fork-detection
plan: 02
subsystem: mcp
tags: [mcp-tools, sha256, fork-detection, content-hashing, frontmatter]

# Dependency graph
requires:
  - phase: 34-skill-lifecycle
    provides: skills table with status, content, authorId columns
provides:
  - check_skill_status MCP tool for local vs DB content comparison
  - Frontmatter-stripping hash comparison pattern (FORK-02)
affects: [39-fork-detection, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [frontmatter-strip-before-hash, local-vs-db-drift-detection]

key-files:
  created:
    - apps/mcp/src/tools/check-skill-status.ts
  modified:
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "Read-only status check does not require authentication (allows anonymous drift detection)"
  - "Access control: published OR author-owned (unpublished skills hidden from non-authors)"
  - "Frontmatter stripped from BOTH local and DB content before hashing to prevent false positives from tracking hooks"

patterns-established:
  - "Fork detection pattern: strip frontmatter, SHA-256 hash body, compare local vs DB"

# Metrics
duration: 1min
completed: 2026-02-08
---

# Phase 39 Plan 02: check_skill_status MCP Tool Summary

**SHA-256 content-hash drift detection MCP tool with frontmatter stripping for false-positive prevention (FORK-01/FORK-02)**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-08T21:23:21Z
- **Completed:** 2026-02-08T21:24:32Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created `check_skill_status` MCP tool that compares local skill files against DB published versions
- Implemented frontmatter stripping before hashing to prevent false drift from tracking hook changes (FORK-02)
- Returns three statuses: "not_installed" (file missing), "current" (hashes match), "diverged" (hashes differ)
- Published-or-author access control prevents leaking unpublished skill content

## Task Commits

Each task was committed atomically:

1. **Task 1: Create check_skill_status MCP tool** - `3f9aebb` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/check-skill-status.ts` - New MCP tool: reads local skill file, strips frontmatter from both local and DB content, SHA-256 hashes both, reports drift status
- `apps/mcp/src/tools/index.ts` - Added check-skill-status import for tool registration

## Decisions Made
- Read-only status check allows unauthenticated users (userId from auth is used only for access control on unpublished skills)
- Frontmatter stripping uses same regex pattern as create.ts (`/^---\n[\s\S]*?\n---\n/`) for consistency
- Self-contained helpers (stripFrontmatter, hashContent) copied into tool file per MCP standalone pattern -- no cross-app imports

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- check_skill_status tool ready for use by update_skill tool (39-03) and fork-skill tool (39-04)
- Tool registered in MCP server and importable via index.ts
- Pre-existing @everyskill/db module resolution errors in tsc --noEmit remain (documented in STATE.md, not blocking)

---
*Phase: 39-fork-detection*
*Completed: 2026-02-08*
