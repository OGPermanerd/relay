---
phase: "13"
plan: "01"
subsystem: "ui-components"
tags: [sorting, hooks, nuqs, url-state]
depends_on:
  requires: ["12-02"]
  provides: ["useSortState hook", "SortableColumnHeader component"]
  affects: ["13-02", "13-03"]
tech_tracking:
  added: []
  patterns: ["URL state synchronization via nuqs"]
key_files:
  created:
    - apps/web/hooks/use-sort-state.ts
    - apps/web/components/sortable-column-header.tsx
  modified: []
metrics:
  duration: "~2 min"
  completed: "2026-02-01"
---

# Phase 13 Plan 01: Sorting Infrastructure Summary

**One-liner:** URL-synced sort state hook with nuqs and sortable column header component with chevron indicators

## What Was Built

### useSortState Hook (`apps/web/hooks/use-sort-state.ts`)

Custom hook providing URL-synchronized sorting state:

- **Exports:** `useSortState`, `SORT_COLUMNS`, `SortColumn`, `SortDirection`
- **URL params:** `sortBy` and `sortDir` for shareable sorted views
- **Default sort:** `days_saved` descending (most impactful first)
- **Toggle behavior:** Same column toggles direction; new column resets to desc
- **Non-blocking:** Uses `useTransition` for smooth updates

```typescript
const { sortBy, sortDir, isPending, toggleSort } = useSortState();
```

### SortableColumnHeader Component (`apps/web/components/sortable-column-header.tsx`)

Clickable table header with sort indicator:

- **Chevron states:** Blue-600 when active, gray-300 when inactive
- **Direction:** Up chevron for ascending, down for descending/inactive
- **Styling:** Matches existing th styling (px-4 py-3, text-xs font-medium uppercase)
- **Alignment:** Supports left/right/center via `align` prop

```typescript
<SortableColumnHeader
  column="days_saved"
  label="Days Saved"
  currentSort={sortBy}
  direction={sortDir}
  onSort={toggleSort}
  align="right"
/>
```

## Commits

| Hash    | Type | Description                                   |
| ------- | ---- | --------------------------------------------- |
| d5dcf93 | feat | create useSortState hook with nuqs URL state  |
| 26afdba | feat | create SortableColumnHeader component         |

## Verification

- [x] TypeScript compiles without errors
- [x] Both files exist and export expected symbols
- [x] useSortState hook uses nuqs with sortBy/sortDir URL params
- [x] SortableColumnHeader matches existing table header styling

## Deviations from Plan

None - plan executed exactly as written.

## Integration Notes for Plan 03

The components are ready for integration into SkillsTable:

1. Import `useSortState` and `SortableColumnHeader`
2. Replace static `<th>` elements with `<SortableColumnHeader>`
3. Use `sortBy`/`sortDir` for client-side sorting logic
4. Convert to client component to use hooks

## Next Phase Readiness

Ready for Plan 02 (Accordion Infrastructure) - no blockers.
