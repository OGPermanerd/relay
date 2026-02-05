# Pitfalls Research

**Domain:** Internal skill marketplace / developer tool catalog
**Researched:** 2026-01-31 (v1.0), 2026-02-01 (v1.2 Table UI), 2026-02-02 (v1.3 AI Features), 2026-02-05 (v1.4 Employee Analytics & Remote MCP)
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

## v1.4 Employee Analytics & Remote MCP Pitfalls

**Domain:** MCP authentication, remote MCP via HTTP, employee usage analytics, install tracking, usage dashboard
**Researched:** 2026-02-05
**Scale Context:** Adding auth + analytics to existing anonymous MCP system serving 500+ target employees
**Core Challenge:** The `userId` field exists in `usage_events` schema but is never populated by any MCP tool. All current MCP usage is anonymous via stdio transport with no user identity.

---

## Critical MCP Authentication Pitfalls

Mistakes that cause security vulnerabilities, data integrity failures, or system rewrites.

### Pitfall 32: Adding Auth to Existing Anonymous MCP Breaks All Current Users

**What goes wrong:**
Existing MCP users have the Relay MCP server configured via stdio transport in their `claude_desktop_config.json` or `.claude/settings.json`. Adding mandatory authentication breaks every existing installation simultaneously. Users who don't update their config immediately lose access. Support tickets flood in. MCP usage drops to zero while users figure out the new auth flow.

**Why it happens:**
The current MCP server (`apps/mcp/src/index.ts`) uses `StdioServerTransport` with zero authentication. Every `trackUsage()` call in the tools (search, list, deploy) passes no `userId`. Switching to authenticated calls requires every user to reconfigure. There is no migration path from "anonymous stdio" to "authenticated stdio" that doesn't require user action.

**How to avoid:**
- Run authenticated and anonymous MCP in parallel during transition (dual-transport period)
- Keep the existing stdio MCP server working throughout the migration
- Add a NEW remote HTTP endpoint with auth rather than modifying the existing stdio server
- Implement a grace period: anonymous usage continues working but logs deprecation warnings
- Track how many active users are on anonymous vs. authenticated to know when to sunset
- Provide one-command migration: `npx relay-mcp migrate` that updates the user's config

**Warning signs:**
- MCP usage metrics suddenly drop to zero after deployment
- Support tickets about "Relay MCP stopped working"
- Users reverting to old config and bypassing new auth
- Dashboard showing zero authenticated users weeks after launch

**Phase to address:**
Auth Infrastructure phase -- MUST be the first implementation. Design dual-transport architecture before touching any existing code.

**Confidence:** HIGH (directly observed in codebase: `apps/mcp/src/index.ts` uses only `StdioServerTransport`, `trackUsage()` never receives userId)

---

### Pitfall 33: API Key Leakage Through MCP Config Files

**What goes wrong:**
Org API keys stored in MCP config files (like `claude_desktop_config.json`) get committed to git repos, shared in screenshots, or exposed through dotfile syncing. Unlike OAuth tokens, API keys don't expire, so a leaked key provides permanent access. One leaked key in a public dotfiles repo exposes the entire org's usage data.

**Why it happens:**
MCP config files live in user home directories and are often managed alongside other dotfiles. Developers routinely commit dotfiles to public repos. The config file format stores credentials in plaintext JSON. There's no built-in mechanism to reference secrets by ID rather than value. Existing install instructions (current `deploy.ts`) generate config snippets that users paste directly into config files.

**How to avoid:**
- Use environment variable references in MCP configs: `"apiKey": "${RELAY_API_KEY}"` rather than literal values
- Generate API keys with a prefix (e.g., `rlk_`) so secret scanners can detect them
- Implement key rotation with zero-downtime dual-key overlap period
- Set short expiration by default (90 days) with renewal reminders
- Add a key dashboard showing last-used timestamp per key to detect unused/leaked keys
- Run git secret scanning on the company GitHub org for `rlk_` patterns
- Never log the full API key in server logs; log only the prefix (`rlk_...abc`)

**Warning signs:**
- API keys found in public repos via GitHub secret scanning alerts
- Multiple users sharing the same API key (should be per-user)
- API key usage from unexpected IP ranges or geographies
- Keys that haven't been rotated in 6+ months

**Phase to address:**
Auth Infrastructure phase -- key format, rotation, and scanning must be designed before key issuance begins

