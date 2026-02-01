# Feature Landscape: Sortable Table UI with Inline Expansion

**Domain:** Developer tools dashboard - sortable data tables with accordion rows
**Researched:** 2026-02-01
**Confidence:** HIGH (based on established UX patterns, W3C guidelines, and current React ecosystem)

## Context

Relay v1.2 redesigns from card-based skill display to a two-panel sortable table layout:
- Skills table with columns: days_saved, installs, date added, handle, sparkline
- Click column header to toggle sort ascending/descending
- Click row to expand inline showing description/instructions (accordion)
- One-click install button per row
- Leaderboard table showing contributors

This research focuses on UI patterns and behaviors expected for sortable data tables with inline expansion in developer tools.

---

## Table Stakes

Features users expect. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Column header sort** | Standard interaction pattern; users click headers to sort | Low | Toggle ascending/descending on click. All sortable columns must be clickable. |
| **Sort direction indicator** | Users need to know current sort state | Low | Use chevron/triangle: up (ascending), down (descending). Show on active column only. |
| **Unsorted column affordance** | Users need to know which columns are sortable | Low | Show muted up-down arrows on hover, or always show them in a subtle state. |
| **Row expansion trigger** | Users need clear affordance to expand rows | Low | Chevron icon at row start (right-facing when collapsed, down when expanded). Entire row clickable is optional enhancement. |
| **Smooth expand/collapse animation** | Jarring transitions feel broken | Low | 150-200ms transition for height change. Content should not jump. |
| **Keyboard navigation** | Accessibility requirement (WCAG 2.1 AA) | Medium | Tab to navigate headers/rows, Enter/Space to sort/expand, Arrow keys within table. |
| **Visible focus states** | Accessibility requirement | Low | Clear focus ring on interactive elements (headers, rows, buttons). |
| **Responsive behavior** | Mobile users exist | Medium | Table must work on smaller screens (stacked cards, horizontal scroll, or priority columns). |
| **URL-persisted sort state** | Users share links, use back button | Low | Sort parameters in URL query string. Already using nuqs - extend pattern. |
| **Loading states** | Network requests take time | Low | Skeleton or spinner when sort triggers data fetch. |

### Sort Behavior Specifications

