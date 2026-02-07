# Phase 6: Discovery - Research

**Researched:** 2026-01-31
**Domain:** Full-text search, skill browsing, data visualization
**Confidence:** HIGH

## Summary

Phase 6 implements skill discovery through search, browse, and filter functionality. The research identified PostgreSQL's built-in full-text search as the optimal approach, eliminating the need for external search infrastructure. Combined with Drizzle ORM's native support for `to_tsvector`/`to_tsquery` and GIN indexes, search queries can achieve millisecond response times without additional services.

For URL state management, nuqs provides type-safe search parameter handling that integrates seamlessly with Next.js App Router server components. Sparkline visualization for FTE Days Saved trends is best implemented with react-sparklines, a lightweight SVG-based library.

**Primary recommendation:** Use PostgreSQL full-text search with generated tsvector column and GIN index. Manage search/filter state via nuqs for shareable URLs. Render sparklines with react-sparklines.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.38.0 | PostgreSQL full-text search via sql template | Already in stack, native FTS support |
| nuqs | ^2.x | URL search params state management | Type-safe, 6kB, RSC-compatible |
| react-sparklines | ^1.7.0 | Sparkline visualization | Simple API, SVG-based, responsive |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL GIN index | Built-in | Fast full-text search | Always for FTS columns |
| tsvector generated column | Built-in | Pre-computed search vectors | For search performance |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL FTS | Algolia/Elasticsearch | External service, cost, but better for massive scale |
| nuqs | Native useSearchParams | Less type-safe, more boilerplate |
| react-sparklines | recharts | Larger bundle, more features than needed |

**Installation:**
```bash
pnpm add nuqs react-sparklines
pnpm add -D @types/react-sparklines
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/
│   └── (protected)/
│       └── skills/
│           ├── page.tsx           # Browse/search page (server component)
│           └── search-client.tsx  # Client component for search input
├── components/
│   ├── skill-card.tsx             # Skill preview card with sparkline
│   ├── skill-list.tsx             # Grid/list of skill cards
│   ├── search-input.tsx           # Search input with debounce
│   ├── category-filter.tsx        # Category browsing tabs
│   ├── tag-filter.tsx             # Tag filter chips
│   ├── sparkline.tsx              # FTE Days Saved sparkline wrapper
│   └── empty-state.tsx            # No results guidance
└── lib/
    └── search-skills.ts           # Server-side search logic
packages/db/
└── src/
    └── schema/
        └── skills.ts              # Add searchVector generated column
```

### Pattern 1: PostgreSQL Full-Text Search with Generated Column
**What:** Pre-compute tsvector in database, query with `@@` operator
**When to use:** Always for text search across name, description, tags
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns
import { pgTable, text, tsvector, index } from "drizzle-orm/pg-core";
import { sql, SQL } from "drizzle-orm";

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Generated column for full-text search
  searchVector: tsvector("search_vector")
    .generatedAlwaysAs((): SQL =>
      sql`setweight(to_tsvector('english', ${skills.name}), 'A') ||
          setweight(to_tsvector('english', ${skills.description}), 'B')`
    ),
}, (table) => [
  index("skills_search_idx").using("gin", table.searchVector),
]);

// Query pattern
const results = await db.select()
  .from(skills)
  .where(sql`${skills.searchVector} @@ websearch_to_tsquery('english', ${query})`)
  .orderBy(sql`ts_rank(${skills.searchVector}, websearch_to_tsquery('english', ${query})) DESC`);
```

### Pattern 2: URL State with nuqs
**What:** Sync search/filter state to URL for shareable links and back/forward navigation
**When to use:** Search query, category filter, tag filters, pagination
**Example:**
```typescript
// Source: https://nuqs.dev/
'use client'
import { useQueryState, parseAsString, parseAsArrayOf, parseAsStringEnum } from 'nuqs'

const categories = ['prompt', 'workflow', 'agent', 'mcp'] as const;

