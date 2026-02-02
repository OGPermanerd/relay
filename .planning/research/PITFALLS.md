# Pitfalls Research

**Domain:** Internal skill marketplace / developer tool catalog
**Researched:** 2026-01-31 (v1.0), 2026-02-01 (v1.2 Table UI), 2026-02-02 (v1.3 AI Features)
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

## v1.3 AI Features Pitfalls

**Domain:** AI-driven skill review, semantic similarity detection, fork-based versioning, cross-platform install
**Researched:** 2026-02-02
**Scale Context:** Adding AI capabilities to existing 5,592 LOC skill marketplace

---

## Critical AI Review Pitfalls

Mistakes that cause rewrites, security issues, or major trust erosion.

### Pitfall 19: AI Review Hallucinated Suggestions

**What goes wrong:**
Claude generates plausible-sounding but incorrect improvement suggestions for skills. Suggestions may reference non-existent APIs, fabricate best practices, or recommend patterns that don't apply to the skill's context. Users implement bad advice, degrading skill quality over time.

**Why it happens:**
LLMs operate on statistical probability, not truth. Claude's confidence is infectious — when it generates coherent-looking suggestions, reviewers and users move into acceptance mode. The AI doesn't doubt itself, and neither do users who trust the "official" review.

**How to avoid:**
- Frame AI review as "advisory only" in all UI messaging
- Display confidence signals (if available) alongside suggestions
- Require human author acknowledgment before suggestions appear publicly
- Log all AI suggestions and track which ones users implement vs. ignore (feedback signal)
- Consider a "flag as unhelpful" button for community correction

**Warning signs:**
- Users implement AI suggestions that break their skills
- Complaints about "bad advice" in reviews
- Suggestions that reference non-existent libraries or patterns
- Generic suggestions that don't relate to the specific skill content

**Phase to address:**
AI Review phase — build in advisory framing and human acknowledgment from the start

