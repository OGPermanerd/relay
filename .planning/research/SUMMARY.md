# Project Research Summary

**Project:** Relay v1.2 UI Redesign
**Domain:** Two-panel sortable table layout with accordion rows, one-click MCP install
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

This v1.2 milestone adds a two-panel UI redesign to an existing Next.js 15 internal skill marketplace app. The recommended approach is to **extend the existing hybrid Server/Client Component architecture** using shadcn/ui Table + Collapsible components with nuqs for URL-persisted sort state. Do NOT add TanStack Table - the use case (single-column sort, row expansion, <100 visible rows) doesn't justify the complexity or bundle size.

The key technical decision is maintaining the existing pattern: Server Components handle data fetching and table structure, while targeted Client Components manage interactive elements (sort controls via nuqs, accordion expansion via local state, install button). This aligns with established patterns already in the codebase (SearchInput, CategoryFilter using nuqs) and leverages Next.js 15's streaming/concurrent features for performance.

**Critical risks:** (1) Performance degradation if virtualization is added prematurely (<100 rows don't need it), (2) Unstable data references causing infinite re-renders if useMemo is skipped, (3) Accessibility failures if accordion doesn't properly hide collapsed content from screen readers, (4) Event propagation breaking row actions if stopPropagation is forgotten. All four risks are preventable with disciplined implementation following the researched patterns.

## Key Findings

### Recommended Stack

The stack additions are minimal because the existing infrastructure already provides what's needed. Research initially evaluated TanStack Table, but deeper analysis reveals the existing nuqs + Server Component pattern is superior for this specific use case.

**Core technologies:**
- **shadcn/ui Table + Collapsible**: Already in stack - provides styled table structure and accordion components without bundle overhead
- **nuqs v2.8.7**: Already in stack - extends for sortBy/sortDir URL params following existing CategoryFilter/QualityFilter patterns
- **lucide-react icons**: Already in stack - ArrowUp/ArrowDown/ChevronsUpDown for sort indicators (200 bytes per icon, tree-shaken)
- **Server Actions**: Already in stack - getInstallContent action provides clipboard copy for MCP-style installs

**What NOT to add:**
- **@tanstack/react-table**: Overkill for single-column sort, adds 5-14kb for features we won't use (multi-column sort, pagination, column resize). The "headless" benefit doesn't matter when Server Components already handle data transformations.
- **@tanstack/react-virtual**: No virtualization needed for <100 visible rows. Adds 10-15kb + complexity, provides zero performance benefit until 100+ rows are rendered.

**Bundle impact:** Effectively zero bytes (all components already installed).

### Expected Features

**Must have (table stakes):**
- **Column header sort** - Toggle ascending/descending on click with visual indicators (chevron up/down)
- **URL-persisted sort state** - Shareable/bookmarkable views via nuqs (consistent with existing filters)
- **Row expansion (accordion)** - Click row to show inline detail panel with description, install button, metadata
- **Smooth expand/collapse animation** - 150-200ms transition to avoid jarring jumps
- **Multiple simultaneous expansions** - Users should be able to compare skills (auto-collapse is disorienting per NN/g research)
- **Keyboard navigation** - Tab to navigate, Enter/Space to sort/expand (WCAG 2.1 AA requirement)
- **Visible focus states** - Clear focus ring on interactive elements for accessibility

**Should have (competitive):**
- **Sticky column headers** - Headers visible during scroll (standard in modern data tables)
- **Mobile stacked card layout** - Transform table to cards on mobile (<768px breakpoint)
- **Sparkline tooltips** - Hover shows detailed trend data ("Last 30 days: 45, 52, 38...")
- **Leaderboard time segments** - Weekly/monthly/all-time tabs to prevent stagnation
- **"Your position" highlight** - Show logged-in user's rank even if not in top 10

**Defer (v2+):**
- Multi-column sort (complexity overkill for v1.2)
- Column resize (nice-to-have, not essential)
- Row selection/batch operations (future: batch install)
- Virtualized rendering (only if 100+ rows becomes a problem)
- Column visibility toggle (screen space not constrained yet)

### Architecture Approach

Use the **hybrid Server Component + Client Component pattern** already established in the codebase. The page.tsx Server Component fetches data via searchSkills() with extended sortBy/sortDir parameters, then passes pre-sorted data to presentation components. Interactive elements (TableSortControls, SkillTableRow, InstallButton) are Client Components managing their own local state or nuqs URL state.

**Major components:**
1. **page.tsx (Server)** - Fetches sorted skills data, orchestrates two-panel layout (2/3 + 1/3 width)
2. **TableSortControls (Client)** - Column header sort buttons using nuqs for URL state, triggers server re-render
3. **SkillTableRow (Client)** - Individual row with Collapsible managing local isOpen state for accordion expansion
4. **InstallButton (Client)** - Triggers Server Action to copy skill content to clipboard with MCP usage instructions
5. **LeaderboardPanel (Server)** - Existing component, minor modifications for two-panel integration

**Key pattern decisions:**
- **NOT using TanStack Table**: Server Components already handle sorting/filtering logic. Client-side table state management adds complexity without benefit.
- **Local state for accordion**: Each row manages its own expansion independently. Avoids prop drilling and unnecessary re-renders.
- **Server Action for install**: Web app can't directly invoke MCP (runs in Claude Code), so best approach is clipboard copy + instructions.

### Critical Pitfalls

Research identified 18 table-specific pitfalls across critical/moderate/minor severity. Top 5 for this milestone:

1. **Unstable data/column references causing infinite re-renders** - ALWAYS wrap data/columns in useMemo. Inline arrays create new references each render, triggering infinite loops. This is the #1 cause of table crashes.

2. **Event propagation breaking row actions** - Clicking "Install" button also triggers row onClick (accordion toggle) unless stopPropagation() is called. Test EVERY interactive element in rows.

3. **Accordion content accessible when collapsed** - CSS-only hiding leaves content in accessibility tree. Use `hidden` attribute + `aria-expanded` to properly hide from screen readers.

4. **Client-only table in Next.js** - Adding "use client" at page level loses SSR benefits. Keep page as Server Component, only mark interactive components as client.

5. **Rendering all rows without virtualization** - Only a risk if catalog exceeds 100 rows. For v1.2 (likely <50 visible rows), virtualization adds overhead without benefit. Monitor performance and add if needed.

**Additional table UI pitfalls to watch:**
- Sorting state conflicts (initialState vs state in TanStack) - not applicable since we're not using TanStack Table
- Missing sort direction indicators - users need visual feedback (chevron up/down)
- Accordion state lost on sort - key expansion by stable row ID, not array index
- Focus management lost on expand/collapse - return focus to trigger button
- Missing mobile responsive strategy - design stacked card layout for <768px

## Implications for Roadmap

Based on research, the v1.2 UI redesign should be implemented in 3 focused phases that build incrementally while avoiding the critical pitfalls.

### Phase 1: Two-Panel Layout Foundation
**Rationale:** Establish the layout structure and non-interactive table before adding complex interactions. This allows verification that existing data fetching patterns work correctly and provides a stable base for interactivity.

**Delivers:**
- TwoPanelLayout component (2/3 + 1/3 grid with responsive breakpoints)
- SkillsTable Server Component (renders table structure with pre-sorted data)
- Extended searchSkills() to accept sortBy/sortDir params with server-side SQL sorting
- Basic table styling using shadcn/ui Table components
- Leaderboard integrated into right panel

**Addresses features:**
- Table structure (prerequisite for all other features)
- Server-side data flow pattern

**Avoids pitfalls:**
- #13 (Client-only table) - established Server Component pattern from start
- #7 (Virtualization) - explicitly defer until proven needed

**Research flag:** Standard patterns, no deep research needed. Follow existing page.tsx + nuqs patterns.

---

### Phase 2: Interactive Sorting & Accordion Rows
**Rationale:** Add the two core interactions (sorting and expansion) together because they share state management concerns. Sorting must not break accordion state, so implementing together ensures proper integration.

**Delivers:**
- TableSortControls Client Component (column headers with sort toggle via nuqs)
- Sort indicators (lucide-react ArrowUp/ArrowDown/ChevronsUpDown icons)
- SkillTableRow Client Component with Collapsible accordion
- Smooth expand/collapse animation (150-200ms ease-out)
- Multiple simultaneous row expansions
- Expansion state keyed by stable row ID (survives sorting)

**Addresses features:**
- Column header sort (table stakes)
- URL-persisted sort state (table stakes)
- Row expansion accordion (table stakes)
- Smooth animation (table stakes)
- Multiple expansions (best practice from FEATURES research)

**Avoids pitfalls:**
- #8 (Unstable references) - useMemo on data/columns from day one
- #11 (Sorting state conflicts) - use nuqs controlled pattern, not TanStack initialState
- #18 (Accordion state lost on sort) - key by stable ID, not index
- #9 (Event propagation) - stopPropagation on all interactive elements inside rows

**Research flag:** Moderate complexity. Patterns are well-documented (nuqs + Collapsible), but integration testing critical to catch propagation issues.

---

### Phase 3: Install Action & Accessibility Polish
**Rationale:** Install button depends on accordion being functional (displayed in expanded content). Accessibility testing should happen after all interactive elements are in place to verify complete keyboard/screen reader flows.

**Delivers:**
- InstallButton Client Component (clipboard copy via Server Action)
- getInstallContent Server Action (fetches skill content, tracks install intent)
- Toast notification for install feedback
- Full keyboard navigation (Tab, Enter, Space, Arrow keys)
- ARIA attributes (aria-sort, aria-expanded, aria-controls)
- Focus management (return to trigger on collapse)
- Screen reader announcements for state changes
- Mobile stacked card layout for <768px breakpoint

**Addresses features:**
- One-click install (table stakes)
- Keyboard navigation (table stakes - WCAG requirement)
- Visible focus states (table stakes - WCAG requirement)
- Mobile responsive (table stakes from FEATURES)
- Inline install feedback (differentiator)

**Avoids pitfalls:**
- #10 (Accordion a11y) - proper hidden attribute + aria-expanded
- #14 (Focus management) - focus returns to trigger button after collapse
- #16 (Mobile responsive) - stacked card layout tested on actual devices

**Research flag:** Low complexity for install action (standard Server Action pattern), but high priority for accessibility testing. Requires manual screen reader testing (VoiceOver/NVDA) and keyboard-only navigation verification.

---

### Phase 4: Leaderboard Enhancement (Optional Polish)
**Rationale:** Leaderboard improvements are independent of table work and can be done in parallel or deferred. Not blocking for core two-panel table experience.

**Delivers:**
- Time segment tabs (weekly/monthly/all-time)
- "Your position" highlight for logged-in user
- Movement indicators (rank changes from previous period)

**Addresses features:**
- Leaderboard segmented views (differentiator)
- User position highlight (differentiator)
- Movement indicators (differentiator)

**Research flag:** Standard patterns, can be deferred if timeline is tight.

---

### Phase Ordering Rationale

- **Foundation first (Phase 1):** Server Component architecture must be proven before adding Client interactivity. Changing this pattern later is expensive.
- **Sorting + accordion together (Phase 2):** State interactions between these features make sequential implementation risky. Better to handle conflicts once.
- **Accessibility last (Phase 3):** Can only test complete keyboard/screen reader flows after all interactive elements exist. Trying earlier leads to retesting.
- **Leaderboard optional (Phase 4):** Independent feature, doesn't block core value delivery.

**Dependency chain:** Phase 1 → Phase 2 → Phase 3 (linear). Phase 4 can happen anytime after Phase 1.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Sorting + Accordion integration):** State management interaction between sorting and expansion needs careful testing. Recommend prototype to verify nuqs + local state interaction.
- **Phase 3 (Mobile responsive):** Stacked card layout for mobile is well-documented pattern, but table-to-card transformation needs design iteration. May need UX research with actual mobile users.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Layout foundation):** Follows existing page.tsx + searchSkills patterns. CSS Grid for two-panel layout is standard.
- **Phase 3 (Server Action install):** Standard Next.js pattern already used elsewhere in codebase for form submissions.
- **Phase 4 (Leaderboard):** Simple data display with tabs, standard UI patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in use. No new dependencies needed. shadcn/ui, nuqs, Server Actions verified in existing codebase. |
| Features | HIGH | UX patterns based on W3C guidelines, Nielsen Norman Group research, and established data table best practices. Table stakes features well-documented across multiple sources. |
| Architecture | HIGH | Extends existing Next.js 15 patterns. Server/Client Component split matches current page.tsx structure. nuqs usage mirrors existing SearchInput/CategoryFilter implementations. |
| Pitfalls | HIGH | Table UI pitfalls verified via TanStack Table docs, Material React Table guides, GitHub issues with real-world problems. Accessibility patterns from W3C ARIA APG. |