export function SearchFilters() {
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [category, setCategory] = useQueryState('category',
    parseAsStringEnum(categories).withDefault(null));
  const [tags, setTags] = useQueryState('tags',
    parseAsArrayOf(parseAsString).withDefault([]));

  return (/* filter UI */);
}
```

### Pattern 3: Server Component Search Page
**What:** Server component fetches data based on searchParams, client components handle input
**When to use:** Main skills browse page
**Example:**
```typescript
// app/(protected)/skills/page.tsx
import { searchSkills } from '@/lib/search-skills';
import { SkillList } from '@/components/skill-list';
import { SearchClient } from './search-client';

interface Props {
  searchParams: Promise<{ q?: string; category?: string; tags?: string }>;
}

export default async function SkillsPage({ searchParams }: Props) {
  const params = await searchParams;
  const skills = await searchSkills({
    query: params.q,
    category: params.category,
    tags: params.tags?.split(','),
  });

  return (
    <div>
      <SearchClient />
      <SkillList skills={skills} />
    </div>
  );
}
```

### Pattern 4: Sparkline Data Aggregation
**What:** Aggregate usage events by day for sparkline visualization
**When to use:** FTE Days Saved trend on skill cards
**Example:**
```typescript
// Source: PostgreSQL date_trunc + group by pattern
import { sql, eq, desc, and, gte } from 'drizzle-orm';

export async function getSkillUsageTrend(skillId: string, days: number = 14) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const dailyUses = await db.select({
    date: sql<string>`date_trunc('day', ${usageEvents.createdAt})::date`,
    count: sql<number>`count(*)::integer`,
  })
  .from(usageEvents)
  .where(and(
    eq(usageEvents.skillId, skillId),
    gte(usageEvents.createdAt, startDate)
  ))
  .groupBy(sql`date_trunc('day', ${usageEvents.createdAt})`)
  .orderBy(sql`date_trunc('day', ${usageEvents.createdAt})`);

  // Fill gaps for missing days
  return fillMissingDays(dailyUses, days);
}
```

### Anti-Patterns to Avoid
- **Client-side search:** Never load all skills to client and filter there. Use server-side PostgreSQL FTS.
- **LIKE queries for search:** Use FTS operators (`@@`) not `LIKE '%term%'` - LIKE cannot use indexes effectively.
- **No debounce on search input:** Always debounce search input (300-500ms) to avoid excessive queries.
- **Blocking search on typing:** Use React transitions or streaming for responsive UX during search.
- **Hardcoded categories:** Use the existing category enum from schema, not duplicate constants.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | String.includes() filtering | PostgreSQL FTS | Stemming, ranking, accents, GIN indexes |
| URL state sync | Manual searchParams parsing | nuqs | Type-safe, history support, SSR-compatible |
| Sparkline charts | Custom SVG paths | react-sparklines | Responsive, tested, simple API |
| Search debounce | setTimeout chains | useDeferredValue or library | Race conditions, cleanup |
| Empty state design | Plain "No results" text | Structured EmptyState component | Guides user action, consistent UX |

**Key insight:** PostgreSQL FTS eliminates the need for Algolia/Elasticsearch in most applications. It handles stemming (run/running/runs), ranking by relevance, weighted fields, and phrase matching out of the box.

## Common Pitfalls

### Pitfall 1: Missing GIN Index
**What goes wrong:** Full-text search becomes slow as data grows
**Why it happens:** Developers add tsvector column but forget the index
**How to avoid:** Always create GIN index on searchVector column in schema definition
**Warning signs:** Search queries taking > 100ms, high CPU on search

### Pitfall 2: Search Vector Not Updated
**What goes wrong:** Search results don't include newly added/updated skills
**Why it happens:** Using regular column instead of generated column
**How to avoid:** Use `generatedAlwaysAs()` for automatic updates
**Warning signs:** Recent skills missing from search results

### Pitfall 3: N+1 Queries for Sparklines
**What goes wrong:** Loading 20 skills causes 20+ database queries for usage trends
**Why it happens:** Fetching sparkline data separately per skill
**How to avoid:** Batch fetch usage trends for all displayed skills in single query
**Warning signs:** Skills page takes seconds to load, database connection pool exhausted

### Pitfall 4: Search State Lost on Navigation
**What goes wrong:** User loses search/filter state when clicking skill and going back
**Why it happens:** Using component state instead of URL params
**How to avoid:** Use nuqs to persist all filter state in URL
**Warning signs:** Users complaining about lost search after viewing skill

### Pitfall 5: Empty State Without Guidance
**What goes wrong:** Users don't know what to do when no results found
**Why it happens:** Simple "No results" message without actionable guidance
**How to avoid:** Implement structured empty states with suggestions (broaden search, browse categories, clear filters)
**Warning signs:** Users abandoning search, support tickets about "broken search"

## Code Examples

Verified patterns from official sources:

### Full-Text Search Query
```typescript
// Source: https://orm.drizzle.team/docs/guides/postgresql-full-text-search
import { sql } from 'drizzle-orm';

