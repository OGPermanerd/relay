# Phase 19: Cross-Platform Install - Research

**Researched:** 2026-02-04
**Domain:** MCP config generation, platform detection, modal UI, install scripts
**Confidence:** HIGH

## Summary

This phase replaces the existing per-skill MCP config copy button with a platform selection modal. The current implementation (`install-button.tsx`, `mcp-config.ts`, `use-clipboard-copy.ts`) generates per-skill npx configs and copies them to clipboard. The new flow opens a modal with 4 platform cards, generates platform-specific JSON configs using `window.location.origin` for the server URL, and provides downloadable install scripts.

The codebase already has a modal pattern (see `fork-button.tsx`) using a `fixed inset-0 z-50` overlay with `bg-black/50` backdrop and a centered white card. This pattern should be reused for the platform selection modal. The existing clipboard hook (`use-clipboard-copy.ts`) already handles both the Clipboard API and a textarea fallback for non-HTTPS contexts.

Key technical domains: (1) MCP config JSON format per platform, (2) OS detection via user agent, (3) install script generation for shell/batch, (4) file download from browser, (5) modal component with multi-step flow.

**Primary recommendation:** Build a self-contained `PlatformInstallModal` component that replaces `InstallButton` usage, reusing the existing modal pattern from `fork-button.tsx` and the clipboard hook from `use-clipboard-copy.ts`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | 19.x | Modal UI, state management | Already in stack |
| Next.js (existing) | 16.x | API routes for script download | Already in stack |
| Tailwind CSS (existing) | 4.x | Modal and card styling | Already in stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `use-clipboard-copy` hook (existing) | N/A | Copy JSON config to clipboard | Every copy action |
| Native Blob/URL API | N/A | Generate downloadable script files | Script download button |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Blob download | file-saver npm package | Adds dependency for trivial functionality; native Blob + anchor download works fine for small text files |
| `navigator.userAgent` parsing | `navigator.userAgentData` API | `userAgentData` only works in Chromium; UA string parsing works everywhere despite deprecation concerns |
| Custom modal | Headless UI / Radix Dialog | Adds dependency; existing pattern from fork-button.tsx is simple and sufficient |

**Installation:**
```bash
# No new dependencies needed - all requirements met by existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  components/
    platform-install-modal.tsx   # Main modal component (replaces InstallButton trigger)
    install-button.tsx           # Modified to open modal instead of direct copy
  lib/
    mcp-config.ts               # Extended with per-platform config generation
    os-detection.ts              # NEW: OS detection utility
    install-script.ts            # NEW: Install script generation
  app/
    api/
      install-script/
        route.ts                 # Optional: API route to serve scripts (alternative to client-side Blob)
  hooks/
    use-clipboard-copy.ts        # Existing, reused as-is
```

### Pattern 1: Modal with Platform Card Selection
**What:** A modal that presents 4 platform cards in a grid. Clicking a card reveals platform-specific JSON config and actions below.
**When to use:** When the install button is clicked (replaces current direct-copy behavior).
**Example:**
```typescript
// Source: Existing pattern from fork-button.tsx
"use client";
import { useState } from "react";

type Platform = "claude-chat" | "claude-code" | "other-ide" | "other-systems";

interface PlatformInstallModalProps {
  onClose: () => void;
}

export function PlatformInstallModal({ onClose }: PlatformInstallModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [detectedOS, setDetectedOS] = useState<"macos" | "windows" | "linux">("macos");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Detected OS label */}
        {/* Platform cards grid */}
        {/* Selected platform config + copy/download */}
      </div>
    </div>
  );
}
```

