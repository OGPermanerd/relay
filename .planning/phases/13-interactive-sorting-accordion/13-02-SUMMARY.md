---
phase: "13"
plan: "02"
subsystem: "ui-components"
tags: [accordion, clipboard, hooks, mcp-config]
depends_on:
  requires: ["13-01"]
  provides: ["useExpandedRows hook", "useClipboardCopy hook", "generateMcpConfig", "InstallButton", "SkillAccordionContent"]
  affects: ["13-03"]
tech_tracking:
  added: []
  patterns: ["Set-based expansion tracking", "Clipboard API with timed feedback"]
key_files:
  created:
    - apps/web/hooks/use-expanded-rows.ts
    - apps/web/hooks/use-clipboard-copy.ts
    - apps/web/lib/mcp-config.ts
    - apps/web/components/install-button.tsx
    - apps/web/components/skill-accordion-content.tsx
  modified: []
metrics:
  duration: "~3 min"
  completed: "2026-02-01"
---

# Phase 13 Plan 02: Accordion and Install Infrastructure Summary

**One-liner:** Row expansion hooks, clipboard copy with 2-second feedback, and accordion content component with install button

## What Was Built

### useExpandedRows Hook (`apps/web/hooks/use-expanded-rows.ts`)

Hook for tracking multiple expanded rows:

- **State:** `Set<string>` of expanded skill IDs
- **Toggle behavior:** Click row to expand/collapse
- **Multi-expand:** Multiple rows can be expanded simultaneously

```typescript
const { toggleRow, isExpanded } = useExpandedRows();
```

### useClipboardCopy Hook (`apps/web/hooks/use-clipboard-copy.ts`)

Hook for clipboard operations with visual feedback:

- **Copy function:** Async clipboard write with error handling
- **Feedback:** 2-second "copied" state per ID
- **Tracking:** `isCopied(id)` checks if specific item was just copied

```typescript
const { copyToClipboard, isCopied } = useClipboardCopy();
await copyToClipboard(skillId, configJson);
```

### generateMcpConfig (`apps/web/lib/mcp-config.ts`)

Utility for generating MCP configuration JSON:

- **Format:** Matches claude_desktop_config.json structure
- **Output:** Pretty-printed JSON (2-space indent)
- **Package:** Uses `@anthropic-ai/relay-{slug}` placeholder format

```typescript
const json = generateMcpConfig({ name: "Skill", slug: "skill-slug" });
// Returns formatted JSON for mcpServers configuration
```

### InstallButton Component (`apps/web/components/install-button.tsx`)

Install button with two display variants:

- **Full variant:** Rounded button with "Install" / "Copied!" text
  - Default: blue-600 bg, white text
  - Copied: green-100 bg, green-800 text
- **Icon variant:** Compact download arrow for table rows
  - Uses `stopPropagation()` to prevent row expansion
  - Default: gray-400, hover blue-600
  - Copied: checkmark icon in green-600

```typescript
<InstallButton
  skillName={skill.name}
  isCopied={isCopied(skill.id)}
  onCopy={() => handleInstall(skill)}
  variant="icon"
/>
```

### SkillAccordionContent Component (`apps/web/components/skill-accordion-content.tsx`)

Accordion row content using preview card style:

- **Structure:** `<tr>` with `<td colSpan={6}>` for full width
- **Background:** blue-50 for expanded state indicator
- **Card:** Rounded white card with blue-100 border
- **Content:** Category badge, description, tags, install button

```typescript
<SkillAccordionContent
  skill={skill}
  onInstall={() => handleInstall(skill)}
  isCopied={isCopied(skill.id)}
/>
```

## Commits

| Hash    | Type | Description                             |
| ------- | ---- | --------------------------------------- |
| 131a0f6 | feat | create expansion and clipboard hooks    |
| b299429 | feat | create InstallButton component          |
| d31ab0d | feat | create SkillAccordionContent component  |

## Verification

- [x] TypeScript compiles without errors
- [x] All 5 files exist with expected exports
- [x] useExpandedRows tracks Set<string> of IDs
- [x] useClipboardCopy provides 2-second feedback (setTimeout 2000ms)
- [x] generateMcpConfig generates valid JSON with mcpServers structure
- [x] InstallButton has both full and icon variants
- [x] SkillAccordionContent uses blue-50 background

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused props from InstallButton**

- **Found during:** Task 2
- **Issue:** Plan specified `skillId` and `skillSlug` props but they weren't used in component (caller handles config generation)
- **Fix:** Simplified interface to only include used props: `skillName`, `isCopied`, `onCopy`, `variant`
- **Files modified:** apps/web/components/install-button.tsx

## Integration Notes for Plan 03

The hooks and components are ready for SkillsTable integration:

1. Import hooks: `useExpandedRows`, `useClipboardCopy`
2. Import utility: `generateMcpConfig`
3. Import components: `InstallButton`, `SkillAccordionContent`
4. Wire up row click to `toggleRow`
5. Wire up install to `copyToClipboard` with generated config
6. Render `SkillAccordionContent` conditionally based on `isExpanded`

## Next Phase Readiness

Ready for Plan 03 (SkillsTable Integration) - no blockers.