export async function searchSkills(query: string, category?: string, tags?: string[]) {
  if (!db) return [];

  let baseQuery = db.select({
    id: skills.id,
    name: skills.name,
    slug: skills.slug,
    description: skills.description,
    category: skills.category,
    totalUses: skills.totalUses,
    averageRating: skills.averageRating,
    hoursSaved: skills.hoursSaved,
    author: {
      id: users.id,
      name: users.name,
      image: users.image,
    },
  })
  .from(skills)
  .leftJoin(users, eq(skills.authorId, users.id));

  const conditions = [];

  if (query && query.trim()) {
    conditions.push(
      sql`${skills.searchVector} @@ websearch_to_tsquery('english', ${query})`
    );
  }

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  // Tag filtering would use skills.metadata->'tags' @> to_jsonb(${tags})

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions));
  }

  // Order by relevance when searching, by uses otherwise
  if (query && query.trim()) {
    return baseQuery.orderBy(
      sql`ts_rank(${skills.searchVector}, websearch_to_tsquery('english', ${query})) DESC`
    );
  }

  return baseQuery.orderBy(desc(skills.totalUses));
}
```

### Skill Card Component with Sparkline
```typescript
// Source: https://github.com/borisyankov/react-sparklines
import { Sparklines, SparklinesLine } from 'react-sparklines';
import { formatRating } from '@everyskill/db';

interface SkillCardProps {
  skill: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    totalUses: number;
    averageRating: number | null;
    hoursSaved: number | null;
    author: { name: string | null; image: string | null } | null;
  };
  usageTrend: number[]; // Daily usage counts for sparkline
}

