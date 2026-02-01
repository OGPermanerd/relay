# Pitfalls Research

**Domain:** Internal skill marketplace / developer tool catalog
**Researched:** 2026-01-31 (v1.0), 2026-02-01 (v1.2 Table UI)
**Confidence:** HIGH (multiple sources corroborate patterns)

## Critical Pitfalls

### Pitfall 1: The Catalog Staleness Death Spiral

**What goes wrong:**
Content becomes outdated within weeks of publication. Skills that worked with older Claude versions break. Prompts reference deprecated features. Users encounter broken skills, lose trust, and stop checking the catalog entirely. Once trust erodes, adoption collapses and never recovers.

**Why it happens:**
- Wiki-style versioning with no approval gates means anyone can publish, but no one is responsible for maintenance
- Original creators move on to other projects or leave the organization
- Skills are "fire and forget" - no ownership model after initial contribution
- No automated detection of broken or outdated content
- Backstage-style catalogs driven by static files require manual maintenance that developers deprioritize

**How to avoid:**
- Implement automated health checks: test skills against current Claude versions periodically
- Build "last verified working" timestamps into skill metadata
- Create deprecation workflows: auto-flag skills unused for 90 days
- Surface freshness signals prominently ("Last updated 6 months ago" warning)
- Consider "adopt-a-skill" programs for orphaned high-value content

**Warning signs:**
- User complaints about broken skills increasing month-over-month
- High bounce rates on skill detail pages (users look, then leave without using)
- Support tickets mentioning "skill doesn't work anymore"
- Growing gap between "most viewed" and "most used" skills

**Phase to address:**
Phase 1 (Foundation) - Build freshness/health tracking into core data model from day one. Cannot retrofit easily.

---

### Pitfall 2: Metrics Gaming and Inflated Value Claims

**What goes wrong:**
Users inflate "time saved" estimates to make their contributions look impressive or justify their team's investment. FTE Days Saved metric becomes meaningless noise. Leadership loses ability to measure actual ROI. Platform gets defunded or deprioritized because value claims become untrustworthy.

**Why it happens:**
- Goodhart's Law: "When a measure becomes a target, it ceases to be a good measure"
- Self-reported metrics are inherently gameable
- No verification mechanism for time-saved claims
- Incentive structures (recognition, performance reviews) reward high numbers
- Stack Overflow research shows users "cherry-pick" easy tasks to maximize reputation
- User estimates override creator estimates (per design) but introduces new gaming vector

**How to avoid:**
- Use multiple complementary metrics, not a single "north star"
- Track behavioral signals that are harder to game: repeat usage, cross-team adoption, organic sharing
- Implement peer validation: "Did this actually save you time?" confirmation prompts
- Compare estimates against actual task completion times where measurable
- Surface distribution anomalies: flag users whose estimates are 3x above median
- Focus on quality over quantity: sharing value > consumption metrics

**Warning signs:**
- Time-saved estimates showing unrealistic distributions (clustering at round numbers)
- Users claiming 8+ hours saved for simple prompts
- Disconnect between "FTE Days Saved" dashboard and actual productivity metrics
- Defensive reactions when audit processes are proposed

**Phase to address:**
Phase 2 (Metrics) - Design anti-gaming measures before launching public metrics. Add safeguard metrics alongside primary KPIs.

---

### Pitfall 3: MCP Lock-in Creates Invisible Usage

**What goes wrong:**
Skills used outside MCP are invisible to tracking. Users discover workarounds (copy-paste prompts, manual configurations) that bypass the platform. Usage metrics show declining engagement while actual skill reuse flourishes - untracked. Product decisions based on incomplete data lead to wrong priorities.

**Why it happens:**
- MCP adoption is not universal - many users still interact with Claude directly
- Friction in MCP workflow drives users to simpler alternatives
- Mobile users, quick tasks, external collaborators can't use MCP
- Users copy prompts from catalog to use elsewhere - legitimate reuse goes untracked
- Per project context: "skills used outside MCP are invisible"

**How to avoid:**
- Design for multi-channel usage from the start, not MCP-only
- Provide easy export/copy mechanisms that still capture usage intent
- Build browser extensions or Claude.ai integrations as first-class citizens
- Create "did you use this skill?" follow-up mechanisms for copied content
- Accept that some usage will be untracked - don't over-index on perfect measurement
- Consider watermarking/tagging prompts to enable attribution even when copied

**Warning signs:**
- Catalog page views >> MCP tracked usage (10:1 or worse ratio)
- Users reporting "I use that skill all the time" for skills showing zero MCP usage
- Declining MCP adoption rates despite growing team interest in AI tools
- Feature requests for "easier ways to use skills without MCP"

