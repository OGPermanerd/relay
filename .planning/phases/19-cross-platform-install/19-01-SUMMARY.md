---
phase: 19-cross-platform-install
plan: 01
subsystem: ui
tags: [mcp, os-detection, install-script, modal, clipboard, platform-config]

# Dependency graph
requires:
  - phase: 18-fork-based-versioning
    provides: modal pattern (fork-button.tsx), clipboard hook (use-clipboard-copy.ts)
provides:
  - PlatformInstallModal component with 4 platform cards
  - OS detection utility (detectOS, DetectedOS)
  - Platform-specific MCP config generation (generatePlatformConfig, getConfigFilePath, getConfigInstructions)
  - Install script generation and download (generateInstallScript, downloadScript, getRunInstructions)
affects: [19-02 integration plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side OS detection via useEffect with SSR-safe defaults"
    - "Blob-based file download for install scripts"
    - "Multi-platform modal with card selection pattern"

key-files:
  created:
    - apps/web/lib/os-detection.ts
    - apps/web/lib/install-script.ts
    - apps/web/components/platform-install-modal.tsx
  modified:
    - apps/web/lib/mcp-config.ts

key-decisions:
  - "All 4 platforms use identical MCP config (npx -y @relay/mcp stdio)"
  - "Claude Desktop pre-selected as default for all detected OS"
  - "Install script download only shown for claude-desktop platform"
  - "PowerShell (.ps1) for Windows, bash (.sh) for macOS/Linux"
  - "Run instructions shown inline after script download with own copy button"

patterns-established:
  - "OS detection only in useEffect with mounted flag to avoid hydration mismatch"
  - "Platform card grid with conditional detail section below"

# Metrics
duration: 3min
completed: 2026-02-04
---

# Phase 19 Plan 01: Platform Install Modal Summary

**PlatformInstallModal with OS detection, 4 platform cards, config copy, and install script download for Claude Desktop/Code/IDE/other MCP clients**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T21:01:49Z
- **Completed:** 2026-02-04T21:05:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- OS detection utility that checks userAgentData then UA string with SSR-safe default
- Platform-specific MCP config generation with file paths, instructions, and JSON output per platform+OS combo
- Install scripts (bash + PowerShell) that safely merge relay-skills into existing config via node JSON merge
- PlatformInstallModal component (373 lines) with card grid, config display, copy feedback, and download flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create utility modules** - `c77988f` (feat)
2. **Task 2: Build PlatformInstallModal component** - `e53ef2a` (feat)

## Files Created/Modified
- `apps/web/lib/os-detection.ts` - DetectedOS type and detectOS() with userAgentData + UA fallback
- `apps/web/lib/install-script.ts` - generateInstallScript (bash/PS1), downloadScript (Blob), getRunInstructions
- `apps/web/lib/mcp-config.ts` - Extended with Platform type, generatePlatformConfig, getConfigFilePath, getConfigInstructions
- `apps/web/components/platform-install-modal.tsx` - Full modal with 4 platform cards, config section, copy/download buttons

## Decisions Made
- All 4 platforms share identical MCP config JSON structure -- the config format is the same, only the file path and instructions differ
- Claude Desktop is pre-selected as default platform for all detected operating systems
- Download Install Script button only appears for claude-desktop platform (other platforms just show copy config)
- Used `_platform` and `_origin` unused params in generatePlatformConfig to preserve the API contract for future per-platform differentiation
- Install scripts use `node -e` for JSON merge to avoid jq dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PlatformInstallModal component is ready for integration into the skill detail page
- Plan 19-02 can wire the modal into InstallButton and replace the direct-copy flow
- All utility functions tested via TypeScript compilation; Playwright E2E tests pass (29/29)

---
*Phase: 19-cross-platform-install*
*Completed: 2026-02-04*