### Pattern 2: Dynamic MCP Config Generation
**What:** Generate platform-specific MCP JSON using `window.location.origin` at copy time.
**When to use:** When user selects a platform and copies config.
**Example:**
```typescript
// Source: Codebase analysis of existing mcp-config.ts + MCP official docs
type Platform = "claude-chat" | "claude-code" | "other-ide" | "other-systems";
type OS = "macos" | "windows" | "linux";

export function generatePlatformConfig(platform: Platform, origin: string): string {
  // The Relay MCP server is a local stdio process that needs DB access
  // Config points to the local everyskill-mcp binary
  const baseConfig = {
    mcpServers: {
      "everyskill-skills": {
        command: "npx",
        args: ["-y", "@everyskill/mcp"],
        env: {
          RELAY_URL: origin, // Dynamic based on window.location.origin
        },
      },
    },
  };

  return JSON.stringify(baseConfig, null, 2);
}

export function getConfigFilePath(platform: Platform, os: OS): string {
  switch (platform) {
    case "claude-chat":
      // Claude.ai uses remote connectors, no local config file
      return "Settings > Connectors > Add custom connector";
    case "claude-code":
      return "~/.claude.json (user scope)";
    case "other-ide":
      // Generic MCP config
      return os === "windows"
        ? "%APPDATA%\\mcp\\config.json"
        : "~/.config/mcp/config.json";
    case "other-systems":
      return "Platform-specific MCP config file";
  }
}
```

### Pattern 3: OS Detection
**What:** Detect user's OS from user agent string for pre-selection and script type.
**When to use:** On modal open.
**Example:**
```typescript
// Source: MDN docs + community patterns
export type DetectedOS = "macos" | "windows" | "linux";

export function detectOS(): DetectedOS {
  if (typeof navigator === "undefined") return "macos"; // SSR default

  const ua = navigator.userAgent.toLowerCase();
  // Check userAgentData first (Chromium only, but more reliable when available)
  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform) {
    const platform = uaData.platform.toLowerCase();
    if (platform === "macos") return "macos";
    if (platform === "windows") return "windows";
    if (platform === "linux") return "linux";
  }

  // Fallback to user agent string
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";

  return "macos"; // Default per context decision
}
```

### Pattern 4: Client-Side File Download
**What:** Generate install scripts as Blob and trigger download via anchor element.
**When to use:** When user clicks "Download Script" for a platform.
**Example:**
```typescript
// Source: Native Web API, verified approach
export function downloadScript(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Anti-Patterns to Avoid
- **Separate modals per platform:** Use a single modal with conditional content, not 4 separate modals.
- **Server-side OS detection:** Do not use server-side user-agent detection (unreliable with SSR/CDN caching). Use client-side detection only.
- **Hardcoded URLs in config:** Never hardcode a URL like `https://relay.example.com`. Always use `window.location.origin` at copy time.
- **Overwriting existing MCP config:** Install scripts must READ existing config, MERGE the relay entry, and WRITE back. Never truncate or overwrite the entire file.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy with feedback | Custom clipboard code | Existing `use-clipboard-copy.ts` hook | Already handles Clipboard API fallback, timeout reset |
| Modal overlay | New modal component from scratch | Fork `fork-button.tsx` modal pattern | Proven pattern with backdrop click-to-close, stopPropagation |
| JSON formatting | Manual string concatenation | `JSON.stringify(obj, null, 2)` | Handles escaping, indentation automatically |
| File download | Server-side download endpoint | Native Blob + anchor download | No server round-trip needed for small text files |

**Key insight:** This phase is almost entirely frontend work using patterns already established in the codebase. No new backend APIs are required for the core flow.

## Common Pitfalls

### Pitfall 1: Config JSON Escaping on Windows Paths
**What goes wrong:** Windows file paths use backslashes which need double-escaping in JSON.
**Why it happens:** Generating paths like `C:\Users\username\AppData` in JSON without proper escaping.
**How to avoid:** Use `JSON.stringify()` which handles escaping automatically. For display-only paths, use raw strings but for JSON config output always go through `JSON.stringify`.
**Warning signs:** Broken JSON when pasting on Windows.

### Pitfall 2: Modal Doesn't Persist After Copy
**What goes wrong:** Modal closes after copy action, requiring user to reopen for another platform.
**Why it happens:** Copy handler accidentally triggers modal close via event bubbling.
**How to avoid:** Ensure copy/download button click handlers call `e.stopPropagation()`. The context explicitly states: "Modal stays open after copy/download."
**Warning signs:** Modal closing on copy button click.