**Confidence:** HIGH (verified via [API Key Security Best Practices 2026](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d), [Infisical API Key Management](https://infisical.com/blog/api-key-management), [Claude API Key Best Practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure))

---

### Pitfall 34: API Key Revocation Without Immediate Effect

**What goes wrong:**
An employee leaves the company or a key is compromised. Admin revokes the key in the dashboard, but the key continues working because revocation is checked only at key creation time, not on every request. Hours or days of unauthorized access follow the "revocation."

**Why it happens:**
For performance, developers cache API key validation results. A key lookup hits the database once, then the result is cached in memory or Redis with a long TTL. Revocation updates the database, but the cache still holds the valid result. Also, if key validation happens only in middleware that checks a JWT signed from the API key, the JWT remains valid until expiration.

**How to avoid:**
- Check key validity on EVERY request against the database (the performance cost at 500 users is negligible)
- If caching is needed, use very short TTL (30 seconds max) with forced cache invalidation on revoke
- Never convert API keys to long-lived JWTs -- the key IS the credential for each request
- Implement a revocation event that pushes invalidation to all server instances
- Add a `revokedAt` timestamp column, not just a boolean, for audit trail
- Test revocation end-to-end: revoke a key in UI, verify the next MCP request fails within 30 seconds

**Warning signs:**
- Revoked keys still appearing in usage logs after revocation
- Gap between `revokedAt` timestamp and last successful usage
- Users reporting they can still use MCP after admin disables their key
- No test coverage for revocation flow

**Phase to address:**
Auth Infrastructure phase -- revocation must be immediate, not eventually consistent

**Confidence:** HIGH (verified via [API Key Management - DigitalAPI](https://www.digitalapi.ai/blogs/api-key-management), [Hardening OAuth Tokens](https://www.clutchevents.co/resources/hardening-oauth-tokens-in-api-security-token-expiry-rotation-and-revocation-best-practices))

---

### Pitfall 35: Stdio Transport Cannot Carry User Identity Natively

**What goes wrong:**
The team tries to add `userId` to the existing stdio MCP transport by having the MCP client pass it as a tool parameter. But Claude Code and Claude Desktop control the MCP client -- Relay cannot inject custom headers or auth tokens into the stdio pipe. The userId would need to come from the LLM itself, which is untrustworthy (the model could hallucinate or omit it).

**Why it happens:**
Stdio MCP transport is designed for local tools where the user IS the person running the process. There is no authentication layer in the stdio protocol -- the MCP specification explicitly states that STDIO transport "SHOULD NOT follow [the auth] specification, and instead retrieve credentials from the environment." The current `StdioServerTransport` in the codebase has no mechanism to identify which user launched the process.

**How to avoid:**
- For stdio: read identity from environment variables (`RELAY_USER_EMAIL` or `RELAY_API_KEY`) set during installation
- For remote: use Streamable HTTP transport where Authorization headers carry identity
- NEVER trust tool input parameters for user identity (the LLM provides these, not the user)
- During install, embed the user's API key into the MCP server config's `env` block so it's available at process startup
- Validate the API key against the database at server startup, cache the userId for all subsequent tool calls in that session

**Warning signs:**
- `userId` in usage_events is null despite "authenticated" MCP being deployed
- Users able to impersonate others by passing a different userId as a tool parameter
- Authentication working on HTTP transport but not on stdio
- Different users sharing the same `userId` in usage logs

**Phase to address:**
Auth Infrastructure phase -- critical architectural decision: environment-based identity for stdio, header-based for HTTP

**Confidence:** HIGH (verified via [MCP Authorization Spec](https://modelcontextprotocol.io/docs/tutorials/security/authorization): "Implementations using STDIO transport SHOULD NOT follow this specification, and instead retrieve credentials from the environment"; directly confirmed in codebase `apps/mcp/src/index.ts`)

---

## Critical Remote MCP (HTTP Transport) Pitfalls

### Pitfall 36: Remote MCP Server Exposed Without Authentication

**What goes wrong:**
The Streamable HTTP endpoint goes live without authentication because "we'll add it later." During development/staging, the endpoint is discoverable. Anyone who finds the URL can invoke all MCP tools, query the skills database, and track fake usage events. A single exposed endpoint becomes a data exfiltration vector.

**Why it happens:**
FastMCP and the MCP SDK default to no authentication on HTTP transport. Developers focus on getting the transport working first, then plan to "bolt on" auth. The spec warning is buried in documentation. The existing codebase has zero auth in the MCP server, so extending it to HTTP feels like "just changing the transport."

**How to avoid:**
- Implement auth middleware BEFORE the first HTTP endpoint goes live, even in development
- Use the MCP spec's OAuth 2.1 flow for Claude.ai browser-based access
- For internal API key auth: validate the `Authorization: Bearer <api-key>` header on every request
- Return `401 Unauthorized` with proper `WWW-Authenticate` header when auth fails
- Bind to `127.0.0.1` during development, never `0.0.0.0`
- Add integration test that verifies unauthenticated requests are rejected

**Warning signs:**
- HTTP endpoint accessible without any authentication in staging
- No `Authorization` header validation in request handler
- Endpoint bound to `0.0.0.0` instead of `127.0.0.1` in development
- No 401 response code in any test suite

**Phase to address:**
Remote MCP phase -- auth middleware is a prerequisite, not a follow-up

**Confidence:** HIGH (verified via [CardinalOps MCP Defaults](https://cardinalops.com/blog/mcp-defaults-hidden-dangers-of-remote-deployment/), [Bitsight Exposed MCP Servers](https://www.bitsight.com/blog/exposed-mcp-servers-reveal-new-ai-vulnerabilities), [MCP Streamable HTTP Security - Medium](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19))

---

### Pitfall 37: Missing Origin Validation Enables DNS Rebinding Attacks

**What goes wrong:**
The remote MCP server accepts requests from any origin. An attacker creates a malicious webpage that makes requests to the MCP server from the victim's browser. Because the browser sends the user's cookies/tokens automatically, the attacker can invoke MCP tools on behalf of authenticated users. The MCP specification explicitly warns about this.

**Why it happens:**
Developers skip `Origin` header validation because "it's an internal tool" or because CORS configuration is confusing. The MCP spec requires Origin validation but the SDK doesn't enforce it automatically. DNS rebinding bypasses same-origin policy when Origin validation is missing.

**How to avoid:**
- Validate the `Origin` header on ALL incoming HTTP requests (the MCP spec REQUIRES this)
- Maintain a strict allowlist of permitted origins (e.g., `https://relay.company.com`)
- Reject requests with missing or untrusted `Origin` headers
- Set CORS headers to specific origins, never `Access-Control-Allow-Origin: *` with credentials
- Include `Mcp-Session-Id`, `Content-Type`, `Authorization`, and `Mcp-Protocol-Version` in `Access-Control-Allow-Headers`
- Test with `curl -H "Origin: https://evil.com"` to verify rejection

**Warning signs:**
- `Access-Control-Allow-Origin: *` in response headers
- No Origin validation middleware in HTTP handler
- CORS working "everywhere" without configuration (means it's too permissive)
- Security audit flagging Origin header not being checked

**Phase to address:**
Remote MCP phase -- Origin validation is part of the transport layer, implement with transport

**Confidence:** HIGH (verified via [MCP Specification Transport Security](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports): "Servers MUST validate the Origin header"; [CORS for MCP Servers - MCPcat](https://mcpcat.io/guides/implementing-cors-policies-web-based-mcp-servers/))

---

### Pitfall 38: Session Hijacking Through Predictable Session IDs

**What goes wrong:**
The Streamable HTTP transport uses `Mcp-Session-Id` headers to maintain stateful sessions. If session IDs are predictable (sequential integers, timestamps, non-random UUIDs), an attacker can guess another user's session ID and hijack their MCP connection. They inherit the victim's authentication context and can make tool calls as that user.

**Why it happens:**
The MCP SDK generates session IDs, but developers may override the default generator with simpler implementations for debugging. Or the session ID is stored in a URL parameter instead of a header, making it visible in server logs and browser history.

**How to avoid:**
- Use the SDK's default session ID generator (cryptographically secure random)
- Never pass session IDs in URL query parameters
- Bind sessions to the authenticated user's identity (session + API key must match)
- Implement session timeout (e.g., 1 hour of inactivity)
- Invalidate sessions on explicit disconnect and on authentication failure
- Log session creation/destruction for audit

**Warning signs:**
- Session IDs that are sequential or contain timestamps
- Session IDs visible in URL query strings
- No session timeout configuration
- Sessions surviving after user's API key is revoked

**Phase to address:**
Remote MCP phase -- session management is integral to the transport layer

**Confidence:** HIGH (verified via [MCP Streamable HTTP Security](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19): "Use strong random session identifiers... validate all Mcp-Session-Id headers")

---

### Pitfall 39: Claude.ai Connector CORS and IP Allowlisting Requirements

**What goes wrong:**
The team builds a remote MCP server that works perfectly with Claude Code (which uses server-side HTTP, no CORS needed) but fails completely when connected via Claude.ai web (which makes browser-side requests subject to CORS). The Claude.ai Connectors feature has specific requirements that differ from Claude Code's remote MCP.

**Why it happens:**
Claude.ai web connectors make requests from Anthropic's infrastructure, not from the user's browser directly. This means the MCP server needs to allowlist Claude's IP addresses AND handle OAuth flows. The mental model of "just expose an HTTP endpoint" misses the protocol handshake that Claude.ai requires (PRM discovery, OAuth, resource indicators).

**How to avoid:**
- Implement separate configuration for Claude Code (API key auth) vs. Claude.ai (OAuth 2.1)
- For Claude.ai: implement OAuth 2.1 with PKCE and Dynamic Client Registration
- For Claude.ai: expose `/.well-known/oauth-protected-resource` metadata endpoint
- IP allowlist Anthropic's published IP ranges if required by your network policy
- Test with both Claude Code CLI and Claude.ai web browser to verify both paths work
- Consider Claude.ai connector submission process for public availability

**Warning signs:**
- MCP works in Claude Code but returns CORS errors in Claude.ai
- OAuth flow fails to complete when initiated from Claude.ai
- Missing `/.well-known/oauth-protected-resource` endpoint returns 404
- Claude.ai shows "connection failed" while curl to the same endpoint works fine

**Phase to address:**
Remote MCP phase -- design transport layer to handle both Claude Code and Claude.ai from the start

**Confidence:** HIGH (verified via [Claude Remote MCP Server Guide](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers), [Claude Remote MCP Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide), [InfoQ: Claude Code Remote MCP](https://www.infoq.com/news/2025/06/anthropic-claude-remote-mcp/))

---

## Critical Employee Analytics Pitfalls

### Pitfall 40: Tracking Individual Employee Activity Without Transparency Creates Trust Crisis

**What goes wrong:**
Employees discover that the tool marketplace tracks their individual usage patterns (which skills they use, when, how often) and reacts with fear, distrust, and reduced adoption. "Big Brother" narrative spreads through Slack. The tool meant to help employees becomes perceived as a surveillance tool. Adoption drops despite the tool being genuinely useful.

**Why it happens:**
Internal tools rarely have explicit privacy policies. The line between "analytics to improve the product" and "monitoring employee behavior" is blurry. Without proactive transparency, employees fill the information vacuum with worst-case assumptions. Even well-intentioned tracking (e.g., for manager dashboards showing team adoption) can be perceived as surveillance.

**How to avoid:**
- Display what is tracked directly in the UI: "Relay tracks which skills you use to calculate FTE Days Saved"
- Let employees see their own usage data (transparency builds trust)
- Track WHAT was used, not HOW it was used (skill invocations, not prompt content)
- Aggregate team-level metrics by default; individual data visible only to the individual
- Publish a clear data retention policy: "Usage data is retained for 90 days, then aggregated"
- Get explicit buy-in from employee representatives or works council before launch
- NEVER track: prompt content, task context, idle time, or anything resembling productivity scoring

**Warning signs:**
- Slack/Teams messages expressing concern about tracking
- Employees using skills without MCP (copying content) to avoid tracking
- Low adoption despite high interest
- Questions from legal/HR about privacy compliance

**Phase to address:**
Analytics Design phase -- privacy framework must be defined BEFORE any employee-level tracking ships

**Confidence:** HIGH (verified via [Workplace Privacy Report](https://www.workplaceprivacyreport.com/2025/06/articles/artificial-intelligence/managing-the-managers-governance-risks-and-considerations-for-employee-monitoring-platforms/), [BusinessNewsDaily Employee Monitoring](https://www.businessnewsdaily.com/6685-employee-monitoring-privacy.html), [WorkTime Monitoring Dos/Don'ts](https://www.worktime.com/blog/employee-monitoring/dos-and-donts-when-implementing-employee-monitoring-software))

---

### Pitfall 41: Historical Anonymous Events Cannot Be Retroactively Attributed

**What goes wrong:**
After deploying authentication, the team wants to retroactively assign userId to the hundreds of anonymous usage_events already in the database. But there is NO way to know who generated those events. The `userId` column remains null for all historical data. Analytics dashboards show a cliff: zero attributed usage before the auth deploy date, then a sudden jump. Historical trend analysis is meaningless.

**Why it happens:**
The current `trackUsage()` function in `apps/mcp/src/tracking/events.ts` never receives a userId because the MCP server has no concept of user identity. The `usageEvents` schema has a `userId` field with a foreign key to `users.id`, but it has always been null. There is no session ID, anonymous ID, or machine fingerprint that could retrospectively link events to users.

**How to avoid:**
- Accept that historical data is permanently anonymous -- do not try to guess attribution
- Set a clear "attribution start date" in the dashboard (e.g., "User-level data available from Feb 10, 2026")
- Show aggregate-only metrics for the pre-auth period, per-user metrics only after
- Consider a voluntary "claim your past usage" flow (user self-reports which skills they used) but mark it as self-reported
- Start tracking a machine/session fingerprint NOW (before auth ships) so there's at least a linkable anonymous ID during the transition period
- Run a migration that sets a `migration_note` on historical events: `"pre-auth: no userId available"`

**Warning signs:**
- Stakeholders asking "how many FTE Days Saved per employee" and expecting retroactive data
- Dashboard showing 100% anonymous usage for the pre-auth period
- Attempts to "impute" userId from metadata (IP, timestamp) that produce garbage results
- Product decisions delayed because "we don't have enough per-user data yet"

**Phase to address:**
Auth Infrastructure phase -- acknowledge the data boundary explicitly, then Analytics phase -- build dashboards that handle the null-userId period gracefully

**Confidence:** HIGH (directly confirmed: `apps/mcp/src/tracking/events.ts` line 9 shows `trackUsage()` omits userId in all current calls; `packages/db/src/schema/usage-events.ts` line 12 shows userId is nullable)

---

### Pitfall 42: Dashboard Queries Degrade as Usage Events Grow

**What goes wrong:**
The usage analytics dashboard runs aggregate queries (`COUNT`, `GROUP BY date`, `SUM`) directly against the `usage_events` table. At 500 users making 10+ tool calls per day, the table grows by 5,000+ rows daily (150,000+ per month). Within 6 months, queries that took 50ms take 5 seconds. The dashboard becomes unusable. Meanwhile, the same queries compete with the OLTP workload (skill creation, ratings), slowing the entire application.

**Why it happens:**
PostgreSQL's row-oriented storage is not optimized for analytical aggregation queries. The `usage_events` table has no partitioning, no time-series indexes, and no pre-computed aggregates. The existing `getUsageTrends()` function in `apps/web/lib/usage-trends.ts` already does `date_trunc` + `GROUP BY` + `JOIN` on every page load. This pattern does not scale.

**How to avoid:**
- Create materialized views for common aggregation patterns (daily totals, per-user summaries, per-skill summaries)
- Refresh materialized views on a schedule (every 15 minutes or hourly), not on every query
- Partition the `usage_events` table by month using PostgreSQL declarative partitioning
- Add a composite index on `(created_at, skill_id, user_id)` for the most common query patterns
- For the dashboard, query the materialized view, not the raw events table
- Set a query timeout (5 seconds) on dashboard queries to prevent long-running queries from blocking OLTP
- Monitor query execution plans monthly as data grows

**Warning signs:**
- Dashboard page load time increasing week over week
- PostgreSQL `pg_stat_statements` showing `usage_events` aggregation queries in top 10 by total time
- Application latency spikes correlating with dashboard page views
- `EXPLAIN ANALYZE` showing sequential scans on `usage_events` instead of index scans

**Phase to address:**
Analytics Dashboard phase -- design materialized views and indexes BEFORE building the dashboard UI

**Confidence:** HIGH (verified via [PostgreSQL Analytics Performance - Crunchy Data](https://www.crunchydata.com/blog/postgres-tuning-and-performance-for-analytics-data), [Real-time Analytics in Postgres - Timescale](https://medium.com/timescale/real-time-analytics-in-postgres-why-its-hard-and-how-to-solve-it-bd28fa7314c7), [PostgreSQL Analytics Workloads - Epsio](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips))

---

### Pitfall 43: Install Callback Tracking Produces Inflated Numbers

**What goes wrong:**
Install tracking reports 10x more installs than actual active users. The "install" callback fires on every config copy, including re-installs, failed installs, and users who copy the config but never use it. There's no deduplication, so the same user reinstalling counts as a new install each time. Stakeholders see inflated install numbers and set unrealistic adoption expectations.

**Why it happens:**
The "install" event is typically a clipboard copy or a config write -- neither confirms the skill was actually installed and working. Network retries on the callback can fire the event multiple times. There's no follow-up "activation" event to confirm the install succeeded. The distinction between "downloaded" and "installed and working" is not tracked.

**How to avoid:**
- Distinguish "config copied" (intent) from "first MCP tool call with this skill" (activation)
- Deduplicate install events by `(userId, skillId, platform)` -- one install per user per skill per platform per day
- Generate a unique `$insert_id` per install event to enable server-side deduplication
- Track "activation" separately: the first `deploy_skill` or `search_skills` call after install
- Report both "installs" and "activations" in dashboard, with conversion rate between them
- Implement idempotency keys on the install callback endpoint to prevent network retry duplicates

**Warning signs:**
- Install count >> active user count (more than 3x indicates inflation)
- Same userId appearing multiple times in install events within minutes
- High install count but low subsequent skill usage
- Stakeholders citing install numbers that don't match reality

**Phase to address:**
Install Tracking phase -- design event schema with deduplication from the start

**Confidence:** HIGH (verified via [Mixpanel Event Deduplication](https://developer.mixpanel.com/reference/event-deduplication): "The $insert_id should be a randomly generated, unique value"; [GA4 Duplicate Events - Analytify](https://analytify.io/fix-ga4-duplicate-events/))

---

### Pitfall 44: Rate Limiting Missing on Remote MCP Allows Resource Exhaustion

**What goes wrong:**
The remote HTTP MCP endpoint has no rate limiting. A single client (malicious or buggy) sends thousands of requests per second. The PostgreSQL database connection pool is exhausted. All legitimate MCP users experience timeouts. The web application (which shares the database) also degrades. A single compromised API key can take down the entire platform.

**Why it happens:**
Rate limiting is seen as a "nice to have" for internal tools. The existing stdio MCP has natural rate limiting (one user, one process, one connection). HTTP changes the model: now any number of concurrent connections can hit the endpoint. Without rate limiting, a single bad actor or automation script can monopolize resources.

**How to avoid:**
- Implement per-API-key rate limiting: 60 requests/minute for standard keys, configurable per key
- Implement global rate limiting: 1000 requests/minute across all keys
- Return `429 Too Many Requests` with `Retry-After` header
- Use a sliding window algorithm (not fixed window, which allows burst at window boundaries)
- Add rate limit headers to every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Separate rate limits for different operations (read vs. write, search vs. deploy)
- Monitor for keys consistently hitting rate limits (possible abuse indicator)

**Warning signs:**
- Single API key responsible for >50% of total requests
- Database connection pool warnings in logs
- Request latency spikes correlating with specific API key usage
- No rate limit headers in any HTTP responses

**Phase to address:**
Remote MCP phase -- rate limiting is a transport-layer concern, implement with the HTTP endpoint

**Confidence:** HIGH (verified via [API Key Management Best Practices](https://apidog.com/blog/api-key-management-best-practices/), [MCP Streamable HTTP Security](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19))

---

## Moderate v1.4 Pitfalls

Mistakes that cause delays, technical debt, or degraded experience.

### Pitfall 45: OAuth 2.1 Over-Engineering for Internal Use

**What goes wrong:**
The team implements the full MCP OAuth 2.1 specification (Dynamic Client Registration, Protected Resource Metadata, PKCE, token refresh) when all they need is API key authentication for 500 internal employees. The OAuth implementation takes 3 weeks instead of the 3 days API keys would take. Meanwhile, employee tracking is blocked waiting on auth.

**Why it happens:**
The MCP specification recommends OAuth 2.1 as the standard auth mechanism. Teams read the spec and build what it says rather than what they need. For an internal tool with existing Google SSO, OAuth is massive overkill for the initial release. The spec is designed for public MCP servers with unknown clients -- not internal tools with known employees.

**How to avoid:**
- Start with API key auth for the stdio transport (environment variable, per-employee)
- Add OAuth 2.1 ONLY when Claude.ai web connector support is needed (Phase 2+)
- Use the existing Auth.js session to issue API keys through the web dashboard
- Keep the auth upgrade path open: API keys now, OAuth later for browser clients
- The MCP spec explicitly allows non-OAuth auth for internal tools: "API keys have inherent limitations... but are the simplest technique"

**Warning signs:**
- Auth implementation timeline exceeding 1 week for initial deploy
- Building OAuth infrastructure before a single authenticated MCP call works
- Team spending time on Dynamic Client Registration when there's only one client
- Blocked on auth while feature work (analytics, dashboard) could proceed

**Phase to address:**
Auth Infrastructure phase -- use pragmatic API keys first, plan OAuth upgrade for Claude.ai phase

**Confidence:** HIGH (verified via [MCP Auth Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization), [Stytch MCP Auth Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/), [Scalekit: Migrate from API Keys to OAuth](https://www.scalekit.com/blog/migrating-from-api-keys-to-oauth-mcp-servers))

---

### Pitfall 46: Dashboard Shows Raw Event Counts Instead of Meaningful Metrics

**What goes wrong:**
The usage dashboard displays "total MCP calls" and "events per day" as raw numbers. These metrics are meaningless to stakeholders. A user who searches 20 times before finding the right skill generates 20 events, but saved time only once. Leadership can't answer "is Relay delivering ROI?" from raw event counts. The dashboard exists but nobody uses it.

**Why it happens:**
It's easy to `COUNT(*)` on `usage_events` grouped by date. It's hard to derive meaningful business metrics like "unique users who saved time today" or "skills with repeat users this week." Teams ship the easy metrics first and never build the meaningful ones.

**How to avoid:**
- Define metrics from the stakeholder question backward: "What question does this number answer?"
- Key metrics should be: active users (unique userId with any event), skills adopted (unique userId+skillId combinations), time saved (via deploy_skill events linked to hoursSaved)
- Separate operational metrics (for debugging: total events, error rate) from business metrics (for leadership: adoption, retention, ROI)
- Show trends and comparisons, not absolute numbers: "20% more active users than last week" not "47 events today"
- Include the "so what?" for every metric: attach it to a business outcome

**Warning signs:**
- Stakeholders asking "what do these numbers mean?" after seeing the dashboard
- Dashboard showing only raw counts with no interpretation
- No unique-user-based metrics in the dashboard
- Nobody bookmarking or regularly visiting the dashboard page

**Phase to address:**
Analytics Dashboard phase -- define metrics with stakeholders BEFORE building any UI

**Confidence:** MEDIUM (derived from analytics best practices and project context: current `usage-trends.ts` calculates `daysSaved` but only at the skill level, not per-user)

---

### Pitfall 47: Dual Transport (Stdio + HTTP) Creates Two Codepaths to Maintain

**What goes wrong:**
The MCP server now has two transports: stdio for local Claude Code users and Streamable HTTP for Claude.ai web users. Each transport has different auth mechanisms (env var vs. Bearer token), different session management (process-lifetime vs. HTTP sessions), and different error handling (stderr vs. HTTP status codes). Bug fixes need to be applied to both paths. Feature updates require testing both paths. The maintenance burden doubles.

**Why it happens:**
Stdio can't be abandoned (existing users depend on it). HTTP is needed for web access. These are fundamentally different transport protocols with different lifecycle models. Without careful abstraction, the tool handler code gets littered with `if (transport === 'stdio')` branches.

**How to avoid:**
- Create a transport-agnostic auth layer: `getCurrentUser()` that works regardless of transport
- For stdio: resolve user from `RELAY_API_KEY` environment variable at startup, cache for session
- For HTTP: resolve user from `Authorization: Bearer <key>` header per request
- Keep all tool handler logic (search, list, deploy) completely transport-unaware
- The tool handler receives a `context` object that includes `userId` -- how it got there is the transport layer's job
- Test tool handlers with a mock context, test transport layers separately

**Warning signs:**
- Tool handler code checking which transport is active
- Bugs that appear in one transport but not the other
- Features working on HTTP but broken on stdio (or vice versa)
- Duplicated auth validation code in multiple files

**Phase to address:**
Auth Infrastructure phase -- design the abstraction layer before implementing either transport's auth

**Confidence:** HIGH (architectural pattern derived from existing codebase analysis: `apps/mcp/src/index.ts` creates transport, `apps/mcp/src/tools/*.ts` contain handlers that should be transport-agnostic)

---

### Pitfall 48: Extended Search Breaking Existing Search Performance

**What goes wrong:**
Adding author name and tag matching to search queries (currently name+description only in `apps/mcp/src/tools/search.ts`) degrades search performance. The existing in-memory filter approach (`allResults.filter(...)`) now needs to JOIN with users table for author names. The query that took 50ms now takes 500ms because it's loading all skills AND all users into memory.

**Why it happens:**
The current search implementation fetches all skills and filters in-memory: `const allResults = await db.query.skills.findMany(...)` followed by `.filter()`. This was a pragmatic choice to "avoid TypeScript module resolution issues with drizzle operators." Adding more fields to match against multiplies the in-memory data set and adds JOINs.

**How to avoid:**
- Refactor search to use proper SQL queries with Drizzle operators instead of in-memory filtering
- Extend the existing `searchVector` tsvector column to include author name and tags
- Use `setweight(to_tsvector('english', author.name), 'C')` for author name (lower weight than name/description)
- For tags: use PostgreSQL array operators (`@>`, `&&`) instead of text search
- Add a compound GIN index covering the extended search vector
- Benchmark before and after to verify no regression

**Warning signs:**
- Search latency doubling after adding author/tag matching
- MCP `search_skills` tool calls timing out
- Memory usage spikes during search operations
- Users reporting search is "slower than before"

**Phase to address:**
Extended Search phase -- refactor from in-memory to SQL-based search as part of the enhancement

**Confidence:** HIGH (directly confirmed in `apps/mcp/src/tools/search.ts`: lines 30-48 show the in-memory filter pattern; and `packages/db/src/schema/skills.ts`: lines 43-45 show the tsvector only covers name+description)

---

## v1.4 Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| API keys as plaintext in MCP config | Simplest user experience | Key leakage through dotfile repos, no rotation | Never -- use env var references from day one |
| Skip key rotation mechanism | Faster initial implementation | Leaked keys grant permanent access; no way to force credential refresh | First 30 days only -- implement rotation before org-wide rollout |
| Shared database for OLTP + analytics | No new infrastructure | Dashboard queries slow down application at scale (6+ months of data) | First 6 months; plan materialized views from the start |
| In-memory search filtering | Avoids Drizzle operator complexity | Breaks at 500+ skills, can't extend to author/tag search | Never for v1.4 -- refactor as part of extended search |
| Single API key per org (not per user) | Simpler key management | Zero per-employee attribution, key compromise affects everyone | Never -- defeats the purpose of employee tracking |
| Skip rate limiting on HTTP MCP | Faster to ship | One bad actor can DoS the entire platform | Never for production HTTP endpoints |
| Cache key validation results | Reduces DB queries per request | Revocation takes minutes to propagate instead of seconds | Only with 30-second TTL maximum |
| Sync analytics writes in tool handlers | Simpler code flow | Tool call latency includes database write time; failures block the response | First month; move to async event queue before 500 users |

## v1.4 Integration Gotchas

Common mistakes when connecting these specific features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stdio MCP + Auth | Passing userId as a tool parameter (model provides it, not user) | Read API key from environment variable at process startup; validate once |
| HTTP MCP + Auth | Using the same session token as the web app's Auth.js JWT | MCP API keys are separate credentials; web session and MCP auth are independent systems |
| Usage Events + userId | Backfilling historical events with guessed userIds | Accept historical data is anonymous; set clear "attribution start date" |
| Dashboard + usage_events | Running aggregation queries directly on the events table | Use materialized views refreshed on schedule for dashboard queries |
| Install tracking + dedup | Counting every clipboard copy as an "install" | Deduplicate by (userId, skillId, platform) per day; track "activation" separately |
| API key generation + Auth.js | Generating API keys outside the existing auth flow | Use the web dashboard (behind Google SSO) to generate/manage API keys |
| Extended search + MCP | Adding search fields only in the web UI, not in MCP tools | Both `apps/web` search and `apps/mcp` search must use the same extended search logic |
| Remote MCP + CORS | Using `Access-Control-Allow-Origin: *` for convenience | Allowlist specific origins; include MCP-specific headers (Mcp-Session-Id, Mcp-Protocol-Version) |
| Rate limiting + API key | Applying rate limits globally instead of per-key | Per-key limits prevent one user from affecting others; also have global limits as safety net |

## v1.4 Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Raw event count queries on usage_events | Dashboard load time >5s | Materialized views with scheduled refresh | >100K events (~2 months at 500 users) |
| No index on usage_events(created_at) | Time-range queries do sequential scans | Add `(created_at, skill_id, user_id)` composite index | >50K rows |
| In-memory search with JOIN for author name | Search latency >500ms | Extend tsvector to include author name, use SQL queries | >200 skills or adding any JOIN |
| API key validation hits DB on every tool call | 500+ concurrent users causes connection pool exhaustion | Cache validation result for 30s with immediate invalidation on revoke | >200 concurrent connections |
| Synchronous usage event writes in tool handlers | Tool call latency includes DB write time (20-50ms overhead) | Async event queue (fire-and-forget with retry) | Noticeable when tool calls should be <100ms |
| No database connection pooling for HTTP MCP | Each HTTP request creates new DB connection | Use shared connection pool (PgBouncer or Drizzle pool) | >50 concurrent HTTP connections |
| Single materialized view refresh for all dashboards | Long refresh blocks reads; stale data during refresh | Per-metric materialized views with staggered refresh schedules | >5 dashboard widgets |

## v1.4 Security Mistakes

Domain-specific security issues for MCP auth and employee analytics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full API keys in server logs | Key exposure via log aggregation systems | Log only key prefix (`rlk_...abc`); scrub Authorization headers from logs |
| API keys without expiration | Leaked keys grant permanent access | 90-day expiration with renewal reminders; automatic revocation of unused keys after 180 days |
| Storing API key hash with MD5 or SHA-1 | Rainbow table attacks on stolen hashes | Use bcrypt or argon2 for key hashing; store only hash, never plaintext |
| Same API key for all environments | Dev key leak compromises production | Separate keys per environment; prefix indicates env (`rlk_dev_`, `rlk_prod_`) |
| Tracking prompt content in usage events | PII/IP exposure; employee privacy violation | Track only tool name, skill ID, timestamp; NEVER log prompt content or user queries |
| HTTP MCP without TLS | Credentials transmitted in plaintext | Enforce HTTPS; reject HTTP connections; use HSTS header |
| No audit log for key operations | Cannot investigate security incidents | Log all key create/revoke/rotate events with actor, timestamp, IP |
| Admin can see individual employee usage without disclosure | Privacy law violation (GDPR, CCPA state analogs) | Employee consent; visible privacy notice; anonymized team-level aggregates for managers |

## v1.4 UX Pitfalls

Common user experience mistakes when adding auth and analytics.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring auth setup before any MCP usage | New users bounce at the config step | Allow anonymous browse/search; require auth only for tracking attribution |
| API key as only auth option (no SSO bridge) | Extra credential to manage; password fatigue | Generate API key through the web dashboard (already behind SSO); one-click "create key" |
| Dashboard visible only to admins | Employees can't see their own impact; reduces motivation | Self-service dashboard: employees see their usage, skills adopted, time saved |
| Team comparison leaderboards | Creates unhealthy competition; employees game metrics | Show absolute values ("Your team saved 14 days") not rankings ("Your team is 5th") |
| Migration notification only in the web UI | MCP users don't visit the web UI; they work in Claude Code | Send migration instructions via the MCP server itself: deprecation warning in tool responses |
| Install tracking without user feedback | Users don't know their install was recorded | Confirm in MCP tool response: "Installed successfully. This counts toward your team's adoption metrics." |
| Breaking change in MCP tools API | Existing automations and workflows break | Version MCP tools; deprecate old versions with warnings before removal |
| Dashboard showing "0 time saved" for new users | Discouraging; makes tool seem useless | Show onboarding message: "Use a skill via MCP to see your impact here" |

## v1.4 "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **API Key Auth:** Often missing key revocation -- verify revoking a key causes the NEXT MCP request to fail (not just future sessions)
- [ ] **API Key Auth:** Often missing key rotation -- verify old and new keys both work during the overlap period, then old key stops working
- [ ] **API Key Auth:** Often missing rate limiting per key -- verify one key being rate-limited doesn't affect other keys
- [ ] **Remote MCP HTTP:** Often missing Origin validation -- verify requests from `https://evil.com` Origin are rejected
- [ ] **Remote MCP HTTP:** Often missing session timeout -- verify idle sessions are cleaned up after 1 hour
- [ ] **Remote MCP HTTP:** Often missing CORS headers for MCP-specific headers -- verify `Mcp-Session-Id` and `Mcp-Protocol-Version` are in `Access-Control-Allow-Headers`
- [ ] **Usage Tracking:** Often missing async event writes -- verify tool call latency doesn't include event write time
- [ ] **Usage Tracking:** Often missing userId population -- verify EVERY usage event from authenticated MCP has a non-null userId
- [ ] **Dashboard:** Often missing materialized views -- verify dashboard queries hit pre-computed views, not raw events table
- [ ] **Dashboard:** Often missing null-userId handling -- verify dashboard gracefully shows "data available from [date]" for pre-auth period
- [ ] **Install Tracking:** Often missing deduplication -- verify reinstalling the same skill doesn't inflate the install count
- [ ] **Install Tracking:** Often missing activation distinction -- verify "installed" and "activated" are separate tracked states
- [ ] **Extended Search:** Often missing MCP parity -- verify search improvements work in BOTH web UI and MCP tools
- [ ] **Extended Search:** Often missing tsvector migration -- verify the searchVector column is updated to include author name
- [ ] **Privacy:** Often missing employee disclosure -- verify users can see exactly what data is tracked about them
- [ ] **Privacy:** Often missing data retention policy -- verify usage events older than the retention period are aggregated and raw data deleted

## v1.4 Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth breaks existing MCP users (#32) | HIGH | 1) Immediately revert to anonymous mode 2) Re-deploy with dual-transport 3) Communicate migration timeline 4) Provide automated migration tool |
| API key leaked in public repo (#33) | MEDIUM | 1) Revoke key immediately 2) Issue new key to affected user 3) Audit usage logs for unauthorized access 4) Enable GitHub secret scanning for `rlk_` prefix |
| Key revocation not working (#34) | HIGH | 1) Restart all MCP server instances to clear caches 2) Patch to check DB on every request 3) Audit what the revoked key accessed during the gap |
| Dashboard query performance (#42) | MEDIUM | 1) Kill long-running queries 2) Add `statement_timeout` 3) Create materialized views 4) Redirect dashboard to views |
| Inflated install numbers (#43) | LOW | 1) Run dedup script on existing events 2) Add unique constraint 3) Re-calculate affected metrics 4) Communicate corrected numbers |
| Employee trust crisis (#40) | HIGH | 1) Immediately publish what is/isn't tracked 2) Delete any data beyond the stated scope 3) Offer opt-out period 4) Get employee representatives involved |
| Remote MCP with no auth (#36) | CRITICAL | 1) Take endpoint offline immediately 2) Audit all requests for unauthorized access 3) Re-deploy with auth middleware 4) Rotate any API keys that may have been exposed |
| Rate limiting absent (#44) | MEDIUM | 1) Deploy emergency rate limiter at reverse proxy level 2) Block offending IPs 3) Implement per-key rate limiting 4) Investigate abuse scope |
| Historical data gap (#41) | LOW | 1) Accept the gap 2) Set attribution start date 3) Show appropriate messaging in UI 4) Focus on forward-looking metrics |
| Extended search regression (#48) | LOW | 1) Revert to previous search 2) Profile the new query 3) Fix with proper indexing 4) Re-deploy with benchmarks |

## v1.4 Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auth breaks existing users (#32) | Auth Infrastructure | Existing anonymous MCP still works after auth deploy; dual-transport test passes |
| API key leakage (#33) | Auth Infrastructure | Keys use env var references; `rlk_` prefix in GitHub secret scanning; no plaintext keys in configs |
| Key revocation delay (#34) | Auth Infrastructure | E2E test: revoke key, next request within 30s returns 401 |
| Stdio identity (#35) | Auth Infrastructure | API key in env var resolves to userId; all stdio usage_events have non-null userId |
| HTTP without auth (#36) | Remote MCP | Integration test: request without Authorization header returns 401 |
| Missing Origin validation (#37) | Remote MCP | Test: request with `Origin: https://evil.com` returns 403; legitimate origin succeeds |
| Session hijacking (#38) | Remote MCP | Session IDs are cryptographically random; sessions timeout after 1 hour |
| Claude.ai connector (#39) | Remote MCP | MCP works from both Claude Code CLI and Claude.ai web browser |
| Employee privacy (#40) | Analytics Design | Privacy notice visible in UI; no prompt content in events; employees see own data |
| Historical data gap (#41) | Auth Infrastructure + Analytics | Dashboard shows "User data from [date]"; no null userId in post-auth events |
| Dashboard query perf (#42) | Analytics Dashboard | Dashboard queries use materialized views; load time <2s with 6 months of data |
| Install inflation (#43) | Install Tracking | Events deduplicated; install + activation tracked separately; numbers match reality |
| Rate limiting (#44) | Remote MCP | 429 returned when limit exceeded; rate limit headers on every response |
| OAuth over-engineering (#45) | Auth Infrastructure | API keys working within 1 week; OAuth deferred to Claude.ai phase |
| Meaningless dashboard (#46) | Analytics Dashboard | Stakeholders can answer "What is Relay's ROI?" from the dashboard |
| Dual transport burden (#47) | Auth Infrastructure | Tool handlers are transport-agnostic; `getCurrentUser()` abstraction verified |
| Search regression (#48) | Extended Search | Search latency benchmarked before/after; tsvector includes author name |

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

### v1.4 MCP Authentication Sources (High Confidence)
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Spec Updates June 2025 - Auth0](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [MCP Auth Implementation Guide - Stytch](https://stytch.com/blog/MCP-authentication-and-authorization-guide/)
- [MCP Auth on Stack Overflow Blog](https://stackoverflow.blog/2026/01/21/is-that-allowed-authentication-and-authorization-in-model-context-protocol/)
- [MCP Bearer Auth Best Practices Discussion #1247](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1247)
- [MCP Auth Implementation - Logto](https://blog.logto.io/mcp-auth-implementation-guide-2025-06-18)
- [Migrate API Keys to OAuth for MCP - Scalekit](https://www.scalekit.com/blog/migrating-from-api-keys-to-oauth-mcp-servers)
- [MCP Bearer Auth Config - MCP Auth](https://mcp-auth.dev/docs/configure-server/bearer-auth)

### v1.4 Remote MCP / HTTP Transport Sources (High Confidence)
- [MCP Defaults Will Betray You - CardinalOps](https://cardinalops.com/blog/mcp-defaults-hidden-dangers-of-remote-deployment/)
- [MCP Streamable HTTP Security - Medium](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19)
- [MCP Transport Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Exposed MCP Servers - Bitsight](https://www.bitsight.com/blog/exposed-mcp-servers-reveal-new-ai-vulnerabilities)
- [CORS for MCP Web Servers - MCPcat](https://mcpcat.io/guides/implementing-cors-policies-web-based-mcp-servers/)
- [Apollo MCP Server CORS](https://www.apollographql.com/docs/apollo-mcp-server/cors)
- [Building Custom Connectors via Remote MCP - Claude Help Center](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Remote MCP Server Submission Guide - Claude Help Center](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
- [Claude Code Remote MCP - InfoQ](https://www.infoq.com/news/2025/06/anthropic-claude-remote-mcp/)
- [Implementing MCP Tips and Pitfalls - Nearform](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/)
- [MCP Streamable HTTP vs SSE - Auth0](https://auth0.com/blog/mcp-streamable-http/)

### v1.4 API Key Management Sources (High Confidence)
- [API Key Management Best Practices - Apidog](https://apidog.com/blog/api-key-management-best-practices/)
- [API Key Security Best Practices 2026 - DEV Community](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d)
- [API Key Management - Infisical](https://infisical.com/blog/api-key-management)
- [API Key Management - DigitalAPI](https://www.digitalapi.ai/blogs/api-key-management)
- [Claude API Key Best Practices](https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure)
- [Hardening OAuth Tokens - Clutch Events](https://www.clutchevents.co/resources/hardening-oauth-tokens-in-api-security-token-expiry-rotation-and-revocation-best-practices)

### v1.4 Employee Analytics / Privacy Sources (High Confidence)
- [Governance Risks for Employee Monitoring - Workplace Privacy Report](https://www.workplaceprivacyreport.com/2025/06/articles/artificial-intelligence/managing-the-managers-governance-risks-and-considerations-for-employee-monitoring-platforms/)
- [Employee Monitoring Privacy Laws - BusinessNewsDaily](https://www.businessnewsdaily.com/6685-employee-monitoring-privacy.html)
- [Employee Monitoring Disclosure Rules - WorkWise](https://www.workwisecompliance.com/blog/what-must-employers-disclose-when-monitoring-employees.html)
- [Data Privacy in Time Tracking - TimeLake](https://timelake.io/blog/time-tracking/data-privacy-and-security-in-employee-time-tracking-tools)
- [Employee Monitoring Dos and Don'ts - WorkTime](https://www.worktime.com/blog/employee-monitoring/dos-and-donts-when-implementing-employee-monitoring-software)
- [Compliance Laws for Remote Monitoring - Worklytics](https://www.worklytics.co/blog/key-compliance-laws-for-remote-employee-monitoring-data-protection)

### v1.4 Analytics Dashboard / PostgreSQL Sources (High Confidence)
- [PostgreSQL Analytics Tuning - Crunchy Data](https://www.crunchydata.com/blog/postgres-tuning-and-performance-for-analytics-data)
- [Real-time Analytics in Postgres - Timescale/Medium](https://medium.com/timescale/real-time-analytics-in-postgres-why-its-hard-and-how-to-solve-it-bd28fa7314c7)
- [Postgres for Analytics Workloads - Epsio](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips)
- [ClickHouse vs PostgreSQL 2026 - Tasrie IT](https://tasrieit.com/blog/clickhouse-vs-postgres-2026)
- [PostgreSQL as Real-Time Analytics - Tiger Data](https://www.tigerdata.com/learn/real-time-analytics-in-postgres)

### v1.4 Event Deduplication Sources (Medium Confidence)
- [Mixpanel Event Deduplication](https://developer.mixpanel.com/reference/event-deduplication)
- [GA4 Duplicate Events Fix - Analytify](https://analytify.io/fix-ga4-duplicate-events/)
- [Segment Identity Management](https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/identity/)
- [Segment Best Practices for Identifying Users](https://segment.com/docs/connections/spec/best-practices-identify/)

---
*Pitfalls research for: Internal skill marketplace / developer tool catalog*
*v1.0/v1.1 researched: 2026-01-31*
*v1.2 Table UI researched: 2026-02-01*
*v1.3 AI Features researched: 2026-02-02*
*v1.4 Employee Analytics & Remote MCP researched: 2026-02-05*
