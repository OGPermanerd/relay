# Phase 13: Interactive Sorting & Accordion - Research

**Researched:** 2026-02-01
**Domain:** Client-side table interactivity with URL state management
**Confidence:** HIGH

## Summary

This phase adds interactive features to the existing SkillsTable: sortable columns, expandable row accordions with skill details, one-click install via clipboard, and author filtering from the leaderboard. The implementation leverages existing patterns already established in the codebase.

The codebase already uses nuqs 2.8.7 for URL state management (CategoryFilter, TagFilter, SearchInput, SortDropdown, QualityFilter). The established pattern uses `useQueryState` with typed parsers (`parseAsString`, `parseAsStringEnum`, `parseAsArrayOf`) and `useTransition` for non-blocking updates. The NuqsAdapter is already wrapped in the Providers component.

For sorting, the pattern is straightforward: client-side array sorting on already-fetched data, with sort state persisted in URL. The existing `searchSkills` function handles server-side sorting when initial data is fetched, but Phase 13 adds client-side re-sorting for instant feedback without server round-trips.

**Primary recommendation:** Follow established nuqs patterns for URL state; use simple client-side array sorting (no TanStack Table); use native Clipboard API for install functionality.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nuqs | 2.8.7 | URL state management | Already in use for all filters; type-safe, Next.js App Router compatible |
| React | 19.0.0 | UI framework | Already in use |
| Next.js | 15.1.0 | Framework | Already in use; App Router with Server/Client Components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native Clipboard API | - | Copy to clipboard | `navigator.clipboard.writeText()` for install button |
| useState/useCallback | React built-in | Client state | Expanded row tracking, copy feedback state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side sort | TanStack Table | Prior decision: TanStack is overkill for single-column sort |
| Native Clipboard | react-copy-to-clipboard | Adds dependency for simple one-liner API |
| useState for expanded | URL state | Prior decision: expanded state is ephemeral, not shareable |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/components/
├── skills-table.tsx           # Convert to Client Component with sorting/accordion
├── skills-table-row.tsx       # New: individual row with expand/collapse logic
├── skill-accordion-content.tsx # New: expanded row content (preview card style)
├── sortable-column-header.tsx # New: clickable header with chevron indicator
├── install-button.tsx         # New: clipboard copy with feedback
├── leaderboard-table.tsx      # Add author click → filter integration
└── author-filter-chip.tsx     # New: removable chip in filter bar (optional)
```

### Pattern 1: nuqs URL State for Sort
**What:** Use `parseAsStringEnum` for sort column, `parseAsStringLiteral` for sort direction
**When to use:** All sortable columns except Sparkline
**Example:**
```typescript
// Source: Existing CategoryFilter pattern in codebase
"use client";

import { useQueryState, parseAsStringEnum, parseAsStringLiteral } from "nuqs";
import { useTransition } from "react";

const SORT_COLUMNS = ["name", "days_saved", "installs", "date", "author"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

const SORT_DIRECTIONS = ["asc", "desc"] as const;
type SortDirection = (typeof SORT_DIRECTIONS)[number];

export function useSortState() {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringEnum(SORT_COLUMNS as unknown as string[])
      .withDefault("days_saved" as SortColumn)
  );
  const [sortDir, setSortDir] = useQueryState(
    "sortDir",
    parseAsStringLiteral(SORT_DIRECTIONS)
      .withDefault("desc" as SortDirection)
  );
  const [isPending, startTransition] = useTransition();

  const toggleSort = (column: SortColumn) => {
    startTransition(() => {
      if (sortBy === column) {
        // Toggle direction: desc -> asc -> desc
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        // New column: start with desc (most useful first)
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return { sortBy, sortDir, isPending, toggleSort };
}
```

### Pattern 2: Client-Side Sorting
**What:** Sort the already-fetched skills array in-memory based on URL state
**When to use:** After initial render with server-fetched data
**Example:**
```typescript
// Source: Standard JavaScript array sort pattern
function sortSkills(
  skills: SkillTableRow[],
  sortBy: SortColumn,
  sortDir: SortDirection
): SkillTableRow[] {
  return [...skills].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "days_saved":
        const aDays = (a.totalUses * (a.hoursSaved ?? 1)) / 8;
        const bDays = (b.totalUses * (b.hoursSaved ?? 1)) / 8;
        comparison = aDays - bDays;
        break;
      case "installs":
        comparison = a.totalUses - b.totalUses;
        break;
      case "date":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "author":
        comparison = (a.author?.name ?? "").localeCompare(b.author?.name ?? "");
        break;
    }

    return sortDir === "desc" ? -comparison : comparison;
  });
}
```

### Pattern 3: Accordion Row State
**What:** Track expanded rows in local state (Set of skill IDs)
**When to use:** Multiple rows can be expanded simultaneously (per CONTEXT.md)
**Example:**
```typescript
// Source: Standard React pattern
"use client";

import { useState, useCallback } from "react";

export function useExpandedRows() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((skillId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (skillId: string) => expandedIds.has(skillId),
    [expandedIds]
  );

  return { toggleRow, isExpanded };
}
```

### Pattern 4: Clipboard Copy with Feedback
**What:** Copy MCP config JSON to clipboard, show "Copied!" feedback for 2 seconds
**When to use:** Install button in accordion and row-level quick install icon
**Example:**
```typescript
// Source: MDN Clipboard API / verified best practice
"use client";

import { useState, useCallback } from "react";

export function useClipboardCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (skillId: string, mcpConfig: string) => {
    try {
      await navigator.clipboard.writeText(mcpConfig);
      setCopiedId(skillId);
      setTimeout(() => setCopiedId(null), 2000);
      return true;
    } catch (err) {
      console.error("Failed to copy:", err);
      return false;
    }
  }, []);

  return { copiedId, copyToClipboard };
}
```

### Pattern 5: Author Filter via URL
**What:** Add `author` param to URL state for filtering skills by contributor
**When to use:** Clicking contributor in leaderboard, shown as removable chip
**Example:**
```typescript
// Source: Existing TagFilter pattern extended
"use client";