Based on established patterns from [Shadcn/ui](https://www.shadcn.io/blocks/tables-sortable) and [Material React Table](https://mui.com/material-ui/react-table/):

| Data Type | Ascending | Descending | Default |
|-----------|-----------|------------|---------|
| Numbers (days_saved, installs) | 1 to 100 | 100 to 1 | Descending (show highest first) |
| Dates (date_added) | Oldest first | Newest first | Descending (newest first) |
| Strings (handle) | A to Z | Z to A | Ascending |

### Expansion Behavior Specifications

Based on [Nielsen Norman Group](https://www.nngroup.com/articles/accordions-on-desktop/) and [UX Patterns](https://uxpatterns.dev/patterns/content-management/accordion) research:

| Behavior | Recommendation | Rationale |
|----------|---------------|-----------|
| Multiple expanded | YES - allow multiple rows expanded | Users may want to compare skills. Auto-collapse is disorienting. |
| Persist expanded state | YES - within session | Scrolling away and back should preserve state. |
| Expand animation | 150-200ms ease-out | Feels responsive but not jarring. |
| Expanded content height | Auto/measured | Do not use fixed height - content length varies. |

---

## Differentiators

Features that set product apart. Not expected, but valued by power users.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sticky column headers** | Headers visible during scroll | Low | Critical for long lists. Standard in modern data tables. |
| **Multi-column sort** | Sort by primary, then secondary column | Medium | Power user feature. Show sort priority badges (1, 2). Click + Shift/Cmd pattern. |
| **Column resize** | Adjust column widths | Medium | Nice for wide content. Can defer to post-MVP. |
| **Keyboard shortcuts** | Fast navigation for power users | Medium | j/k for row navigation, Enter to expand, i for install. Show in tooltip/help. |
| **Inline install feedback** | Visual confirmation of install action | Low | Button state change, brief success toast. No page navigation. |
| **"Expand all" / "Collapse all"** | Batch operation | Low | Useful for scanning all descriptions quickly. |
| **Remember sort preference** | Persist user's preferred sort across sessions | Low | localStorage or user preferences table. |
| **Virtualized rendering** | Smooth performance with 1000+ rows | High | Only if performance becomes issue. Libraries: react-virtual, tanstack-virtual. |
| **Row selection** | Select multiple for batch operations | Medium | Future: batch install, compare selected. Checkbox column. |
| **Density toggle** | Compact vs comfortable row height | Low | Power users often prefer dense; casual users prefer spacious. |
| **Column visibility toggle** | Hide/show columns | Medium | Useful when screen space limited or columns irrelevant. |
| **Sparkline tooltip** | Hover shows detailed trend data | Low | "Last 30 days: 45, 52, 38, 61..." - adds context to the mini chart. |

### Leaderboard-Specific Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Segmented views** | Weekly/monthly/all-time tabs | Low | Prevents stagnant all-time leaders discouraging new contributors. |
| **"Your position" highlight** | Show logged-in user's rank prominently | Low | Even if not in top 10, show "You are #47". Motivating. |
| **Relative ranking** | Show users immediately above/below | Low | "You're 2 skills behind #46" - creates achievable goals. |
| **Movement indicators** | Show rank changes from previous period | Medium | Up/down arrows with delta. Gamification element. |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| **Auto-collapse on expand** | "Keeps UI tidy" | Disorienting; users lose context; can't compare rows; [NN/g research](https://www.nngroup.com/articles/accordions-on-desktop/) explicitly advises against | Allow multiple expanded rows |
| **Hover-to-expand** | "Faster than clicking" | Accidental triggers while scrolling; accessibility nightmare; no mobile equivalent | Click/tap to expand only |
| **Sort on hover** | "Discoverable" | Accidental sort changes are frustrating; requires click intent | Sort on click only |
| **Pagination** | "Standard for large tables" | Breaks mental model; users lose place; can't search within page | Infinite scroll or virtual scrolling. Show all rows, virtualize rendering. |
| **Modal for details** | "More space for content" | Context switch; loses table state; can't compare multiple items | Inline expansion or side panel |
| **Right-click context menu** | "Advanced options" | Undiscoverable; no mobile equivalent; conflicts with browser menu | Visible action buttons or kebab menu |
| **Editable cells inline** | "Quick editing" | Scope creep; tables for reading, forms for editing; accidental edits | Edit in dedicated view/modal |
| **Drag-to-reorder columns** | "Customization" | Rarely used; implementation complexity; state management overhead | Fixed sensible column order |
| **Sticky first column** | "Always see row identifier" | Adds scroll complexity; rarely needed if columns well-chosen | Make first column narrow (rank/handle) so visible without stickiness |
| **Color-coded rows** | "Visual hierarchy" | Often inaccessible; information should not rely on color alone | Use icons, badges, or position to convey meaning |

---

## Keyboard Accessibility (WCAG 2.1 AA Required)

Based on [W3C ARIA APG Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/) and [Carbon Design System](https://carbondesignsystem.com/components/data-table/accessibility/):

### Required Interactions

| Key | Action |
|-----|--------|
| Tab | Move focus between interactive elements (headers, expand triggers, action buttons) |
| Shift+Tab | Move focus backwards |
| Enter/Space | Activate sort (on header), toggle expand (on row), trigger action (on button) |
| Arrow Up/Down | Move between rows (when row is focused) |
| Arrow Left/Right | Move between columns (within row) |
| Home/End | Jump to first/last row |
| Escape | Close expanded row (optional, nice to have) |

### ARIA Requirements

| Element | ARIA Attribute | Value |
|---------|---------------|-------|
| Sortable header | `aria-sort` | `ascending`, `descending`, or `none` |
| Sort button | `aria-label` | "Sort by [column name], currently [sorted/unsorted] [ascending/descending]" |
| Expandable row | `aria-expanded` | `true` or `false` |
| Expanded content | `aria-hidden` | `false` when visible, `true` when collapsed |
| Table | `role` | `grid` (if fully keyboard navigable) or `table` |

### Screen Reader Announcements

- On sort: "Sorted by [column], [ascending/descending]"
- On expand: "[Row name] expanded" / "[Row name] collapsed"
- On install: "[Skill name] installed successfully" or error message

---

## Mobile/Responsive Considerations

Based on [UX Movement](https://uxmovement.medium.com/stacked-list-the-best-way-to-fit-tables-on-mobile-screens-79f7789e079b) and current patterns:

### Recommended Approach: Stacked Cards on Mobile

| Breakpoint | Layout |
|------------|--------|
| Desktop (1024px+) | Full table with all columns |
| Tablet (768-1023px) | Table with priority columns (hide sparkline, combine metrics) |
| Mobile (<768px) | Stacked cards - each row becomes a card |

### Mobile Card Layout

```
+----------------------------------+
| [Handle] [Quality Badge]    [>]  |  <- Tap to expand
| 1,234 installs  |  45.2 days     |
| Added Jan 15, 2026               |
+----------------------------------+
```

Expanded state adds description/instructions below.

### Alternative: Horizontal Scroll

If stacked cards feel too different from desktop:
- First column sticky (handle)
- Horizontal scroll for other columns
- Swipe affordance indicator

**Recommendation:** Stacked cards for Relay. The expanded description content needs vertical space that horizontal scroll doesn't provide gracefully.

---

## Feature Dependencies

```
[Sortable Headers] -----> [URL State Sync] (sort persisted)
      |
      v
[Sort Indicators] -----> [Accessibility Announcements]
      |
      v
[Row Expansion] -----> [Keyboard Navigation]
      |                      |
      v                      v
[Install Button] <---- [Focus Management]
      |
      v
[Success Feedback]
```

### Implementation Order

1. **Base table structure** - Headers, rows, basic styling
2. **Sort on column click** - Core interaction
3. **Sort indicators** - Visual feedback
4. **URL state sync** - Shareability
5. **Row expansion** - Accordion behavior
6. **Keyboard navigation** - Accessibility
7. **Mobile responsive** - Stacked cards
8. **Leaderboard enhancement** - Time segments, user highlighting

---

## MVP Recommendation

### Phase 1: Table Stakes (Must Have)

- [ ] Sortable column headers with click toggle
- [ ] Sort direction indicators (chevron up/down)
- [ ] Unsorted columns show sortable affordance
- [ ] Single-click row expansion with chevron
- [ ] Smooth expand/collapse animation
- [ ] Multiple rows expandable simultaneously
- [ ] URL-persisted sort state
- [ ] Basic keyboard navigation (Tab, Enter)
- [ ] Visible focus states
- [ ] Loading state on sort

### Phase 2: Polish (Should Have)

- [ ] Sticky headers on scroll
- [ ] Mobile stacked card layout
- [ ] Full ARIA implementation
- [ ] Sparkline tooltips
- [ ] Install button with inline feedback
- [ ] Leaderboard time segment tabs

### Phase 3: Delight (Nice to Have)

- [ ] Keyboard shortcuts (j/k navigation)
- [ ] Remember sort preference
- [ ] "Your position" in leaderboard
- [ ] Movement indicators in leaderboard
- [ ] Expand all / Collapse all
- [ ] Density toggle

### Defer (Out of Scope for v1.2)

- Multi-column sort
- Column resize
- Row selection / batch operations
- Virtualized rendering (unless performance issue emerges)
- Column visibility toggle

---

## Sources

### UX Patterns & Best Practices
- [Pencil & Paper: Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) - Enterprise table patterns
- [Eleken: Table Design UX Guide](https://www.eleken.co/blog-posts/table-design-ux) - SaaS table usability
- [LogRocket: Data Table Design Best Practices](https://blog.logrocket.com/ux-design/data-table-design-best-practices/) - General best practices
- [Nielsen Norman Group: Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/) - Accordion behavior research
- [Andrew Coyle: Design Better Accordions](https://coyleandrew.medium.com/design-better-accordions-c67ae38e6713) - Accordion UX patterns

### Accessibility
- [W3C WAI: Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/) - Accessibility fundamentals
- [W3C ARIA APG: Sortable Table Example](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/) - ARIA implementation
- [Carbon Design System: Data Table Accessibility](https://carbondesignsystem.com/components/data-table/accessibility/) - Enterprise accessibility patterns
- [USWDS: Table Accessibility Tests](https://designsystem.digital.gov/components/table/accessibility-tests/) - Testing checklist

### Sort Icons & Indicators
- [Rimsha: Sorting Icons in UI](https://medium.com/design-bootcamp/sorting-icons-in-ui-what-works-best-for-table-design-and-user-experience-ux-e1a1d1b58fa7) - Icon comparison
- [Arnaud Jaegers: Sorting Arrow Confusion](https://medium.com/hackernoon/sorting-arrow-confusion-in-data-tables-5a3117698fdf) - Common mistakes

### Mobile Patterns
- [UX Movement: Stacked List for Mobile Tables](https://uxmovement.medium.com/stacked-list-the-best-way-to-fit-tables-on-mobile-screens-79f7789e079b) - Card view pattern
- [Medium: Responsive Data Tables Solutions](https://medium.com/appnroll-publication/5-practical-solutions-to-make-responsive-data-tables-ff031c48b122) - Multiple approaches
- [Medium: User-Friendly Mobile Data Tables](https://medium.com/design-bootcamp/designing-user-friendly-data-tables-for-mobile-devices-c470c82403ad) - Mobile UX

### Sparklines
- [FusionCharts: Sparklines Complete Guide](https://www.fusioncharts.com/resources/chart-primers/spark-charts) - Design principles
- [LinkedIn: Sparkline Best Practices](https://www.linkedin.com/advice/0/what-best-practices-using-sparklines-your-data-hyquc) - Usage guidelines

### Leaderboards
- [UI Patterns: Leaderboard](https://ui-patterns.com/patterns/leaderboard) - Design pattern
- [Yu-kai Chou: How to Design Effective Leaderboards](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/) - Gamification psychology

### React Libraries
- [Shadcn/ui: Sortable Tables](https://www.shadcn.io/blocks/tables-sortable) - Implementation reference
- [Material React Table](https://mui.com/material-ui/react-table/) - Full-featured table component
- [TanStack Table](https://tanstack.com/table) - Headless table library

---

*Feature research for: Relay v1.2 Sortable Table UI*
*Researched: 2026-02-01*
*Confidence: HIGH - Based on established UX patterns, W3C guidelines, and current React ecosystem*