**Phase to address:**
Phase 1 (Foundation) - Design tracking architecture to accommodate non-MCP channels. Phase 3 (Scale) - Build integrations for popular non-MCP workflows.

---

### Pitfall 4: The Cold Start Content Desert

**What goes wrong:**
Marketplace launches with too few skills. Users check it once, find nothing relevant, and never return. Without users, contributors have no audience. Without content, users have no reason to visit. Classic chicken-and-egg collapse.

**Why it happens:**
- Underestimating content seeding requirements before launch
- Relying on "build it and they will come" organic contribution
- Not identifying and activating early champion contributors
- Broad categorization without depth in any single area
- TikTok research shows even well-funded companies struggle with adoption when catalogs feel sparse

**How to avoid:**
- Curate 50+ high-quality skills before any public announcement
- Identify 3-5 "atomic networks" (specific teams/use cases) and densely populate those first
- Recruit internal power users as founding contributors with explicit commitments
- Use seeding: convert existing team prompts, templates, and workflows into catalog entries
- Focus depth over breadth: better to have 30 great skills for one use case than 3 skills each for 10 use cases

**Warning signs:**
- Launch delayed repeatedly due to "not enough content yet"
- Early users reporting "couldn't find anything relevant to my work"
- High signup/visit rates but near-zero return visits
- Contributors waiting to see if "anyone else will add stuff first"

**Phase to address:**
Phase 0 (Pre-launch) - Seeding strategy must precede public launch. Build content corpus before building platform features.

---

### Pitfall 5: Quality Collapse Without Gates

**What goes wrong:**
Without approval gates, low-quality content floods the catalog. Users can't distinguish good skills from garbage. Discovery becomes a churn through noise. High-quality contributors stop contributing because their work gets buried. Platform becomes a dumping ground.

**Why it happens:**
- Wiki-style "anyone can add" philosophy prioritizes contribution volume over quality
- No expert review before publication
- Ratings systems take time to accumulate signal
- Metrics-driven quality (per design) requires scale to work - fails at launch
- Easy to publish half-baked ideas; hard to surface polished solutions

**How to avoid:**
- Implement lightweight quality gates: required fields, minimum documentation, working example
- Create "verified" or "featured" tiers for editorially-reviewed content
- Build reputation systems that weight contributions by contributor track record
- Enable community flagging for "doesn't work" or "misleading description"
- Surface quality signals prominently: success rate, error reports, time-since-last-issue
- Consider "probationary" period where new contributions have lower visibility until validated

**Warning signs:**
- User complaints about "lots of broken skills"
- High variance in quality within same category
- Expert contributors disengaging ("why bother, my stuff gets buried")
- Support requests asking "which skills actually work?"

**Phase to address:**
Phase 1 (Foundation) - Build quality signal infrastructure. Phase 2 (Metrics) - Implement tiered visibility based on quality indicators.

---

### Pitfall 6: Version Sprawl Without Cleanup

**What goes wrong:**
Wiki-style versioning creates version proliferation. 47 versions of "meeting summary prompt" exist, most nearly identical. Users can't determine which to use. Storage/maintenance costs balloon. Search results become unusable.

**Why it happens:**
- Per design: "anyone can add versions, no approval gates"
- No deprecation or archival mechanism
- Fork culture: easier to create new version than improve existing
- No consolidation workflows or duplicate detection
- Research shows forked code "requires that every bug is corrected in each copy"

**How to avoid:**
- Implement duplicate detection at creation time ("similar skills exist - consider contributing to those instead")
- Build version consolidation workflows: merge best parts of related versions
- Create archival triggers: versions with zero usage after 90 days get auto-archived
- Surface "canonical" versions prominently, push forks to secondary discovery
- Enable "this replaces/improves on [other skill]" relationships

**Warning signs:**
- Category pages showing 20+ similar-sounding skills
- User confusion about which version to use
- Storage costs growing faster than useful content
- Contributors complaining about "too much noise to find anything"

**Phase to address:**
Phase 2 (Metrics) - Build usage-based cleanup triggers. Phase 3 (Scale) - Implement consolidation and archival workflows.

---

## v1.2 Table UI Pitfalls

**Domain:** Sortable data table with row expansion (accordion) for skills display
**Researched:** 2026-02-01
**Scale Context:** 100-1000+ rows, sortable columns, accordion expansion, one-click actions

---

## Critical Table UI Pitfalls

Mistakes that cause rewrites or major performance issues.

### Pitfall 7: Rendering All Rows Without Virtualization

**What goes wrong:** Table renders all 1000+ rows to the DOM, causing multi-second initial load times, laggy scrolling, and high memory consumption.