import { useQueryState, parseAsString } from "nuqs";
import { useTransition } from "react";

export function useAuthorFilter() {
  const [author, setAuthor] = useQueryState(
    "author",
    parseAsString.withDefault(null as unknown as string)
  );
  const [isPending, startTransition] = useTransition();

  const filterByAuthor = (authorId: string) => {
    startTransition(() => {
      setAuthor(author === authorId ? null : authorId);
    });
  };

  const clearAuthor = () => {
    startTransition(() => {
      setAuthor(null);
    });
  };

  return { author, filterByAuthor, clearAuthor, isPending };
}
```

### Anti-Patterns to Avoid
- **Server round-trip for sort:** Don't re-fetch data on sort change; data is already loaded, sort client-side
- **Accordion state in URL:** Ephemeral UI state; would clutter URL and isn't shareable
- **Custom sort comparison functions per column:** Use a single sort function with switch statement for maintainability
- **TanStack Table:** Prior decision - overkill for this use case; adds bundle size for minimal benefit

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL state sync | Custom history.pushState | nuqs | Already in codebase, handles shallow routing, transitions, serialization |
| Clipboard copy | document.execCommand | navigator.clipboard | Modern API, promise-based, better security |
| Sort icons | Custom SVGs | Heroicons-style inline SVGs | Match existing pattern (search-input.tsx, trending-section.tsx) |
| Feedback timing | setInterval | setTimeout | One-shot 2-second reset, not repeating |

**Key insight:** The codebase already has established patterns for URL state (nuqs) and inline SVG icons (Heroicons stroke style). Follow these exactly rather than introducing new patterns.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Client-Side Sort
**What goes wrong:** Server renders unsorted list, client immediately sorts, causing flash/mismatch
**Why it happens:** Server Component data order differs from client sort preference
**How to avoid:**
- Default sort (days_saved desc) should match server-side default in `searchSkills`
- Use `suppressHydrationWarning` only if unavoidable
- Consider rendering sorted order server-side when URL params present
**Warning signs:** Console hydration warnings, content flash on page load

### Pitfall 2: Stale Sort State After Filter Change
**What goes wrong:** User sorts, then changes category filter; sort params remain but data differs
**Why it happens:** nuqs params persist across navigation
**How to avoid:** Keep sort params (they're intentional), ensure sort function handles empty arrays gracefully
**Warning signs:** No skills shown but sort indicator still active

### Pitfall 3: Clipboard API Fails Silently
**What goes wrong:** Copy appears to work but clipboard is empty
**Why it happens:** Browser security restrictions, HTTPS requirement, user gesture requirement
**How to avoid:**
- Always wrap in try/catch
- Show error feedback if copy fails
- Ensure copy is triggered by direct user click (not programmatic)
**Warning signs:** "Copied!" shown but paste produces nothing

### Pitfall 4: Expanded Row State Lost on Sort
**What goes wrong:** User expands row, sorts table, expanded row content disappears or attaches to wrong row
**Why it happens:** Tracking expansion by array index instead of skill ID
**How to avoid:** Use `Set<string>` of skill IDs, not indices
**Warning signs:** Wrong skill content in expanded accordion after sort

### Pitfall 5: Author Filter Not Stacking with Other Filters
**What goes wrong:** Clicking author clears search/category/tag filters
**Why it happens:** Navigation to new URL instead of adding param
**How to avoid:** Use nuqs `setAuthor` which preserves other params
**Warning signs:** URL loses ?q= or ?category= when clicking author

### Pitfall 6: MCP Config JSON Format Incorrect
**What goes wrong:** Copied config doesn't work in claude_desktop_config.json
**Why it happens:** Missing required fields, wrong structure, unescaped characters
**How to avoid:** Match exact format from `claude_desktop_config.example.json`:
```json
{
  "mcpServers": {
    "skill-name": {
      "command": "npx",
      "args": ["-y", "@everyskill/skill-name"]
    }
  }
}
```
**Warning signs:** JSON parse errors when pasting config

## Code Examples

Verified patterns from official sources:

### Sortable Column Header
```typescript
// Source: Codebase pattern + Heroicons chevron
interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  currentSort: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right" | "center";
}