export function SkillCard({ skill, usageTrend }: SkillCardProps) {
  const fteDaysSaved = (skill.totalUses * (skill.hoursSaved ?? 1)) / 8;

  return (
    <Link href={`/skills/${skill.slug}`} className="block rounded-lg border p-4 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs uppercase text-blue-600">{skill.category}</span>
          <h3 className="font-semibold">{skill.name}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{skill.description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <span>{skill.totalUses} uses</span>
        <span>{formatRating(skill.averageRating) ?? 'N/A'}</span>
        <div className="flex items-center gap-1">
          <span>{fteDaysSaved.toFixed(1)} days</span>
          <Sparklines data={usageTrend} width={60} height={20}>
            <SparklinesLine color="#3b82f6" />
          </Sparklines>
        </div>
      </div>

      {skill.author && (
        <p className="mt-2 text-xs text-gray-500">by {skill.author.name}</p>
      )}
    </Link>
  );
}
```

### Empty State Component
```typescript
// Source: Shopify Polaris empty state pattern
interface EmptyStateProps {
  type: 'no-results' | 'no-skills' | 'empty-category';
  query?: string;
  category?: string;
  onClearFilters?: () => void;
}

export function EmptyState({ type, query, category, onClearFilters }: EmptyStateProps) {
  const content = {
    'no-results': {
      title: 'No skills found',
      description: query
        ? `We couldn't find any skills matching "${query}"`
        : 'Try adjusting your filters',
      action: onClearFilters ? { label: 'Clear filters', onClick: onClearFilters } : null,
      suggestions: ['Try different keywords', 'Browse by category', 'Check spelling'],
    },
    'no-skills': {
      title: 'No skills yet',
      description: 'Be the first to share a skill with your team',
      action: { label: 'Share a skill', href: '/skills/new' },
      suggestions: null,
    },
    'empty-category': {
      title: `No ${category} skills`,
      description: `There are no skills in the ${category} category yet`,
      action: { label: 'Share a skill', href: '/skills/new' },
      suggestions: ['Try another category', 'Search for related skills'],
    },
  };

  const { title, description, action, suggestions } = content[type];

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <SearchIcon className="h-12 w-12 text-gray-400" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-gray-600">{description}</p>

      {action && (
        action.href ? (
          <Link href={action.href} className="mt-4 btn-primary">{action.label}</Link>
        ) : (
          <button onClick={action.onClick} className="mt-4 btn-secondary">{action.label}</button>
        )
      )}

      {suggestions && (
        <ul className="mt-4 text-sm text-gray-500">
          {suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}
```

### nuqs Layout Setup
```typescript
// Source: https://github.com/47ng/nuqs
// app/layout.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE queries | PostgreSQL FTS with tsvector | Long established | 100x+ faster with GIN index |
| External search (Algolia) | Built-in PostgreSQL FTS | 2023+ | Zero infrastructure, cost savings |
| Client search params | nuqs URL state | 2024 | Type-safe, SSR-compatible |
| Chart.js sparklines | SVG-based react-sparklines | 2020+ | Smaller bundle, simpler API |

**Deprecated/outdated:**
- String matching with LIKE: Use `@@` operator with tsvector for proper full-text search
- Manual searchParams parsing: nuqs handles serialization, history, and types

## Open Questions

Things that couldn't be fully resolved:

1. **Tag Storage Format**
   - What we know: Prior decision says "tags stored as text array in skills.metadata"
   - What's unclear: Whether to migrate to dedicated tags table for better indexing
   - Recommendation: Start with JSONB array in metadata, add GIN index on metadata->'tags'. Migrate to table if query patterns require it.

2. **Sparkline Data Granularity**
   - What we know: Need daily usage data for trend visualization
   - What's unclear: How many days to show (7, 14, 30?) and aggregation strategy
   - Recommendation: Default to 14 days, aggregate on demand initially. If performance becomes issue, add materialized view.

3. **Search Result Limit**
   - What we know: Need pagination for large result sets
   - What's unclear: Offset vs cursor pagination for this use case
   - Recommendation: Start with offset pagination (simpler), switch to cursor if performance degrades at scale.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM PostgreSQL Full-Text Search](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) - Schema, query patterns, GIN indexes
- [Drizzle ORM Generated Columns](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) - Auto-updating search vectors
- [nuqs GitHub](https://github.com/47ng/nuqs) - Installation, Next.js setup, API
- [react-sparklines GitHub](https://github.com/borisyankov/react-sparklines) - Component API, examples

### Secondary (MEDIUM confidence)
- [PostgreSQL Full-Text Search Next.js Tutorial](https://medium.com/@nanocrafts199/using-postgres-full-text-search-on-a-next-js-fullstack-app-8eea4a51979a) - Real-world integration patterns (Jan 2026)
- [nuqs Documentation Site](https://nuqs.dev/) - Official docs, feature overview
- [Empty State Best Practices](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/) - UX patterns for empty states

### Tertiary (LOW confidence)
- Web search results for sparkline libraries - validated with GitHub README

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Drizzle official docs, established PostgreSQL patterns
- Architecture: HIGH - Next.js App Router patterns well-documented, nuqs official docs
- Pitfalls: MEDIUM - Based on general FTS knowledge and common Next.js issues

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain)