**Why it happens:** Developers build for small datasets (10-50 rows) during development, then scale to production data. DOM manipulation is the most expensive browser operation, and each row adds overhead.

**Consequences:**
- Page load times of 10-50+ seconds for 1000+ rows
- Browser tab crashes on low-memory devices
- Laggy scrolling that makes the table unusable
- Mobile devices especially impacted

**Prevention:**
- Implement virtualization from day one if targeting 100+ rows
- Use `@tanstack/react-virtual` with TanStack Table or Material React Table's built-in virtualization
- Only render visible rows plus a small buffer (typically 10-20 rows)
- Test with production-scale data during development

**Detection (warning signs):**
- Scrolling feels "sticky" or delayed
- DevTools shows 500+ DOM nodes in table
- Memory usage climbs during scroll
- Initial render takes > 500ms

**Phase to address:** Initial table implementation phase. Retrofitting virtualization is significantly harder.

**Confidence:** HIGH (verified via [Syncfusion](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react), [DEV.to virtualization guide](https://dev.to/usman_awan_003/optimizing-react-performance-with-virtualization-a-developers-guide-3j14), [Material React Table docs](https://www.material-react-table.com/docs/examples/virtualized))

---

### Pitfall 8: Unstable Data/Column References Causing Infinite Re-renders

**What goes wrong:** Table enters an infinite loop of re-rendering because the `data` or `columns` prop gets a new reference on every render.

**Why it happens:** Developers pass inline array literals or objects to table props without memoization. JavaScript creates new references each render: `{} !== {}` is always true.

**Consequences:**
- Browser freezes or crashes
- Complete application hang
- Difficult to debug (looks like the table is "broken")

**Prevention:**
```typescript
// WRONG - creates new reference each render
<Table data={items.map(transformItem)} />

// CORRECT - stable reference with useMemo
const data = useMemo(() => items.map(transformItem), [items]);
<Table data={data} />
```

- Always wrap `data` in `useMemo` with appropriate dependencies
- Wrap `columns` definition in `useMemo` (empty deps if static)
- This is the single most important memoization in table components

**Detection:**
- React DevTools shows component rendering thousands of times per second
- Browser becomes unresponsive immediately on table mount
- CPU spikes to 100% on table pages

**Phase to address:** Initial table implementation. This is foundational.

**Confidence:** HIGH (verified via [Material React Table memoization guide](https://www.material-react-table.com/docs/guides/memoization), [TanStack Table issue #4227](https://github.com/TanStack/table/issues/4227))

---

### Pitfall 9: Event Propagation Breaking Row Actions

**What goes wrong:** Clicking an action button (like "Install") triggers both the button's onClick AND the row's onClick (accordion toggle), causing unintended expansion/collapse alongside the action.

**Why it happens:** Event bubbling is default browser behavior. Events propagate from child to parent unless explicitly stopped.

**Consequences:**
- User clicks "Install", accordion expands unexpectedly
- Double-actions (button fires, row fires)
- Confusing UX where actions have side effects
- Checkbox selections toggle row expansion

**Prevention:**
```typescript
// Action button must stop propagation
<button
  onClick={(e) => {
    e.stopPropagation();
    handleInstall(skill.id);
  }}
>
  Install
</button>
```

- All interactive elements inside rows MUST call `e.stopPropagation()`
- Create a wrapper component for row actions that handles this automatically
- Test every clickable element with row click handler active

**Detection:**
- Clicking buttons causes unexpected row behavior
- Accordion opens/closes when it shouldn't
- Multiple console logs for single click

**Phase to address:** Row action implementation phase.

**Confidence:** HIGH (verified via [React docs on events](https://react.dev/learn/responding-to-events), [TanStack Table discussion #2243](https://github.com/TanStack/table/discussions/2243), [Adobe React Spectrum issue #1165](https://github.com/adobe/react-spectrum/issues/1165))

---

### Pitfall 10: Accordion Content Accessible When Collapsed (Accessibility)

**What goes wrong:** Screen reader users can still navigate into collapsed accordion content, encountering "hidden" content that sighted users cannot see.

**Why it happens:** CSS-only hiding (display: none or height: 0) may not remove content from the accessibility tree. Some techniques only visually hide content.

**Consequences:**
- Screen reader users have confusing, inconsistent experience
- Tab navigation enters invisible content
- WCAG compliance failure
- Legal exposure for accessibility requirements

**Prevention:**
- Use the `hidden` attribute on collapsed panels (not just CSS)
- Ensure `aria-expanded="false"` on trigger button
- Use `aria-controls` to associate trigger with panel
- Test with actual screen reader (VoiceOver, NVDA)

```typescript
// Proper accordion structure
<button
  aria-expanded={isOpen}
  aria-controls={`panel-${id}`}
>
  Toggle
</button>
<div
  id={`panel-${id}`}
  hidden={!isOpen}
>
  {content}
</div>
```

**Detection:**
- Tab key reaches elements inside collapsed rows
- Screen reader announces "hidden" content
- axe DevTools reports ARIA violations

**Phase to address:** Accordion implementation phase. Retrofit is possible but test early.

**Confidence:** HIGH (verified via [Aditus accordion patterns](https://www.aditus.io/patterns/accordion/), [react-accessible-accordion](https://github.com/springload/react-accessible-accordion), [DEV.to accessible accordion guide](https://dev.to/eevajonnapanula/expand-the-content-inclusively-building-an-accessible-accordion-with-react-2ded))

---

## Moderate Table UI Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 11: Sorting State Conflicts (initialState vs state)

**What goes wrong:** Table sorting doesn't work as expected, or initial sort is ignored, because both `initialState.sorting` and `state.sorting` are specified.

**Why it happens:** Confusion about controlled vs uncontrolled patterns in TanStack Table. Using both creates a conflict where `state` overrides `initialState`.

**Prevention:**
- Use `initialState.sorting` for "set once and forget" scenarios
- Use `state.sorting` + `onSortingChange` for controlled sorting
- NEVER use both together

```typescript
// Uncontrolled (simpler)
useReactTable({
  initialState: { sorting: [{ id: 'name', desc: false }] }
})

// Controlled (when you need to read/modify sort state)
const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
useReactTable({
  state: { sorting },
  onSortingChange: setSorting
})
```

**Detection:**
- Initial sort doesn't apply
- Sort state resets unexpectedly
- Console warnings about conflicting state

**Phase to address:** Sorting implementation phase.

**Confidence:** HIGH (verified via [TanStack Table state guide](https://tanstack.com/table/v8/docs/framework/react/guide/table-state), [TanStack discussion #5091](https://github.com/TanStack/table/discussions/5091))

---

### Pitfall 12: Three-State Sort Toggle Breaking with Undefined Values

**What goes wrong:** Sort toggle doesn't cycle properly through ascending -> descending -> none when column data contains `undefined` or `null` values.

**Why it happens:** TanStack Table's sort toggle logic can behave unexpectedly when first rows have undefined values. The state machine gets confused.

**Consequences:**
- Sort stuck in one direction
- "Clear sort" state never reached
- Unpredictable UX

**Prevention:**
- Use `sortUndefined: 'last'` option to push nulls to end
- Ensure data transformation handles nulls before reaching table
- Test sort toggle with missing data scenarios

```typescript
columns: [
  {
    accessorKey: 'downloads',
    sortUndefined: 'last', // or 'first'
  }
]
```

**Detection:**
- Clicking sort header multiple times doesn't clear sort
- Sort indicator shows unexpected state
- Columns with sparse data behave differently

**Phase to address:** Sorting implementation, but test with realistic data.

**Confidence:** MEDIUM (verified via [TanStack Table issue #4289](https://github.com/TanStack/table/issues/4289), [TanStack discussion #2371](https://github.com/tannerlinsley/react-table/discussions/2371))

---

### Pitfall 13: Client-Only Table in Next.js App Router

**What goes wrong:** Entire page becomes a client component because table needs interactivity, losing SSR benefits and increasing bundle size.

**Why it happens:** Adding `"use client"` at page level instead of only on interactive components. Tables need sorting/filtering state, so developers assume the whole thing must be client-side.

**Consequences:**
- Slower initial page load
- Larger JavaScript bundle
- Lost SEO benefits
- Full page flickers on navigation

**Prevention:**
- Keep page as Server Component
- Only mark the table component itself as `"use client"`
- Fetch data in Server Component, pass as props to client table
- Consider hybrid: server-side initial data, client-side interactions

```typescript
// page.tsx (Server Component)
async function SkillsPage() {
  const skills = await fetchSkills(); // Server-side fetch
  return <SkillsTable initialData={skills} />; // Client component
}

// SkillsTable.tsx
"use client";
export function SkillsTable({ initialData }) {
  // Interactive table logic here
}
```

**Detection:**
- Large JavaScript bundle for table pages
- Slow Time to First Byte
- No content visible until JS loads

**Phase to address:** Initial architecture/setup phase.

**Confidence:** HIGH (verified via [Next.js Server/Client docs](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Medium hybrid approach guide](https://medium.com/@divyanshsharma0631/the-next-js-table-tango-mastering-dynamic-data-tables-with-server-side-performance-client-side-a71ee0ec2c63))

---

### Pitfall 14: Focus Management Lost on Expand/Collapse

**What goes wrong:** After expanding/collapsing a row, keyboard focus disappears or jumps to unexpected location. Users lose their place.

**Why it happens:** React re-renders remove elements from DOM, and focus was on those elements. New elements mount without focus restoration.

**Consequences:**
- Keyboard users lose their place
- Screen reader users disoriented
- Fails WCAG focus management requirements

**Prevention:**
- Return focus to the trigger button after collapse
- Use `useRef` to track and restore focus
- Test keyboard-only navigation flow

```typescript
const triggerRef = useRef<HTMLButtonElement>(null);

const handleToggle = () => {
  setExpanded(!expanded);
  // Focus returns to trigger after state settles
  setTimeout(() => triggerRef.current?.focus(), 0);
};
```

**Detection:**
- After toggle, pressing Tab goes somewhere unexpected
- No visible focus indicator after interaction
- Manual keyboard testing reveals lost focus

**Phase to address:** Accordion implementation phase.

**Confidence:** MEDIUM (verified via [freeCodeCamp keyboard accessibility](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/), [Material React Table accessibility guide](https://www.material-react-table.com/docs/guides/accessibility))

---

### Pitfall 15: Row Memoization Breaking with Virtualization

**What goes wrong:** Virtualized rows re-render unnecessarily on every scroll, causing performance to be worse than without virtualization.

**Why it happens:** Row components aren't memoized, so each scroll event (which changes the visible range) triggers full re-render of all visible rows.

**Prevention:**
- Wrap row components in `React.memo`
- Ensure row props have stable references
- Use `useCallback` for row-level event handlers

```typescript
const Row = memo(function Row({ row, onAction }) {
  // Row content
});

// Parent
const handleAction = useCallback((id) => {
  // action logic
}, [/* stable deps */]);
```

**Detection:**
- React DevTools Profiler shows all rows re-rendering on scroll
- Virtualized table feels laggy
- Performance worse than expected for virtualization

**Phase to address:** Virtualization implementation phase.

**Confidence:** HIGH (verified via [TanStack Virtual discussion #535](https://github.com/TanStack/virtual/discussions/535), [Material React Table memoization](https://www.material-react-table.com/docs/guides/memoization))

---

## Minor Table UI Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 16: Missing Mobile Responsive Strategy

**What goes wrong:** Table looks fine on desktop but is unusable on mobile - horizontal scroll required, text truncated unreadably, touch targets too small.

**Why it happens:** Desktop-first development. Tables are inherently wide, and responsive behavior isn't automatic.

**Prevention:**
- Decide on mobile strategy early: horizontal scroll, column stacking, or responsive collapse
- Use priority columns (show most important on mobile)
- Consider card-based layout for mobile instead of table
- Ensure touch targets are at least 44x44px

**Detection:**
- Table extends beyond viewport on mobile
- Users must scroll horizontally to see actions
- Touch targets overlap or are too small

**Phase to address:** Design phase and initial implementation.

**Confidence:** MEDIUM (multiple sources: [react-super-responsive-table](https://github.com/coston/react-super-responsive-table), [TanStack discussion #3259](https://github.com/TanStack/table/discussions/3259))

---

### Pitfall 17: Missing Sort Direction Indicators

**What goes wrong:** Users click column headers but can't tell current sort state - which column is sorted, in which direction.

**Why it happens:** Focusing on functionality over feedback. Sort logic works, but visual feedback omitted.

**Prevention:**
- Always show sort indicators (arrows/icons) on sortable columns
- Indicate current sort column and direction clearly
- Consider three states: unsorted, ascending, descending
- Use `aria-sort` attribute for accessibility

```typescript
<th aria-sort={column.getIsSorted() || 'none'}>
  {column.header}
  {column.getIsSorted() === 'asc' && <ArrowUp />}
  {column.getIsSorted() === 'desc' && <ArrowDown />}
</th>
```

**Detection:**
- Users repeatedly click headers unsure if sort applied
- No visual difference between sorted/unsorted columns
- Accessibility audit flags missing `aria-sort`

**Phase to address:** Sorting UI implementation.

**Confidence:** HIGH (standard UX pattern, verified via [Smashing Magazine sortable tables](https://www.smashingmagazine.com/2020/03/sortable-tables-react/))

---

### Pitfall 18: Accordion State Not Preserved on Sort/Filter

**What goes wrong:** User expands a row to see details, then sorts the table - the expansion state is lost and they have to find and re-expand the row.

**Why it happens:** Expansion state keyed by row index instead of row ID. Sorting changes indices, so state association breaks.

**Prevention:**
- Key expansion state by stable row ID (not array index)
- Use `getRowId` option in TanStack Table
- Consider: should sorting preserve expansion? (UX decision)

```typescript
// Use stable ID for expansion tracking
const [expanded, setExpanded] = useState<Record<string, boolean>>({});

// Not this:
const [expandedIndices, setExpandedIndices] = useState<number[]>([]);
```

**Detection:**
- Expand row, sort column, row collapses
- Expand row, filter changes, wrong row now expanded
- State seems to "jump" between rows

**Phase to address:** Accordion + sorting integration phase.

**Confidence:** MEDIUM (common pattern issue, follows from React key principles)

---

## Table UI Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Initial table setup | Unstable data reference (#8) | Memoize data/columns from day one |
| Sorting implementation | State conflicts (#11), undefined values (#12) | Pick controlled vs uncontrolled, test with sparse data |
| Accordion rows | Accessibility (#10), focus management (#14) | Use proper ARIA, test with screen reader |
| Row actions | Event propagation (#9) | stopPropagation on all action elements |
| Performance at scale | No virtualization (#7), no row memo (#15) | Virtualize if 100+ rows, memo row components |
| Mobile | No responsive strategy (#16) | Design mobile approach before building |
| Next.js architecture | Full client page (#13) | Keep page as Server Component |

---

## Table UI Testing Recommendations

Before shipping the table:

1. **Performance test** - Load 1000 rows, measure initial render time (target: < 500ms)
2. **Scroll test** - Scroll through 1000 rows, check for lag
3. **Keyboard test** - Navigate entire table using only keyboard
4. **Screen reader test** - Use VoiceOver or NVDA to navigate table and accordions
5. **Mobile test** - Check on actual mobile device, not just DevTools
6. **Action test** - Click every button/link in rows, verify no unintended side effects
7. **Sort test** - Sort each column both directions and back to none
8. **Memory test** - Monitor browser memory while scrolling (should stay stable)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip MCP tracking for MVP | Faster launch | Permanent blind spot on non-MCP usage; retrofit is expensive | Never - design multi-channel from start |
| Store time-saved as single number | Simple data model | Can't audit, can't compare, can't detect gaming | MVP only - add context fields in Phase 2 |
| No skill health checks | Less infrastructure | Broken skills erode trust; manual cleanup doesn't scale | First 6 months only |
| Flat skill organization | Easy to implement | Discovery fails at 100+ skills; restructuring breaks links | First 50 skills only |
| Creator-only edit permissions | Simpler permissions | Orphaned skills can't be maintained; wiki model breaks | Never - design for maintenance handoff |
| Skip virtualization | Faster initial dev | Performance nightmare at scale; hard to retrofit | Only if < 100 rows guaranteed |
| Skip memoization | Less boilerplate | Infinite re-render risk; debugging nightmare | Never for data/columns props |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Hardcoding model versions in skills | Use version-agnostic skill format; test against latest models |
| MCP Servers | Storing API keys in skill definitions | Centralized credential management; skill references secrets by ID |
| SSO/Identity | Treating user identity as stable string | Design for identity merges, name changes, email updates |
| Metrics/Analytics | Assuming synchronous tracking is sufficient | Build event queue; handle offline/delayed attribution |
| Search/Discovery | Relying on basic text search | Plan for semantic search from start; keyword matching fails at scale |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full skill catalog on search | Search latency grows linearly | Implement pagination, faceted search, lazy loading | 500+ skills |
| Synchronous metrics writes | Skill execution slowed by tracking | Async event queue with eventual consistency | 100+ concurrent users |
| Single-node search index | Search becomes bottleneck | Design for distributed search from architecture phase | 1000+ skills |
| Storing all versions inline | Page load times balloon | Version storage with lazy retrieval; show active only | 50+ versions per skill |
| No caching on popular skills | Same skills fetched repeatedly | Implement tiered caching with TTL-based invalidation | 1000+ daily active users |
| No table virtualization | Page load > 5 seconds | Virtualize if targeting 100+ rows | 100+ rows |
| Unmemoized table data | CPU spikes, infinite loops | Always useMemo data and columns | Any interactive table |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Skills that capture user input in logs | PII exposure in analytics | Sanitize/redact user inputs before any persistence |
| Storing API keys in skill configurations | Credential theft if skill is exported/shared | Reference secrets by ID; never inline credentials |
| No rate limiting on skill execution | DoS via automated skill invocation; cost explosion | Per-user, per-skill rate limits |
| Trusting skill-provided "time saved" for billing | Gaming to inflate usage-based charges | Independent verification for any financial metrics |
| Skills that can modify other skills | Privilege escalation via malicious skill update | Strict permission boundaries; skills can't write to catalog |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring MCP setup before browsing | New users bounce immediately | Allow browsing/discovery without authentication |
| Complex contribution workflow | Only power users contribute | One-click "add prompt" for simple cases; progressive complexity |
| No preview before execution | Users afraid to try skills | Show example inputs/outputs; "try with sample data" option |
| Overwhelming search results | Users give up finding relevant skill | Default to quality-weighted ranking; progressive disclosure of results |
| No feedback after skill use | Users can't report problems | Inline "did this work?" with one-click issue reporting |
| Hidden version history | Users can't understand skill evolution | Visible changelog; diff between versions |
| No sort direction indicators | Users confused about table state | Clear visual feedback for sort state |
| Buttons that also toggle rows | Unexpected accordion behavior | stopPropagation on all action buttons |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Skill search:** Often missing semantic understanding - verify it finds "meeting notes" when user searches "standup summary"
- [ ] **Usage tracking:** Often missing offline/copied usage - verify tracking plan covers non-MCP scenarios
- [ ] **Quality ratings:** Often missing fraud detection - verify you can detect coordinated rating manipulation
- [ ] **Version control:** Often missing rollback mechanism - verify users can revert to previous version
- [ ] **Metrics dashboard:** Often missing confidence intervals - verify you show uncertainty, not false precision
- [ ] **Skill categories:** Often missing multi-categorization - verify skills can appear in multiple relevant categories
- [ ] **Contributor profiles:** Often missing maintenance burden view - verify contributors can see "your skills needing attention"
- [ ] **Admin tools:** Often missing bulk operations - verify admins can deprecate/archive at scale
- [ ] **Sortable table:** Often missing aria-sort - verify screen readers announce sort state
- [ ] **Accordion rows:** Often missing hidden attribute - verify collapsed content is not in a11y tree
- [ ] **Table virtualization:** Often missing row memoization - verify rows don't re-render on scroll
- [ ] **Mobile table:** Often missing responsive strategy - verify table works on actual mobile device

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Catalog staleness | MEDIUM | 1) Mass deprecation announcement 2) Automated health scan 3) Community "fix-a-thon" event 4) Rebuild trust through "verified working" badge |
| Metrics gaming | HIGH | 1) Acknowledge issue publicly 2) Retroactively flag suspicious data 3) Introduce verification 4) Reset baseline expectations |
| MCP lock-in blindspot | HIGH | 1) Add alternative tracking channels 2) Survey for untracked usage 3) Adjust historical metrics with estimates 4) Communicate limitations |
| Cold start failure | MEDIUM | 1) Pause public marketing 2) Intensive seeding sprint 3) Recruit power users directly 4) Relaunch to specific communities first |
| Quality collapse | MEDIUM | 1) Introduce curation layer 2) Archive low-quality content 3) Feature high-quality examples 4) Communicate quality standards |
| Version sprawl | LOW | 1) Implement archival automation 2) Surface canonical versions 3) Merge duplicates manually 4) Prevent future sprawl with duplicate detection |
| Table performance issues | MEDIUM | 1) Add virtualization 2) Memoize data/columns 3) Profile with React DevTools 4) Test at scale before launch |
| Infinite re-render loop | LOW | 1) Add useMemo to data/columns 2) Check dependency arrays 3) Use React DevTools Profiler |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Catalog staleness | Phase 1 - Build freshness tracking into core model | Skills have last_verified, health_status fields; automated checks running |
| Metrics gaming | Phase 2 - Design safeguard metrics before public dashboard | Multiple metrics tracked; anomaly detection in place |
| MCP lock-in | Phase 1 - Multi-channel tracking architecture | Non-MCP usage has attribution path; not 100% but not 0% |
| Cold start | Phase 0 - Seeding before launch | 50+ skills live before public announcement |
| Quality collapse | Phase 1/2 - Quality signals in foundation; tiered visibility in metrics | Quality score computed; featured vs. standard tiers exist |
| Version sprawl | Phase 2/3 - Usage tracking enables cleanup; archival workflows at scale | Auto-archive triggers active; duplicate detection at creation |
| No virtualization | v1.2 Phase 1 - Implement with initial table | 1000 rows render in < 500ms |
| Unstable references | v1.2 Phase 1 - Memoize from day one | No infinite re-render loops in testing |
| Event propagation | v1.2 Phase 2 - When adding row actions | Clicking buttons doesn't toggle accordion |
| Accordion a11y | v1.2 Phase 1 - During accordion implementation | Screen reader test passes |