### Pitfall 3: Install Script Destroys Existing MCP Config
**What goes wrong:** Script overwrites the entire config file, removing other MCP servers.
**Why it happens:** Script uses simple file write instead of read-merge-write.
**How to avoid:** Scripts must: (1) Read existing config or create empty `{}`, (2) Parse JSON, (3) Add/update only the `everyskill-skills` key under `mcpServers`, (4) Write back complete config.
**Warning signs:** Users losing other MCP server configs after running the script.

### Pitfall 4: SSR Hydration Mismatch with OS Detection
**What goes wrong:** Server renders "macos" default but client detects "windows", causing hydration mismatch.
**Why it happens:** `navigator.userAgent` is not available during SSR.
**How to avoid:** Use `useEffect` to run OS detection only on client side. Initial render should show all cards without pre-selection, then highlight detected OS after mount.
**Warning signs:** React hydration warnings in console.

### Pitfall 5: Claude Chat vs Claude Desktop Confusion
**What goes wrong:** Generating local stdio config for Claude.ai web chat, which uses remote connectors.
**Why it happens:** Confusing "Claude Chat" (claude.ai web) with "Claude Desktop" (desktop app).
**How to avoid:** Claude Chat (web) uses remote MCP connectors via Settings > Connectors. It does NOT use `claude_desktop_config.json`. The config approach differs fundamentally:
- Claude Chat: Show the remote server URL for manual connector addition
- Claude Desktop: Show `claude_desktop_config.json` config with local stdio command
- Claude Code: Show CLI command or `.mcp.json` config
**Warning signs:** User trying to paste a JSON config file for Claude.ai web.

### Pitfall 6: `stopPropagation` Missing on Install Button in Table Rows
**What goes wrong:** Clicking install in a table row navigates to the skill detail page.
**Why it happens:** The existing row click navigates to `/skills/[slug]`, and the install button click bubbles up.
**How to avoid:** The existing code already handles this with `e.stopPropagation()` on the icon variant. The new modal trigger must also call `stopPropagation` in table row context.
**Warning signs:** Navigation happening when clicking install in table view.

## Code Examples

Verified patterns from the existing codebase and official sources:

### MCP Config for Claude Desktop (macOS)
```json
// Source: https://modelcontextprotocol.io/docs/develop/connect-local-servers
// File: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "everyskill-skills": {
      "command": "npx",
      "args": ["-y", "@everyskill/mcp"]
    }
  }
}
```

### MCP Config for Claude Desktop (Windows)
```json
// Source: https://modelcontextprotocol.io/docs/develop/connect-local-servers
// File: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "everyskill-skills": {
      "command": "npx",
      "args": ["-y", "@everyskill/mcp"]
    }
  }
}
```

### MCP Config for Claude Code
```json
// Source: https://code.claude.com/docs/en/mcp
// Added via: claude mcp add everyskill-skills --scope user
// Or in ~/.claude.json under mcpServers key
{
  "mcpServers": {
    "everyskill-skills": {
      "command": "npx",
      "args": ["-y", "@everyskill/mcp"]
    }
  }
}
```

### Generic MCP Config (Other IDE / Other Systems)
```json
// Source: MCP specification standard format
// Works with any MCP-compatible client
{
  "mcpServers": {
    "everyskill-skills": {
      "command": "npx",
      "args": ["-y", "@everyskill/mcp"]
    }
  }
}
```

### Install Script (macOS/Linux - Shell)
```bash
#!/bin/bash
# Relay MCP Server Install Script
# Merges everyskill-skills into existing MCP config

set -e

CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# Linux path override
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CONFIG_DIR="$HOME/.config/Claude"
  CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
fi

# Create directory if needed
mkdir -p "$CONFIG_DIR"

# Read existing config or start fresh
if [ -f "$CONFIG_FILE" ]; then
  EXISTING=$(cat "$CONFIG_FILE")
else
  EXISTING='{}'
fi

# Use node to safely merge JSON (avoids jq dependency)
node -e "
  const existing = JSON.parse(process.argv[1]);
  if (!existing.mcpServers) existing.mcpServers = {};
  existing.mcpServers['everyskill-skills'] = {
    command: 'npx',
    args: ['-y', '@everyskill/mcp']
  };
  console.log(JSON.stringify(existing, null, 2));
" "$EXISTING" > "$CONFIG_FILE"

echo 'Relay MCP server installed successfully!'
echo "Config written to: $CONFIG_FILE"
echo 'Restart Claude Desktop to activate.'
```

