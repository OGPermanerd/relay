# Phase 19: Cross-Platform Install - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can install the Relay MCP server on any supported Claude platform. The existing Claude Code copy button is replaced with a platform selection modal that shows JSON config and provides a downloadable install script. Platforms: Claude Chat, Claude Code, Other IDE, Other Systems.

</domain>

<decisions>
## Implementation Decisions

### Platform selection flow
- Replace the existing MCP install/copy button with a new button that opens the platform selection modal
- Modal presents platforms as icon cards in a grid layout (logo, name, brief description per card)
- 4 platforms: Claude Chat, Claude Code, Other IDE, Other Systems
- Clicking a platform card reveals the platform-specific JSON config below with a copy button — user reviews then copies
- Modal stays open after copy/download so user can copy for another platform or re-read instructions

### Config generation
- Use `window.location.origin` to dynamically set the MCP server URL at copy time — production users automatically get the production URL, no manual changes needed
- Provide a downloadable shell/batch script per platform that installs the Relay MCP server config
- Script merges into existing MCP config file — reads current config, adds/updates Relay server entry, preserves other servers
- Script is per-platform generic (installs the Relay MCP server connection, not per-skill) — one-time setup
- For Other IDE and Other Systems, show generic JSON MCP config block

### OS auto-detection
- Auto-detect user's OS via user agent
- Pre-select the matching platform card (all 4 cards always visible, detected one highlighted)
- Default to macOS when OS can't be detected
- Show detected OS label near top of modal (e.g., "Detected: macOS") so user understands pre-selection
- Install script type auto-matches detected OS: macOS/Linux get .sh, Windows gets .bat/.ps1

### Copy feedback
- After JSON copy: inline confirmation — button changes to "Copied!" with checkmark for a few seconds
- After script download: modal shows 1-2 step run instructions (e.g., `chmod +x install.sh && ./install.sh`) with a copy button for the command
- Verification hint after install: tip like "To verify, open Claude Desktop and check for Relay in your MCP servers"

### Claude's Discretion
- Exact icon/logo choices for platform cards
- Script implementation details (error handling, temp files)
- Modal sizing and responsive behavior
- Exact verification hint wording per platform

</decisions>

<specifics>
## Specific Ideas

- Usage tracking is already handled by the MCP server (Phase 3) — no additional work needed in this phase
- Install script should be safe: merge into existing config, never overwrite other MCP servers
- The modal replaces the current copy button, so existing Claude Code users see the same flow but through the modal now

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-cross-platform-install*
*Context gathered: 2026-02-04*