## Sources

### v1.0/v1.1 Research Sources
- [The New Stack: 7 Reasons Internal Developer Platforms Fail](https://thenewstack.io/7-reasons-internal-developer-platforms-fail-so-yours-wont/)
- [Platform Engineering: Why Companies Fail at IDPs](https://platformengineering.org/blog/why-companies-fail-at-internal-developer-platforms)
- [Springer: Gaming Expertise Metrics on Knowledge Platforms](https://link.springer.com/article/10.1007/s12108-023-09607-x)
- [Backstage Backlash: Why Developer Portals Struggle](https://medium.com/@samadhi-anuththara/backstage-backlash-why-developer-portals-struggle-cb82d4f082e1)
- [Port.io: Technical Disadvantages of Backstage](https://www.port.io/blog/what-are-the-technical-disadvantages-of-backstage)
- [TikTok Component Library Adoption Challenges](https://autonomyai.io/business/the-adoption-gap-why-component-libraries-fail-without-automation/)
- [CData: MCP Limitations Explained](https://www.cdata.com/blog/navigating-the-hurdles-mcp-limitations)
- [Merge: 6 Challenges of Using MCP](https://www.merge.dev/blog/mcp-challenges)
- [Andrew Chen: How to Solve the Cold Start Problem](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/)
- [Jellyfish: Goodhart's Law in Software Engineering](https://jellyfish.co/blog/goodharts-law-in-software-engineering-and-how-to-avoid-gaming-your-metrics/)
- [NN/G: Campbell's Law - The Dark Side of Metric Fixation](https://www.nngroup.com/articles/campbells-law/)
- [Enterprise Knowledge: Findability vs Discoverability](https://enterprise-knowledge.com/findability-v-discoverability/)
- [Vanderbilt: Why Software Reuse Has Failed](https://www.dre.vanderbilt.edu/~schmidt/reuse-lessons.html)
- [ACM: Software Reuse Strategies and Component Markets](https://cacm.acm.org/research/software-reuse-strategies-and-component-markets/)

### v1.2 Table UI Sources (High Confidence)
- [TanStack Table State Guide](https://tanstack.com/table/v8/docs/framework/react/guide/table-state)
- [TanStack Table Sorting Guide](https://tanstack.com/table/v8/docs/guide/sorting)
- [TanStack Table Expanding Guide](https://tanstack.com/table/v8/docs/guide/expanding)
- [Material React Table Memoization Guide](https://www.material-react-table.com/docs/guides/memoization)
- [Material React Table Accessibility Guide](https://www.material-react-table.com/docs/guides/accessibility)
- [React docs: Responding to Events](https://react.dev/learn/responding-to-events)
- [React docs: useMemo](https://react.dev/reference/react/useMemo)
- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Aditus Accessible Accordion Patterns](https://www.aditus.io/patterns/accordion/)

### v1.2 Table UI Sources (Medium Confidence)
- [Syncfusion: Render Large Datasets in React](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react)
- [DEV.to: Virtualization Guide](https://dev.to/usman_awan_003/optimizing-react-performance-with-virtualization-a-developers-guide-3j14)
- [freeCodeCamp: Keyboard Accessibility](https://www.freecodecamp.org/news/designing-keyboard-accessibility-for-complex-react-experiences/)
- [Smashing Magazine: Sortable Tables React](https://www.smashingmagazine.com/2020/03/sortable-tables-react/)
- [Medium: Next.js Table Hybrid Approach](https://medium.com/@divyanshsharma0631/the-next-js-table-tango-mastering-dynamic-data-tables-with-server-side-performance-client-side-a71ee0ec2c63)

### GitHub Issues/Discussions (Real-world problems)
- [TanStack Table #4227: Memo optimization](https://github.com/TanStack/table/issues/4227)
- [TanStack Table #4289: Undefined sorting behavior](https://github.com/TanStack/table/issues/4289)
- [TanStack Table #5091: Default sort state](https://github.com/TanStack/table/discussions/5091)
- [TanStack Table #2243: Checkbox row click](https://github.com/TanStack/table/discussions/2243)
- [TanStack Virtual #535: Row memoization](https://github.com/TanStack/virtual/discussions/535)
- [Adobe React Spectrum #1165: Button in row triggers row click](https://github.com/adobe/react-spectrum/issues/1165)
- [react-accessible-accordion](https://github.com/springload/react-accessible-accordion)

---
*Pitfalls research for: Internal skill marketplace / developer tool catalog*
*v1.0/v1.1 researched: 2026-01-31*
*v1.2 Table UI researched: 2026-02-01*