### Install Script (Windows - PowerShell)
```powershell
# Relay MCP Server Install Script
# Merges everyskill-skills into existing MCP config

$ErrorActionPreference = "Stop"

$ConfigDir = "$env:APPDATA\Claude"
$ConfigFile = "$ConfigDir\claude_desktop_config.json"

# Create directory if needed
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# Read existing config or start fresh
if (Test-Path $ConfigFile) {
    $Existing = Get-Content $ConfigFile -Raw
} else {
    $Existing = '{}'
}

# Use node to safely merge JSON
$MergeScript = @"
const existing = JSON.parse(process.argv[1]);
if (!existing.mcpServers) existing.mcpServers = {};
existing.mcpServers['everyskill-skills'] = {
  command: 'npx',
  args: ['-y', '@everyskill/mcp']
};
console.log(JSON.stringify(existing, null, 2));
"@

$Result = node -e $MergeScript $Existing
$Result | Set-Content $ConfigFile -Encoding UTF8

Write-Host "Relay MCP server installed successfully!"
Write-Host "Config written to: $ConfigFile"
Write-Host "Restart Claude Desktop to activate."
```

### Existing Modal Pattern (from fork-button.tsx)
```typescript
// Source: apps/web/components/fork-button.tsx (lines 42-106)
{showModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onClick={() => setShowModal(false)}
  >
    <div
      className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal content */}
    </div>
  </div>
)}
```

### Existing Clipboard Copy Pattern
```typescript
// Source: apps/web/hooks/use-clipboard-copy.ts
const { copyToClipboard, isCopied } = useClipboardCopy();
// Usage: copyToClipboard(uniqueId, textToCopy)
// Check: isCopied(uniqueId) returns boolean, auto-resets after 2s
```

## Platform-Specific Config Details

### Claude Chat (claude.ai web)
- **Method:** Remote MCP connector via Settings > Connectors
- **What to show:** The Relay server URL (from `window.location.origin`) and instructions to add as custom connector
- **Config file:** None (configured in web UI)
- **Available on:** Pro, Max, Team, Enterprise plans
- **Note:** Users add the URL manually in claude.ai settings, not via JSON config file
- **Confidence:** HIGH (verified via official Claude help center docs)

### Claude Code (CLI)
- **Method:** CLI command `claude mcp add` or `.mcp.json` / `~/.claude.json`
- **What to show:** JSON config block + CLI one-liner
- **Config file:** `~/.claude.json` (user scope) or `.mcp.json` (project scope)
- **Note:** The existing install button already handles Claude Code. New modal enhances with proper instructions.
- **Confidence:** HIGH (verified via official Claude Code docs)

### Claude Desktop
- **Method:** Edit `claude_desktop_config.json` or use install script
- **Config paths:**
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: Not officially supported; community path `~/.config/Claude/claude_desktop_config.json`
- **Transport:** stdio only (no native remote server support without `mcp-remote` bridge)
- **Note:** The context lists "Claude Chat" not "Claude Desktop" as a platform, but INST-02 requires "Claude Desktop with OS-specific paths". The 4 platforms are: Claude Chat, Claude Code, Other IDE, Other Systems. Claude Desktop functionality may fall under "Other Systems" or the context may intend "Claude Chat" to mean "Claude Desktop". This needs clarification during implementation.
- **Confidence:** HIGH for config paths (verified via official MCP docs)

### Other IDE / Other Systems
- **Method:** Generic MCP config JSON block
- **What to show:** Standard `mcpServers` JSON block that works with any MCP-compatible client
- **Note:** Many IDEs (Cursor, Windsurf, VS Code with Copilot) use the same `mcpServers` config format
- **Confidence:** HIGH (standard MCP protocol format)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-skill npx config (`@anthropic-ai/relay-${slug}`) | Single relay server config (`@everyskill/mcp`) | This phase | One install covers all skills |
| Direct clipboard copy on button click | Modal with platform selection first | This phase | Better UX for multi-platform users |
| SSE transport for remote MCP | Streamable HTTP transport | 2025-2026 | SSE being deprecated, use HTTP for remote |
| `navigator.platform` for OS detection | `navigator.userAgentData` + UA string fallback | 2024-2025 | `navigator.platform` deprecated |

