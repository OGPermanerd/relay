# Technology Stack: UI Redesign - Sortable Tables

**Project:** Relay v1.2 - Two-Panel UI with Sortable Tables
**Researched:** 2026-02-01
**Scope:** Stack additions for sortable data tables, accordion rows, and performance optimization
**Confidence:** HIGH (verified via official docs, shadcn patterns, and current npm versions)

---

## Executive Summary

For the v1.2 two-panel UI redesign with sortable tables and accordion rows, the recommendation is:

**Use TanStack Table v8 + shadcn/ui Table + Collapsible + existing nuqs for URL state**

This approach:
- Leverages the existing stack (shadcn/ui, nuqs) rather than adding new dependencies
- Uses TanStack Table for headless table logic (sorting, expansion) - industry standard
- Keeps bundle size minimal (~5-14kb for TanStack Table)
- Avoids virtualization (not needed for <50 rows)

**DO NOT add:** react-window, react-virtual, AG Grid, or other virtualization libraries. The skill catalog will have <100 rows visible at once, well below the 50+ row threshold where virtualization provides benefits.

---

## Stack Additions

### Required New Dependencies

| Library | Version | Purpose | Bundle Size | Why |
|---------|---------|---------|-------------|-----|
| **@tanstack/react-table** | ^8.21.3 | Headless table logic | ~5-14kb | Industry standard for sortable, expandable tables. Provides sorting state, row expansion, column definitions. Zero UI opinions - pairs perfectly with shadcn/ui. Used by shadcn's own data-table pattern. |
| **lucide-react** | ^0.469.0 | Sort icons | Tree-shakeable | ArrowUp, ArrowDown, ChevronsUpDown for sort indicators. Already likely in use if shadcn/ui is installed. |

### Required shadcn/ui Components

| Component | Installation | Purpose |
|-----------|--------------|---------|
| **Table** | `npx shadcn@latest add table` | Base table styling (TableHeader, TableBody, TableRow, TableCell) |
| **Collapsible** | `npx shadcn@latest add collapsible` | Accordion row expansion without TanStack's subRows complexity |
| **Button** | Already installed | Sort toggle triggers, Install button |
| **Badge** | `npx shadcn@latest add badge` | Tags, categories in expanded rows |

### Installation Commands

```bash
# In apps/web directory
pnpm add @tanstack/react-table

# shadcn components (run from apps/web)
npx shadcn@latest add table
npx shadcn@latest add collapsible
npx shadcn@latest add badge
```

---

## Stack Recommendations by Feature

### 1. Sortable Column Headers

**Approach:** TanStack Table `getSortedRowModel()` + nuqs URL state

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Sort logic | TanStack Table | Built-in `getSortedRowModel()`, handles ascending/descending/none cycling |
| State persistence | nuqs | Already in stack. Use `parseAsStringLiteral(['asc', 'desc', 'none'])` for sort direction, `parseAsString` for sort column |
| Header UI | shadcn Button variant="ghost" | Click-to-toggle pattern, accessible |
| Sort indicators | lucide-react icons | ArrowUp, ArrowDown, ChevronsUpDown (unsorted) |

**Pattern:**
```typescript
// Using nuqs for URL-persisted sort state
const [sortState, setSortState] = useQueryStates({
  sortBy: parseAsString.withDefault('days_saved'),
  sortDir: parseAsStringLiteral(['asc', 'desc']).withDefault('desc')
})

// TanStack Table integration
const table = useReactTable({
  data,
  columns,
  state: { sorting: [{ id: sortState.sortBy, desc: sortState.sortDir === 'desc' }] },
  onSortingChange: (updater) => {
    // Sync to nuqs
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
```

### 2. Accordion Row Expansion

**Approach:** shadcn Collapsible component (NOT TanStack subRows)

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Expansion logic | Collapsible from shadcn/ui | Simpler than TanStack's `getExpandedRowModel()` for non-hierarchical data. No need for subRows data structure. |
| Expansion trigger | ChevronRight/ChevronDown icon in first column | Standard UX pattern |
| Expanded content | Full-width TableCell with colSpan | Shows description, install button, metadata |

**Why NOT TanStack expanding:**
- TanStack's expanding feature is designed for hierarchical data (parent-child rows)
- Our use case is inline detail panels (accordion), not nested rows
- Collapsible component is simpler, already styled, and doesn't require restructuring data

**Pattern:**
```tsx
<Collapsible asChild>
  <>
    <CollapsibleTrigger asChild>
      <TableRow className="cursor-pointer hover:bg-muted/50">
        {/* Main row cells */}
      </TableRow>
    </CollapsibleTrigger>
    <CollapsibleContent asChild>
      <TableRow>
        <TableCell colSpan={columns.length} className="bg-muted/30 p-4">
          {/* Expanded detail panel */}
        </TableCell>
      </TableRow>
    </CollapsibleContent>
  </>
</Collapsible>
```

### 3. Performance Optimization

**Approach:** No virtualization needed

| Row Count | Recommendation | Applied to Relay |
|-----------|----------------|------------------|
| < 50 rows | No virtualization | Skills table - paginated to 25-50 |
| 50-100 rows | Consider if issues | Leaderboard - unlikely to exceed 50 |
| 100+ rows | Virtualization recommended | N/A - not our use case |
| 1000+ rows | Virtualization required | N/A |