**Overall confidence:** HIGH

### Gaps to Address

**Install UX limitation:** Web app cannot directly invoke MCP tools (they run in Claude Code/Desktop, not browser). Current approach is clipboard copy + instructions. This is functional but not true "one-click install." Consider future enhancement: browser extension or deeplink protocol to trigger MCP deploy_skill from web interface.

**Virtualization threshold unknown:** Research indicates 50-100 rows as the threshold where virtualization becomes beneficial, but this varies by device and content complexity. Recommendation: Implement without virtualization initially, add performance monitoring, and virtualize only if metrics show >500ms render time or user complaints about lag.

**Mobile card layout needs design iteration:** Research shows stacked cards are the standard mobile pattern for complex tables, but the specific layout (which fields visible, how accordion works on cards) needs design exploration with actual mobile users. Allocate time for mobile UX testing in Phase 3.

**Leaderboard gamification psychology:** Research references Yu-kai Chou's work on leaderboard design psychology (time segments prevent stagnation, relative ranking motivates). These patterns are well-documented but may need tuning based on actual user behavior after launch. Monitor for demotivation signals.

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - Official TanStack Table integration pattern
- [TanStack Table v8 Docs](https://tanstack.com/table/latest) - API reference, evaluated but decided against
- [nuqs Documentation](https://nuqs.dev/) - URL state management, already in use
- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Architecture patterns

**Features research:**
- [W3C WAI: Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/) - Accessibility fundamentals
- [W3C ARIA APG: Sortable Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/) - ARIA implementation
- [Nielsen Norman Group: Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/) - Multi-expansion behavior
- [Carbon Design System: Data Table Accessibility](https://carbondesignsystem.com/components/data-table/accessibility/) - Enterprise patterns

**Architecture research:**
- Existing codebase patterns in `/apps/web/components/` - SearchInput, CategoryFilter, SortDropdown using nuqs
- `/apps/web/app/(protected)/skills/page.tsx` - Server Component data fetching pattern
- `/lib/search-skills.ts` - Server-side query building with Drizzle

**Pitfalls research:**
- [Material React Table Memoization Guide](https://www.material-react-table.com/docs/guides/memoization) - useMemo requirements
- [React docs: Responding to Events](https://react.dev/learn/responding-to-events) - Event propagation
- [Aditus Accessible Accordion Patterns](https://www.aditus.io/patterns/accordion/) - Screen reader considerations
- [TanStack Table GitHub Issues](https://github.com/TanStack/table/issues) - Real-world problems (#4227 memo, #4289 undefined sorting, #5091 state conflicts)

### Secondary (MEDIUM confidence)

**Features research:**
- [Pencil & Paper: Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) - Enterprise table patterns
- [UX Movement: Stacked List Mobile Tables](https://uxmovement.medium.com/stacked-list-the-best-way-to-fit-tables-on-mobile-screens-79f7789e079b) - Mobile responsive patterns
- [Yu-kai Chou: Effective Leaderboards](https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/) - Gamification psychology

**Pitfalls research:**
- [Syncfusion: Render Large Datasets in React](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react) - Virtualization thresholds
- [freeCodeCamp: Keyboard Accessibility](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/) - Focus management patterns
- [Medium: Next.js Table Hybrid Approach](https://medium.com/@divyanshsharma0631/the-next-js-table-tango-mastering-dynamic-data-tables-with-server-side-performance-client-side-a71ee0ec2c63) - Server/Client split pattern

### Tertiary (LOW confidence)

**None** - All findings corroborated by multiple sources or verified against existing codebase patterns.

---

*Research completed: 2026-02-01*
*Ready for roadmap: yes*