**Deprecated/outdated:**
- SSE transport for MCP: Being deprecated in favor of Streamable HTTP. Use HTTP transport type when configuring remote servers.
- `navigator.platform`: Deprecated. Use `navigator.userAgentData?.platform` with UA string fallback.

## Open Questions

Things that couldn't be fully resolved:

1. **"Claude Chat" platform definition ambiguity**
   - What we know: The context lists 4 platforms: Claude Chat, Claude Code, Other IDE, Other Systems. INST-02 requires "Claude Desktop with OS-specific paths."
   - What's unclear: Does "Claude Chat" mean Claude.ai web (remote connector) or Claude Desktop (local config file)? The requirement INST-02 explicitly mentions "Claude Desktop" but the platform list says "Claude Chat."
   - Recommendation: Treat "Claude Chat" as Claude Desktop (the desktop app), since INST-02 requires OS-specific paths which only apply to the desktop app. The claude.ai web connector flow could be covered under "Other Systems" or as a sub-option.

2. **Remote vs Local MCP server for `window.location.origin`**
   - What we know: Context says to use `window.location.origin` for the MCP server URL. The current MCP server (`@everyskill/mcp`) uses stdio transport and connects directly to the database.
   - What's unclear: Whether the MCP server needs a remote transport (HTTP/SSE) endpoint, or if `window.location.origin` is used as an environment variable for the local server to know where the Relay API lives.
   - Recommendation: Use `window.location.origin` as the `RELAY_URL` environment variable in the config's `env` block. The local stdio server can use this to connect to the Relay web API. This avoids needing to build a remote MCP transport server.

3. **Script file type for Windows: .bat vs .ps1**
   - What we know: Context says "macOS/Linux get .sh, Windows gets .bat/.ps1"
   - What's unclear: Whether to provide .bat (broader compatibility, simpler) or .ps1 (more powerful, better JSON handling) or both.
   - Recommendation: Provide .ps1 (PowerShell) as the primary Windows script. PowerShell is pre-installed on all modern Windows (10+) and handles JSON natively. Include a note about execution policy (`Set-ExecutionPolicy -Scope Process Bypass`).

## Sources

### Primary (HIGH confidence)
- Official MCP docs: https://modelcontextprotocol.io/docs/develop/connect-local-servers - Config format, file paths
- Claude Code docs: https://code.claude.com/docs/en/mcp - Claude Code MCP config format, CLI commands
- Claude Help Center: https://support.claude.com/en/articles/11175166 - Remote connector setup for Claude.ai
- Claude Help Center: https://support.claude.com/en/articles/10949351 - Local MCP servers on Claude Desktop
- Codebase: `apps/web/components/fork-button.tsx` - Modal pattern
- Codebase: `apps/web/hooks/use-clipboard-copy.ts` - Clipboard pattern
- Codebase: `apps/web/lib/mcp-config.ts` - Current config generation
- Codebase: `apps/mcp/` - MCP server implementation (stdio, McpServer SDK)

### Secondary (MEDIUM confidence)
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent - UA detection guidance
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent - UA sniffing best practices
- Claude Help Center: https://support.claude.com/en/articles/11503834 - Building custom connectors via remote MCP

### Tertiary (LOW confidence)
- Community blog posts on OS detection patterns (multiple sources agree on UA string approach)
- npm-compare for file download libraries (confirms native Blob approach is sufficient)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed, all patterns exist in codebase
- Architecture: HIGH - Verified config formats against official MCP docs and existing codebase patterns
- Pitfalls: HIGH - Based on direct codebase analysis and official documentation of config file formats
- Platform configs: HIGH for Claude Desktop/Code paths (official docs), MEDIUM for Claude Chat remote connector flow

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (MCP ecosystem is evolving but config formats are stable)