**Confidence:** HIGH (verified via [ISACA AI Pitfalls 2026](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents), [MIT Technology Review AI Coding](https://www.technologyreview.com/2025/12/15/1128352/rise-of-ai-coding-developers-2026/))

---

### Pitfall 20: Prompt Injection via Skill Content

**What goes wrong:**
Malicious skill authors embed hidden instructions in skill content (comments, markdown, invisible characters) that manipulate Claude's review behavior. Attacker skills could receive artificially positive reviews, steal data from review context, or cause Claude to generate harmful content in reviews.

**Why it happens:**
Skill content is untrusted user input that gets included in Claude's context during review. Without sanitization, this creates a classic prompt injection attack surface. The skill content IS the prompt — attackers can craft content that acts as an instruction override.

**How to avoid:**
- Sanitize skill content before including in review prompt (strip suspicious patterns)
- Use structured prompts that clearly delineate "skill content" from "instructions"
- Implement output validation — check if review response contains suspicious patterns
- Rate limit review generation per author to limit attack experimentation
- Consider content-length limits to reduce injection surface area
- Log review inputs/outputs for security audit

**Warning signs:**
- Reviews that seem oddly positive or contain irrelevant content
- Reviews that reference things not in the skill
- Skills with unusual character sequences or hidden content
- Authors repeatedly publishing and withdrawing skills (probing behavior)

**Phase to address:**
AI Review phase — implement input sanitization and output validation before production

**Confidence:** HIGH (verified via [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices), [MCP Security Vulnerabilities - Practical DevSecOps](https://www.practical-devsecops.com/mcp-security-vulnerabilities/), [Prompt Injection Research - MDPI](https://www.mdpi.com/2078-2489/17/1/54))

---

### Pitfall 21: AI Review Cost Explosion

**What goes wrong:**
API costs grow unexpectedly as skill submissions increase. Each review requires processing full skill content plus context, and output tokens cost 3-5x input tokens. A viral day of skill submissions could generate thousands of dollars in API costs. Budget exhaustion causes service degradation or outage.

**Why it happens:**
Teams underestimate token usage because they calculate based on average cases. Long skills, skills with embedded examples, and skills that trigger verbose Claude responses multiply costs. Additionally, retry logic on failures can double or triple token usage.

**How to avoid:**
- Set hard budget caps with alerts at 50%, 75%, 90%
- Implement circuit breakers that degrade to queued processing when rate limits approach
- Use prompt compression (remove redundant context, summarize examples)
- Cache reviews for unchanged skill content (content hash as cache key)
- Consider tiered review depth: quick validation vs. full review
- Leverage prompt caching — cached tokens don't count toward ITPM limits (5x effective throughput)
- Track costs per skill author for abuse detection

**Warning signs:**
- API costs growing faster than skill submission growth
- Frequent 429 rate limit errors
- Review latency increasing (sign of approaching limits)
- Single authors generating disproportionate costs

**Phase to address:**
AI Review phase — implement cost monitoring and circuit breakers before launch

**Confidence:** HIGH (verified via [Claude API Rate Limits](https://docs.claude.com/en/api/rate-limits), [LLM Cost Optimization - Kosmoy](https://www.kosmoy.com/post/llm-cost-management-stop-burning-money-on-tokens))

---

### Pitfall 22: Claude API Rate Limits Cascade to UX Failures

**What goes wrong:**
AI review triggers during peak skill submission, hitting Claude API rate limits. 429 errors cascade — reviews fail, users see errors, retries amplify the problem. Exponential backoff causes multi-minute delays. The feature appears broken during high-traffic periods.

**Why it happens:**
Claude rate limits apply across entire organization, not per API key. Multiple features hitting the API (review, suggestions, etc.) share the same quota. Teams don't anticipate concurrent demand. The token bucket algorithm penalizes burst traffic.

**How to avoid:**
- Implement request queuing with controlled concurrency
- Use exponential backoff with jitter (not fixed delays)
- Respect `retry-after` header from 429 responses
- Implement circuit breaker: degrade to "review pending" state under load
- Monitor rate limit headroom in real-time
- Consider separate API tier/account for review vs. other features
- Leverage prompt caching to reduce effective token consumption

**Warning signs:**
- 429 errors appearing in logs
- Review latency spikes during peak hours
- Users complaining about review timeouts
- Multiple retries visible in request logs

**Phase to address:**
AI Review phase — implement rate limit handling and graceful degradation

**Confidence:** HIGH (verified via [Claude API Rate Limits](https://docs.claude.com/en/api/rate-limits), [Claude API Latency - SigNoz](https://signoz.io/guides/claude-api-latency/))

---

## Critical Duplicate Detection Pitfalls

### Pitfall 23: Semantic Similarity False Positives Damage Trust

**What goes wrong:**
Duplicate detection flags legitimate skills as duplicates, discouraging contributors. Skills that share common phrases (e.g., "You are a helpful assistant") trigger similarity above threshold despite being functionally different. Users lose trust in the detection system and ignore all warnings.

**Why it happens:**
Embedding models capture semantic similarity, not functional equivalence. Two skills for completely different purposes can have high similarity if they share boilerplate structure. Generic prompt patterns inflate similarity scores. Threshold tuning is extremely context-dependent.

**How to avoid:**
- Make duplicate detection advisory only (never block submission)
- Show similarity score and let author decide relevance
- Use hybrid approach: semantic similarity + structural/metadata comparison
- Exclude common boilerplate from similarity calculation
- Start with very high threshold (low sensitivity), tune based on feedback
- Track false positive rate via user dismissals

**Warning signs:**
- High dismissal rate of similarity warnings (>50%)
- User complaints about "false duplicate" alerts
- Contributors abandoning submissions after similarity warnings
- Skills with high similarity scores but obviously different purposes

**Phase to address:**
Duplicate Detection phase — start advisory-only and tune threshold empirically

**Confidence:** HIGH (verified via [Semantic Deduplication - NVIDIA NeMo](https://docs.nvidia.com/nemo-framework/user-guide/24.09/datacuration/semdedup.html), [LLM Monitoring Strategies - Galileo](https://galileo.ai/blog/production-llm-monitoring-strategies))

---

### Pitfall 24: Embedding Model Change Breaks Duplicate Detection

**What goes wrong:**
You switch embedding models (for better performance, lower cost, or because vendor deprecated the old model) and all existing embeddings become incompatible. Similarity comparisons produce garbage results. Full re-embedding is required, which is expensive and time-consuming at scale.

**Why it happens:**
Different embedding models produce vectors in incompatible spaces — even models from the same vendor. A 768-dim embedding from model A cannot be meaningfully compared to a 768-dim embedding from model B. This is more like a database migration than a library upgrade.

**How to avoid:**
- Store embedding model version alongside each embedding
- Plan for re-embedding from day one (store original text, not just embeddings)
- Design schema to support dual indexes during migration
- Choose embedding model carefully upfront (prioritize stability over marginal gains)
- Budget for periodic re-embedding in operational costs
- Use lazy re-embedding strategy: embed new queries with new model, gradually re-embed corpus

**Warning signs:**
- Embedding vendor announces model deprecation
- Similarity scores suddenly shift (either way) without content changes
- New skills never match as duplicates (embedding space drift)
- Comparison latency changes unexpectedly (dimension mismatch)

**Phase to address:**
Duplicate Detection phase — include model versioning in schema design

**Confidence:** HIGH (verified via [Embedding Model Upgrades - Medium](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233), [When Good Models Go Bad - Weaviate](https://weaviate.io/blog/when-good-models-go-bad))

---

### Pitfall 25: Embedding Computation at Query Time Creates Latency

**What goes wrong:**
Every skill submission triggers real-time embedding computation plus similarity search across all existing skills. As the catalog grows, submission latency increases linearly. Users experience multi-second delays on publish, leading to abandonment.

**Why it happens:**
Teams build embedding on-demand for simplicity. Works fine with 50 skills. At 500 skills, the similarity search alone takes seconds. At 5000 skills without proper indexing, it becomes unacceptable.

**How to avoid:**
- Pre-compute embeddings on skill save, not on comparison
- Use vector index (HNSW, IVF) for approximate nearest neighbor search
- Cache embedding API calls (same content = same embedding)
- Set timeout on similarity check; degrade to "check pending" if exceeded
- Use async/background processing for duplicate detection

**Warning signs:**
- Skill publish time increases as catalog grows
- Embedding API costs correlate with every publish, not just new content
- Users complaining about slow submission

**Phase to address:**
Duplicate Detection phase — pre-compute embeddings from the start

**Confidence:** HIGH (verified via [Vector Search Best Practices - Databricks](https://docs.databricks.com/aws/en/vector-search/vector-search-best-practices))

---

## Critical Fork Versioning Pitfalls

### Pitfall 26: Fork Proliferation Creates Discovery Chaos

**What goes wrong:**
Popular skills spawn dozens of forks, all appearing in search results. Users can't find the "canonical" or best version. Fork authors make trivial changes to claim attribution. The skill catalog becomes cluttered with near-identical variants, degrading the discovery experience.

**Why it happens:**
Fork-based versioning without curation is a copy machine, not a quality filter. Unlike wiki-style versioning (current model), forks create parallel evolution without natural consolidation. The fork incentive (visibility, attribution) is misaligned with user value (finding the best skill).

**How to avoid:**
- Require meaningful description of changes when forking
- Implement "parent skill" relationship with clear UI hierarchy
- Surface fork count and "best fork" signals (highest rated, most used)
- Consider fork consolidation: if fork diverges minimally, suggest contributing to parent
- Add "fork reason" taxonomy: bug fix, extension, specialization, different platform
- Default search to show parent skills, with option to expand forks

**Warning signs:**
- Search results dominated by minor forks of popular skills
- User complaints about "too many versions"
- Fork authors unable to explain differences from parent
- Low-quality forks ranking above high-quality parents

**Phase to address:**
Fork Versioning phase — design fork hierarchy and discovery rules before allowing forks

**Confidence:** HIGH (verified via [Git Fork Development Workflow - Medium](https://medium.com/@abhijit838/git-fork-development-workflow-and-best-practices-fb5b3573ab74), [Friendly Fork Management - GitHub Blog](https://github.blog/developer-skills/github/friend-zone-strategies-friendly-fork-management/))

---

### Pitfall 27: Orphaned Fork Dependency Chains

**What goes wrong:**
Author A creates skill. Author B forks it. Author A deletes original. Author C forks Author B's fork. Author B deletes theirs. Now Author C's skill has no attribution trail, and users following "view parent" links hit dead ends. Deletion cascades create confusing state.

**Why it happens:**
Fork relationships are references to mutable entities. Without cascade policies, deletions break the relationship graph. Users expect to traverse fork lineage but find broken links. The system accumulates orphaned references over time.

**How to avoid:**
- Never hard-delete skills, only soft-delete (preserve for lineage)
- Show "[deleted]" placeholder for parent skills that were removed
- Preserve minimal metadata (name, author, date) even after deletion
- Consider "reparenting" orphaned forks to grandparent
- Implement lineage snapshot: store parent info at fork time, not as live reference
- Audit fork graph periodically for broken references

**Warning signs:**
- "Skill not found" errors when viewing fork parent
- Fork attribution showing "[unknown]" or broken state
- Users confused about skill provenance
- Graph queries (find all forks of X) returning inconsistent results

**Phase to address:**
Fork Versioning phase — implement soft delete and lineage preservation in data model

**Confidence:** MEDIUM (derived from general fork management patterns)

---

### Pitfall 28: Fork Attribution Disputes

**What goes wrong:**
Author B forks Author A's skill, makes improvements, and the fork becomes more popular than the original. Author A claims credit for the foundation. Author B claims credit for making it useful. Disputes escalate. Users don't know who to credit. Attribution becomes a source of conflict rather than recognition.

**Why it happens:**
Fork attribution is inherently ambiguous — both original author and fork author contributed. Without clear policies, each party interprets attribution in their favor. The system doesn't distinguish "inspired by" from "derived from" from "minor edit of."

**How to avoid:**
- Define clear attribution policy upfront (e.g., "Forks credit both original and fork author")
- Display attribution chain in UI (Original by A, improved by B)
- Track contribution weight: original vs. fork delta
- Allow authors to opt-out of fork attribution if they don't want association
- Implement "substantial change" threshold for attribution claims

**Warning signs:**
- Authors disputing leaderboard rankings based on fork credit
- Requests to remove attribution from forks
- Confusion about who "owns" a popular skill
- Contributors avoiding forks to maintain "clean" attribution

**Phase to address:**
Fork Versioning phase — define attribution policy before enabling forks

**Confidence:** MEDIUM (derived from open source contribution patterns)

---

## Critical Cross-Platform Install Pitfalls

### Pitfall 29: Cross-Platform Config Format Mismatch

**What goes wrong:**
Generated MCP configs work on one platform but fail silently or error on another. Claude Desktop uses `mcpServers`, VS Code uses `mcp.servers`. Config that works in development breaks in user's environment. Users blame the skill, not the install process.

**Why it happens:**
MCP configuration format is not fully standardized across implementations. Claude Desktop, Claude Code, VS Code Copilot, and Cursor all have subtly different config structures, file locations, and supported transports. Current code (mcp-config.ts) assumes single format (Claude Desktop).

**How to avoid:**
- Generate platform-specific configs with clear platform labels
- Provide platform selector in install UI
- Include config file path guidance per platform
- Validate generated config against known platform schemas
- Test install flow on each supported platform
- Document platform-specific limitations (e.g., Claude Desktop has remote server limitations)

**Warning signs:**
- "Config not recognized" errors from users
- Users reporting "skill doesn't appear" after install
- Platform-specific bug reports clustering
- Config copy/paste working for some users but not others

**Phase to address:**
Cross-Platform Install phase — research all target platforms before implementation

**Confidence:** HIGH (verified via [MCP Servers Across Platforms - DEV Community](https://dev.to/darkmavis1980/understanding-mcp-servers-across-different-platforms-claude-desktop-vs-vs-code-vs-cursor-4opk), [VS Code MCP Servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers))

---

### Pitfall 30: Cross-Platform Path and Permission Issues

**What goes wrong:**
Install instructions reference paths that don't exist or require elevated permissions on some platforms. macOS config is at `~/Library/Application Support/Claude/`, Windows is at `%APPDATA%\Claude\`, Linux varies. Generated paths break on untested platforms. Users can't install without debugging.

**Why it happens:**
Cross-platform path handling is notoriously error-prone. Hardcoded paths fail on other OSes. Shell variable expansion differs across platforms. Permission models differ (macOS sandboxing, Windows UAC). Teams test on their primary platform and miss others.

**How to avoid:**
- Detect user's platform and generate appropriate paths
- Use platform-agnostic path construction (never hardcode separators)
- Provide fallback guidance if detection fails
- Test on all three major platforms (macOS, Windows, Linux)
- Avoid requiring elevated permissions — install to user-space locations
- Include "manual install" instructions as fallback

**Warning signs:**
- Install failures clustering on specific platforms
- Path-related errors in user reports
- "Permission denied" errors
- Users needing admin/sudo to install

**Phase to address:**
Cross-Platform Install phase — implement platform detection and path resolution

**Confidence:** HIGH (standard cross-platform development pattern)

---

### Pitfall 31: Version Incompatibility Across Platforms

**What goes wrong:**
A skill works perfectly on Claude Code but fails on Claude Desktop because Desktop runs an older Claude model version or has different MCP capabilities. Users install expecting consistent behavior but encounter platform-specific failures.

**Why it happens:**
Different platforms update on different cadences. Claude Desktop may lag behind Claude Code in MCP feature support. Skills that use newer features silently fail or produce unexpected results on older platforms.

**How to avoid:**
- Track platform version requirements per skill
- Display compatibility warnings for known platform limitations
- Test skills on minimum supported versions of each platform
- Document platform-specific feature availability
- Consider graceful degradation for optional features

**Warning signs:**
- Skills that work in development but fail in user reports
- Platform-specific failure patterns
- Users on older platform versions reporting issues
- Feature availability differing between platforms

**Phase to address:**
Cross-Platform Install phase — establish minimum version requirements per platform

**Confidence:** MEDIUM (derived from general cross-platform development patterns)

---

## v1.3 Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding embedding model | Faster implementation | Migration pain when model changes | Never — version from start |
| Storing embeddings without original text | Saves storage | Cannot re-embed without full reprocessing | Never — storage is cheap |
| Single platform config format | Simpler code | Platform expansion requires rewrite | MVP only, refactor before v2 |
| Synchronous AI review | Simpler request flow | UX degradation under load | Development only |
| Blocking on similarity check | Ensures duplicate warning shown | Submission latency increases with catalog size | Only if catalog <1000 skills |
| No soft delete for skills | Simpler data model | Fork orphan problem, audit trail loss | Never |
| Flat fork structure | Avoids tree traversal complexity | Fork proliferation becomes unmanageable | MVP only, plan migration |
| No review content caching | Simpler implementation | Redundant API calls for unchanged skills | Only during initial development |
| No cost tracking per author | Less instrumentation | Cannot detect abuse patterns | Never for production |

## v1.3 Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Using synchronous calls for review | Queue reviews asynchronously, return "pending" status |
| Claude API | Ignoring retry-after header | Parse and respect server-provided wait time |
| Claude API | No budget caps | Set hard limits with alerts at thresholds |
| Claude API | Including raw skill content in prompts | Sanitize for prompt injection before API call |
| Embedding API | Switching models without re-indexing | Version embeddings, plan migration strategy |
| Embedding API | Embedding at request time | Pre-compute and cache embeddings on skill save |
| Embedding API | No dimension validation | Verify embedding dimensions match index |
| MCP Config | Assuming Claude Desktop format everywhere | Detect platform, generate appropriate format |
| MCP Config | Hardcoding paths | Use platform-aware path resolution |
| MCP Config | Not validating generated JSON | Parse and validate before copying to clipboard |

## v1.3 Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Naive similarity search (scan all embeddings) | Query latency increases linearly | Use vector index (HNSW, IVF) | >1,000 skills |
| Synchronous AI review on submit | Submission timeout | Async queue with webhook/polling | Any concurrent load |
| Re-computing embeddings on every comparison | High latency, API cost | Cache embeddings at skill creation | >10 skills |
| Full skill content in every review prompt | Token explosion, cost explosion | Summarize, truncate, or chunk | Skills >2000 tokens |
| No pagination in fork listing | Memory/render issues | Paginate forks, show top N | >20 forks per skill |
| No rate limiting on review requests | API cost explosion | Per-user rate limits, budget caps | Any public usage |
| Embedding all skill fields | Dimension bloat, poor relevance | Embed only semantic content (instructions) | Any scale |
| N+1 queries for fork relationships | Page load time increases with fork count | Batch load fork metadata | >10 forks per skill |

## v1.3 Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Including raw skill content in prompts without sanitization | Prompt injection, review manipulation | Sanitize inputs, use structured prompts with clear delimiters |
| Trusting AI-generated reviews without validation | Hallucinated malicious content, false praise | Output validation, human-in-loop for flagged content |
| Storing API keys in client-visible config | Key exposure | Server-side API calls only, never expose keys to browser |
| MCP configs with overly broad permissions | Privilege escalation | Minimal permission configs, explicit scope limits |
| No rate limiting on review requests per user | Cost attack, DoS | Per-user, per-author rate limits with exponential backoff |
| Embedding queries without input validation | Embedding injection (theoretical) | Validate query format and length |
| Allowing arbitrary shell commands in install | Command injection | Whitelist allowed commands, escape all user input |
| Not validating platform detection | Wrong config installed | Server-side validation, fallback to manual selection |

## v1.3 UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocking submission on AI review | Frustration, abandonment | Async review, allow submission with "pending review" |
| Duplicate warning without context | Confusion about why warning appeared | Show similar skill name, author, similarity score |
| Too many install platforms shown | Choice paralysis | Auto-detect platform, show relevant option first |
| Fork hierarchy hidden in UI | Can't find canonical skill | Show fork badge, parent link prominently |
| AI suggestions without explanation | Distrust of recommendations | Include reasoning, cite specific issues |
| Silent config generation failures | User thinks install succeeded | Show validation result, common error guidance |
| AI review always visible | Stigmatizes skills with criticism | Collapse by default, expand on user action |
| No fork comparison view | Can't understand fork differences | Side-by-side diff or changelog between fork and parent |

## v1.3 "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **AI Review:** Often missing timeout handling — verify review completes or degrades gracefully under load
- [ ] **AI Review:** Often missing cost monitoring — verify budget alerts configured before production
- [ ] **AI Review:** Often missing input sanitization — verify prompt injection attempts are neutralized
- [ ] **AI Review:** Often missing output validation — verify hallucinated content is flagged
- [ ] **Duplicate Detection:** Often missing threshold tuning — verify false positive rate is acceptable to users
- [ ] **Duplicate Detection:** Often missing model versioning — verify embeddings track which model created them
- [ ] **Duplicate Detection:** Often missing index — verify similarity search uses vector index, not brute force
- [ ] **Fork Versioning:** Often missing soft delete — verify deleted skills preserve lineage metadata
- [ ] **Fork Versioning:** Often missing attribution display — verify fork shows clear parent relationship in UI
- [ ] **Fork Versioning:** Often missing attribution policy — verify contributors understand how credit works
- [ ] **Cross-Platform Install:** Often missing Windows testing — verify install works on all three major platforms
- [ ] **Cross-Platform Install:** Often missing config validation — verify generated config parses on target platform
- [ ] **Cross-Platform Install:** Often missing platform detection — verify user gets correct config automatically
- [ ] **All Features:** Often missing error recovery — verify user can recover from any failure state

## v1.3 Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AI hallucinated bad suggestions | LOW | Flag review, regenerate with adjusted prompt, notify affected users |
| Prompt injection in production | MEDIUM | Disable affected skill, audit review history, patch sanitization |
| Cost explosion | MEDIUM | Enable circuit breaker, process backlog at controlled rate, adjust budget |
| False positive duplicate storm | LOW | Raise threshold, dismiss existing warnings, communicate to users |
| Embedding model forced migration | HIGH | Enable dual-index mode, lazy re-embed, monitor quality metrics |
| Fork orphan cascade | MEDIUM | Run lineage repair script, backfill deleted parent metadata |
| Fork proliferation | MEDIUM | Implement canonical detection, auto-suggest consolidation |
| Config format failures on platform | LOW | Generate platform-specific config, provide manual instructions |
| Rate limit cascade | MEDIUM | Enable backpressure, queue pending reviews, notify users of delays |
| Attribution dispute | LOW | Apply defined policy, document decision, communicate to parties |

## v1.3 Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AI Review Hallucination | AI Review | Test with adversarial skills, track suggestion dismiss rate |
| Prompt Injection | AI Review | Security review of prompt construction, penetration testing |
| Cost Explosion | AI Review | Budget alerts fire in staging, circuit breaker tested under load |
| Rate Limit Cascade | AI Review | Load test with concurrent submissions, verify graceful degradation |
| False Positive Duplicates | Duplicate Detection | User testing, measure dismiss rate target <30% |
| Embedding Model Lock-in | Duplicate Detection | Schema includes model version field, re-embed script exists |
| Embedding Latency | Duplicate Detection | Pre-computed embeddings, vector index implemented |
| Fork Proliferation | Fork Versioning | UI shows parent/fork hierarchy, search defaults to parents |
| Fork Orphans | Fork Versioning | Soft delete implemented, lineage preserved in deleted state |
| Attribution Disputes | Fork Versioning | Policy documented, attribution chain visible in UI |
| Config Format Mismatch | Cross-Platform Install | Test on Claude Desktop, Claude Code, VS Code on each OS |
| Path/Permission Issues | Cross-Platform Install | E2E install tests on macOS, Windows, Linux |
| Version Incompatibility | Cross-Platform Install | Platform version requirements documented, compatibility warnings shown |

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

### v1.3 AI Features Sources (High Confidence)
- [Claude API Rate Limits Documentation](https://docs.claude.com/en/api/rate-limits)
- [How to Reduce Claude API Latency - SigNoz](https://signoz.io/guides/claude-api-latency/)
- [MCP Security Best Practices - Model Context Protocol](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [MCP Security Vulnerabilities - Practical DevSecOps](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [MCP Security Risks - Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [Prompt Injection Attacks Research - MDPI](https://www.mdpi.com/2078-2489/17/1/54)
- [Different Embedding Models, Different Spaces - Medium](https://medium.com/data-science-collective/different-embedding-models-different-spaces-the-hidden-cost-of-model-upgrades-899db24ad233)
- [When Good Models Go Bad - Weaviate](https://weaviate.io/blog/when-good-models-go-bad)
- [7 Strategies To Solve LLM Reliability Challenges - Galileo](https://galileo.ai/blog/production-llm-monitoring-strategies)
- [Semantic Deduplication - NVIDIA NeMo Framework](https://docs.nvidia.com/nemo-framework/user-guide/24.09/datacuration/semdedup.html)
- [Vector Search Best Practices - Databricks](https://docs.databricks.com/aws/en/vector-search/vector-search-best-practices)
- [Understanding MCP Servers Across Platforms - DEV Community](https://dev.to/darkmavis1980/understanding-mcp-servers-across-different-platforms-claude-desktop-vs-vs-code-vs-cursor-4opk)
- [Use MCP Servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Git Fork Development Workflow - Medium](https://medium.com/@abhijit838/git-fork-development-workflow-and-best-practices-fb5b3573ab74)
- [Friendly Fork Management - GitHub Blog](https://github.blog/developer-skills/github/friend-zone-strategies-friendly-fork-management/)
- [LLM Cost Optimization - Kosmoy](https://www.kosmoy.com/post/llm-cost-management-stop-burning-money-on-tokens)
- [ISACA AI Pitfalls 2026](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents)
- [MIT Technology Review: Rise of AI Coding](https://www.technologyreview.com/2025/12/15/1128352/rise-of-ai-coding-developers-2026/)

---
*Pitfalls research for: Internal skill marketplace / developer tool catalog*
*v1.0/v1.1 researched: 2026-01-31*
*v1.2 Table UI researched: 2026-02-01*
*v1.3 AI Features researched: 2026-02-02*