**Rationale:**
- Skills table is paginated (25-50 rows per page)
- Leaderboard shows top contributors (10-25 rows)
- Virtualization adds ~10-15kb bundle and complexity
- React 19's concurrent features handle normal table rendering efficiently

**If virtualization ever needed:**
```bash
# Only add if >100 rows AND performance issues observed
pnpm add @tanstack/react-virtual  # v3.13.18, ~10-15kb
```

### 4. One-Click Install Button

**Approach:** Server Action + optimistic UI

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| UI | shadcn Button with loading state | Consistent with existing patterns |
| Action | Server Action in actions.ts | Type-safe, no API route needed |
| Feedback | Toast notification | Confirm success/failure |
| Copy mechanic | `navigator.clipboard.writeText()` | Copy MCP config to clipboard |

**No new dependencies needed** - use existing shadcn Button + Server Actions pattern.

---

## What NOT to Add

| Library | Why NOT to Add |
|---------|----------------|
| **@tanstack/react-virtual** | <50 visible rows - virtualization adds overhead without benefit |
| **react-window** | Same as above - older virtualization library |
| **react-virtualized** | Deprecated in favor of react-window and TanStack Virtual |
| **AG Grid** | Enterprise-grade overkill. 500kb+ bundle. For 10k+ rows with complex features. |
| **MUI X Data Grid** | Heavy MUI dependency. We use shadcn/ui. |
| **react-data-table-component** | Opinionated styling conflicts with shadcn/ui |
| **Zustand for table state** | nuqs already in stack and handles URL persistence |

---

## Integration with Existing Stack

### nuqs Integration

Already installed (`nuqs@^2.8.7`). Use for:
- Sort column (`?sortBy=days_saved`)
- Sort direction (`?sortDir=desc`)
- Search query (`?q=search-term`) - already exists
- Pagination (`?page=1`) - if implementing

**TanStack Table has community parsers for nuqs** - though sorting/filtering parsers are community-contributed, the pattern is well-established.

### shadcn/ui Integration

TanStack Table is headless - no UI opinions. The official shadcn/ui documentation recommends this exact approach:

> "It doesn't make sense to combine all of these variations into a single component. If we do that, we'll lose the flexibility that headless UI provides."

Pattern: TanStack Table for logic + shadcn Table for styling.

### React 19 Compatibility

TanStack Table v8.21.3 works with React 19 (verified via npm). Note from docs:
> "Even though the react adapter works with React 19, it may not work with the new React Compiler that's coming out along-side React 19."

This is fine - React Compiler is opt-in and not yet stable.

---

## File Structure Recommendation

Based on shadcn patterns:

```
apps/web/
├── components/
│   └── skills-table/
│       ├── columns.tsx              # Column definitions with TanStack
│       ├── data-table.tsx           # Main table component
│       ├── data-table-header.tsx    # Sortable header component
│       ├── data-table-row.tsx       # Expandable row with Collapsible
│       └── install-button.tsx       # One-click install action
├── app/(protected)/
│   └── page.tsx                     # Two-panel layout
└── lib/
    └── table-state.ts               # nuqs hooks for table state
```

---

## Version Compatibility Matrix

| Package | Version | Requires | Notes |
|---------|---------|----------|-------|
| @tanstack/react-table | ^8.21.3 | React 16.8+ | Works with React 19 |
| nuqs | ^2.8.7 | React 18+ / Next.js 13+ | Already in stack |
| shadcn/ui table | Latest | Tailwind CSS 4.x | Already in stack |
| lucide-react | ^0.469.0 | React 16.8+ | Tree-shakeable icons |

---

## Bundle Impact Assessment

| Addition | Size | Total Impact |
|----------|------|--------------|
| @tanstack/react-table | ~5-14kb gzipped | Minimal |
| shadcn Table component | ~1kb (compiled) | Minimal |
| shadcn Collapsible | ~2kb (compiled) | Minimal |
| lucide-react icons (tree-shaken) | ~200b per icon | Negligible |
| **Total** | **~10-18kb** | **Acceptable** |

Compare to alternatives:
- AG Grid Community: ~500kb
- MUI X Data Grid: ~300kb
- react-data-table-component: ~50kb

---

## Sources

**HIGH Confidence (Official Documentation):**
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - Official TanStack Table integration pattern
- [TanStack Table Docs](https://tanstack.com/table/latest) - v8 features, sorting, expanding APIs
- [TanStack Table Sorting](https://tanstack.com/table/v8/docs/guide/sorting) - Sorting implementation
- [TanStack Table Expanding](https://tanstack.com/table/v8/docs/guide/expanding) - Row expansion
- [nuqs TanStack Table Parsers](https://nuqs.dev/docs/parsers/community/tanstack-table) - URL state integration
- [npm @tanstack/react-table](https://www.npmjs.com/package/@tanstack/react-table) - v8.21.3, last publish info

**MEDIUM Confidence (Community Best Practices):**
- [Virtualization Thresholds](https://www.material-react-table.com/docs/guides/virtualization) - 50+ row guidance
- [Expandable shadcn Table Pattern](https://dev.to/mfts/build-an-expandable-data-table-with-2-shadcnui-components-4nge) - Collapsible approach
- [OpenStatus Data Table](https://github.com/openstatusHQ/data-table-filters) - TanStack + shadcn + nuqs reference implementation

---

*Stack research for: Relay v1.2 UI Redesign - Sortable Tables*
*Researched: 2026-02-01*