export function SortableColumnHeader({
  column,
  label,
  currentSort,
  direction,
  onSort,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700 select-none ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg
          className={`h-4 w-4 transition-colors ${
            isActive ? "text-blue-600" : "text-gray-300"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          {direction === "desc" || !isActive ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          )}
        </svg>
      </span>
    </th>
  );
}
```

### Install Button with Copy Feedback
```typescript
// Source: Native Clipboard API + codebase button patterns
interface InstallButtonProps {
  skillName: string;
  skillSlug: string;
  isCopied: boolean;
  onCopy: () => void;
  variant?: "full" | "icon";
}

export function InstallButton({
  skillName,
  skillSlug,
  isCopied,
  onCopy,
  variant = "full",
}: InstallButtonProps) {
  if (variant === "icon") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation(); // Don't trigger row expansion
          onCopy();
        }}
        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
        title={isCopied ? "Copied!" : `Install ${skillName}`}
      >
        {isCopied ? (
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onCopy}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        isCopied
          ? "bg-green-100 text-green-800"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isCopied ? "Copied!" : "Install"}
    </button>
  );
}
```

### MCP Config Generator
```typescript
// Source: apps/mcp/claude_desktop_config.example.json format
export function generateMcpConfig(skill: { name: string; slug: string }): string {
  const config = {
    mcpServers: {
      [skill.slug]: {
        command: "npx",
        args: ["-y", `@everyskill/${skill.slug}`],
      },
    },
  };
  return JSON.stringify(config, null, 2);
}
```

### Accordion Content (Preview Card Style)
```typescript
// Source: skill-card.tsx styling adapted for inline accordion
interface AccordionContentProps {
  skill: SkillTableRow & {
    description: string;
    category: string;
    tags?: string[];
  };
  onInstall: () => void;
  isCopied: boolean;
}

export function SkillAccordionContent({ skill, onInstall, isCopied }: AccordionContentProps) {
  return (
    <tr className="bg-blue-50">
      <td colSpan={6} className="px-4 py-4">
        <div className="rounded-lg border border-blue-100 bg-white p-4">
          {/* Category badge */}
          <span className="text-xs font-medium uppercase text-blue-600">
            {skill.category || "Uncategorized"}
          </span>

          {/* Description */}
          <p className="mt-2 text-sm text-gray-700">
            {skill.description || "No description provided."}
          </p>

          {/* Tags if present */}
          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Install button */}
          <div className="mt-4">
            <InstallButton
              skillName={skill.name}
              skillSlug={skill.slug}
              isCopied={isCopied}
              onCopy={onInstall}
              variant="full"
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| document.execCommand("copy") | navigator.clipboard.writeText() | 2019+ | Better security, promise-based, async |
| Custom URL state hooks | nuqs library | nuqs 1.0+ | Type-safe, framework-aware, fewer bugs |
| Redux for UI state | React useState/useContext | React 16.8+ hooks | Simpler, co-located state |

**Deprecated/outdated:**
- `document.execCommand("copy")`: Deprecated, use Clipboard API instead
- `next-usequerystate`: Renamed to nuqs in v2.0

## Open Questions

Things that couldn't be fully resolved:

1. **Tracking Install Metrics**
   - What we know: CONTEXT.md says "Clicking Install increments the skill's install/usage count"
   - What's unclear: Whether this should be a server action or analytics event; existing `totalUses` is for actual usage, not installs
   - Recommendation: Create separate `installCount` column or use analytics; defer to implementation phase

2. **MCP Config Command Format**
   - What we know: Example shows `npx -y @everyskill/skill-slug` format
   - What's unclear: Whether skills are published to npm or need different installation method
   - Recommendation: Use the example format; actual package publishing is separate concern

3. **Author Filter Chip Location**
   - What we know: Should appear as removable chip in filter bar
   - What's unclear: Exact placement relative to existing CategoryFilter, TagFilter, QualityFilter
   - Recommendation: Add after QualityFilter, before SortDropdown; or create separate "Active Filters" row

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/apps/web/components/category-filter.tsx`, `tag-filter.tsx`, `sort-dropdown.tsx`, `search-input.tsx`
- Codebase analysis: `/apps/web/package.json` (nuqs 2.8.7)
- Codebase analysis: `/apps/mcp/claude_desktop_config.example.json`
- [nuqs official docs](https://nuqs.dev/docs/parsers) - Parsers reference
- [nuqs official docs](https://nuqs.dev/docs/options) - Configuration options

### Secondary (MEDIUM confidence)
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) - Modern clipboard usage
- [LogRocket - React Clipboard](https://blog.logrocket.com/implementing-copy-clipboard-react-clipboard-api/) - Copy patterns

### Tertiary (LOW confidence)
- WebSearch results for MCP config format - confirmed against codebase example

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already in codebase, verified versions
- Architecture: HIGH - Follows established codebase patterns exactly
- Pitfalls: MEDIUM - Based on React/Next.js experience, some theoretical

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable patterns, nuqs 2.x well-established)
