# Phase 73: Community Discovery UI - Research

**Researched:** 2026-02-16
**Domain:** AI-generated community labeling, Next.js server components, community browse/detail pages
**Confidence:** HIGH

## Summary

Phase 73 builds three capabilities on top of the Phase 72 community detection infrastructure: (1) AI-generated community names and descriptions via the Anthropic SDK, (2) a discovery/browse page showing community cards, and (3) a detail page listing member skills with similarity scores.

The codebase already has a mature pattern for AI-generated content using `@anthropic-ai/sdk` ^0.72.1 with JSON schema structured outputs (see `apps/web/lib/ai-review.ts`, `apps/web/lib/skill-recommendations.ts`, `apps/web/lib/greeting-pool.ts`). The UI layer follows Next.js App Router server components with Tailwind CSS, and the project has established card-based browse patterns (CategoryTiles, TrendingSection, SkillCard) that the community pages should follow.

**Critical discovery:** The `community_label` column mentioned in Phase 72 planning was intentionally deferred -- it exists in neither the Drizzle schema file (`packages/db/src/schema/skill-communities.ts`) nor the database migration (`0040_create_skill_communities.sql`). Phase 73 must add new columns for community metadata before populating AI labels.

**Verified:** pgvector `AVG()` works on vector columns in the dev database -- centroid computation can be done entirely in SQL with no application-side vector math needed.

**Primary recommendation:** Add `community_label` and `community_description` TEXT columns to `skill_communities` via migration, create a community labeling service using Claude Haiku for cost efficiency, build server component pages at `/communities` and `/communities/[id]`, and integrate a community section on the dashboard.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.72.1 | AI label generation | Already used in 5+ places in codebase |
| drizzle-orm | 0.42.0 | DB queries for community data | Project ORM, all queries use it |
| next | 16.1.6 | Server components for browse/detail pages | Project framework |
| zod | (existing) | Validate AI structured output | Used in all existing AI integrations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector (via raw SQL) | existing | Compute centroid vectors via AVG(), similarity scores via <=> | Community detail page similarity calculations |

### No New Dependencies
This phase requires zero new packages. Everything is achievable with the existing stack.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/skill-communities.ts          # ADD: community_label, community_description columns
  services/community-labels.ts         # NEW: AI label generation + DB persistence
  services/community-queries.ts        # NEW: Browse/detail query functions
  migrations/0041_add_community_labels.sql  # NEW: ALTER TABLE migration

apps/web/
  app/(protected)/communities/
    page.tsx                            # NEW: Browse page (server component)
    [communityId]/page.tsx              # NEW: Detail page (server component)
  components/
    community-card.tsx                  # NEW: Card for browse grid
    community-skill-list.tsx            # NEW: Member skill list with similarity
  lib/
    community-label-generator.ts        # NEW: Anthropic SDK integration for labels
```

### Pattern 1: AI Label Generation (follows ai-review.ts pattern)
**What:** Use Anthropic Claude Haiku with JSON schema structured outputs to generate community labels
**When to use:** After community detection runs, or on-demand when communities lack labels
**Example:**
```typescript
// Source: Derived from apps/web/lib/ai-review.ts existing pattern
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const LABEL_MODEL = "claude-haiku-4-5-20251001"; // Cost-efficient for short outputs

const CommunityLabelSchema = z.object({
  name: z.string(),        // 2-5 word community name
  description: z.string(), // 1-2 sentence summary
});

const LABEL_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    description: { type: "string" as const },
  },
  required: ["name", "description"],
  additionalProperties: false,
};

// System prompt provides skill names + descriptions, asks for a community label
const SYSTEM_PROMPT = `You are naming clusters of related AI skills.
Given a list of skill names and descriptions that belong to the same community,
produce a short, descriptive community name (2-5 words, title case) and a
1-2 sentence summary of what these skills have in common.

The name should be specific enough to distinguish this community from others.
Avoid generic names like "Productivity Tools" — prefer names that capture
the shared workflow or domain, like "Code Review Automation" or "Data Pipeline Builders".`;
```

### Pattern 2: Server Component Browse Page (follows skills/page.tsx pattern)
**What:** Server component that fetches communities and renders a grid of cards
**When to use:** The `/communities` route
**Example:**
```typescript
// Source: Derived from apps/web/app/(protected)/skills/page.tsx pattern
import { auth } from "@/auth";
import { getCommunities } from "@everyskill/db/services/community-queries";

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) { /* redirect */ }

  const communities = await getCommunities(session.user.tenantId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Skill Communities</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((c) => (
          <CommunityCard key={c.communityId} community={c} />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 3: Community Detail Page with Centroid Similarity
**What:** Server component that shows all member skills ranked by similarity to community centroid
**When to use:** The `/communities/[communityId]` route
**Key query pattern:**
```sql
-- Compute centroid as average of all member skill embeddings
-- VERIFIED: pgvector AVG() works on vector columns (tested 2026-02-16)
WITH community_skills AS (
  SELECT sc.skill_id
  FROM skill_communities sc
  WHERE sc.tenant_id = $1
    AND sc.community_id = $2
),
centroid AS (
  SELECT AVG(se.embedding) AS center
  FROM skill_embeddings se
  WHERE se.skill_id IN (SELECT skill_id FROM community_skills)
    AND se.tenant_id = $1
)
SELECT
  s.id, s.name, s.slug, s.description, s.category,
  s.total_uses, s.average_rating,
  ROUND(100 * (1 - (se.embedding <=> c.center) / 2))::int AS similarity_pct
FROM community_skills cs
JOIN skills s ON s.id = cs.skill_id
JOIN skill_embeddings se ON se.skill_id = s.id AND se.tenant_id = $1
CROSS JOIN centroid c
WHERE s.status = 'published'
  AND s.visibility IN ('global_approved', 'tenant')
ORDER BY se.embedding <=> c.center ASC;
```

### Pattern 4: Dashboard Integration (follows existing section pattern)
**What:** Add a "Skill Communities" section to the dashboard between existing sections
**When to use:** Homepage at `apps/web/app/(protected)/page.tsx`
**Key consideration:** Keep it lightweight -- show community cards with a "View all" link. Do NOT add a main nav item (nav is at capacity with Home, Skills, Leverage, Portfolio, Profile, Admin). Instead link from dashboard section and optionally from the skills browse page.

### Anti-Patterns to Avoid
- **Storing labels only in the cron job:** Labels should be persisted in the database, not recomputed on every page load. AI calls are expensive and slow.
- **Creating a separate communities table:** The existing `skill_communities` table already groups skills by `community_id` within a tenant. Add columns to this table rather than creating a new metadata table. This is consistent with how `modularity` is already stored per-row with the same value for all rows in a community.
- **Client-side label generation:** Never call the Anthropic API from client components. All AI work must happen server-side, ideally in a service function or cron/action.
- **Using toLocaleString/toLocaleDateString in components:** This causes hydration mismatches. Use the existing `RelativeTime` component pattern or manual UTC formatting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output | Manual JSON parsing from Claude | `output_config.format.type: "json_schema"` | Guaranteed valid JSON, no parsing failures |
| Community centroid computation | Manual vector averaging in JS | `AVG(embedding)` in PostgreSQL (pgvector) | SQL is faster, no data transfer overhead. Verified working. |
| Similarity percentage display | Custom distance-to-percentage math | `ROUND(100 * (1 - (embedding <=> center) / 2))::int` | Existing pattern from similar-skills.ts |
| Card grid layout | Custom CSS grid | Tailwind `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` | Consistent with CategoryTiles, TrendingSection |
| Route protection | Custom auth checks | `auth()` + redirect pattern from existing pages | Consistent with all protected routes |

**Key insight:** The codebase already has every building block. The AI labeling pattern is established in ai-review.ts, the browse page pattern is in skills/page.tsx, the card pattern is in category-tiles.tsx, and the similarity display pattern is in similar-skills-section.tsx. This phase is primarily assembly.

## Common Pitfalls

### Pitfall 1: community_label Column Doesn't Exist Yet
**What goes wrong:** Writing code that references `skill_communities.community_label` without adding the column first will cause runtime errors.
**Why it happens:** Phase 72 research mentioned this column but it was intentionally deferred from the migration.
**How to avoid:** Create migration 0041 FIRST that adds `community_label TEXT` and `community_description TEXT` columns to `skill_communities`. Update the Drizzle schema to match. Run migration before any code that references these columns.
**Warning signs:** `column "community_label" does not exist` errors in DB queries.

### Pitfall 2: Duplicate Labels Across Rows
**What goes wrong:** The `skill_communities` table has one row per skill. If community_label is stored per-row, all rows for the same community_id must have the same label value.
**Why it happens:** The schema maps skills to communities, not communities to metadata.
**How to avoid:** Store label on every row in the community group and update all rows atomically. This is consistent with how `modularity` is already stored per-row with identical values across all rows in a community. When generating labels, UPDATE all rows with matching `(tenant_id, community_id)` in a single query.
**Warning signs:** Different labels for the same community_id within a tenant.

### Pitfall 3: AI Labeling Cost
**What goes wrong:** Calling Claude for every page load, or using an expensive model, creates unnecessary cost.
**Why it happens:** Not caching or persisting generated labels.
**How to avoid:** Generate labels once after community detection (in the cron job or a separate action), persist to DB, serve from cache. Use `claude-haiku-4-5-20251001` -- this is a short-output task (name + description), Haiku is sufficient and 10x cheaper than Sonnet.
**Warning signs:** High API bills, slow page loads, API rate limit errors.

### Pitfall 4: Hydration Mismatch on Dates
**What goes wrong:** Server and client render different date strings.
**Why it happens:** `toLocaleString()` produces different output in Node.js vs browser.
**How to avoid:** Serialize `detected_at` with `.toISOString()` before passing to client components. Use the existing `RelativeTime` component for display.
**Warning signs:** React hydration warnings in the console.

### Pitfall 5: Empty Communities (Test Data)
**What goes wrong:** Most communities in the current dev database contain test skills ("Hover Test", "E2E Test", "Hello World", "Dup Check"). AI labels for these would be nonsensical.
**Why it happens:** E2E tests create skills that get clustered.
**How to avoid:** The community detection already filters by `status = 'published'` and `visibility IN ('global_approved', 'tenant')`, but the dev data still contains test-generated published skills. The UI should handle small communities gracefully (e.g., hide communities with fewer than 2 skills, or show a fallback label).
**Warning signs:** Community labels like "Test Automation Cluster" that don't reflect real skill organization.

### Pitfall 6: Routing with Integer communityId
**What goes wrong:** Using `community_id` (integer) as a URL segment requires careful handling since Next.js params are strings.
**Why it happens:** `community_id` is an integer in the DB but a string in the URL.
**How to avoid:** Parse `params.communityId` with `parseInt()` and validate it's a valid number. Return `notFound()` for NaN values. The route should be `/communities/[communityId]` where communityId is the integer community_id, scoped to the user's tenant.
**Warning signs:** NaN errors, wrong community displayed.

### Pitfall 7: Community ID Instability Across Re-Detection
**What goes wrong:** After re-detection, community_id=0 might map to a completely different set of skills. Labels from the previous run become orphaned/wrong.
**Why it happens:** Louvain assigns community_id as 0, 1, 2, 3... and this resets on each run. The current implementation does `DELETE + INSERT` on re-detection, so old labels are naturally wiped.
**How to avoid:** After each re-detection run, regenerate ALL community labels. This is cheap (4 Haiku calls for 4 communities at ~$0.001 total). Labels stored per-row are atomically replaced with the DELETE+INSERT pattern already in `detectCommunities()`.
**Warning signs:** Stale labels that don't match community contents. Bookmarked community URLs leading to wrong communities.

## Code Examples

### Migration: Add Label Columns
```sql
-- 0041_add_community_labels.sql
ALTER TABLE skill_communities
  ADD COLUMN IF NOT EXISTS community_label TEXT,
  ADD COLUMN IF NOT EXISTS community_description TEXT;
```

### Schema Update: skill-communities.ts
```typescript
// Add to existing skillCommunities pgTable definition:
communityLabel: text("community_label"),
communityDescription: text("community_description"),
```

### Service: Get Communities with Counts
```typescript
// packages/db/src/services/community-queries.ts
import { db } from "../client";
import { sql } from "drizzle-orm";

export interface CommunityOverview {
  communityId: number;
  label: string | null;
  description: string | null;
  memberCount: number;
  topSkills: { name: string; slug: string; category: string }[];
  modularity: number;
}

export async function getCommunities(tenantId: string): Promise<CommunityOverview[]> {
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT
      sc.community_id,
      MAX(sc.community_label) AS label,
      MAX(sc.community_description) AS description,
      COUNT(*)::int AS member_count,
      MAX(sc.modularity) AS modularity,
      json_agg(
        json_build_object('name', s.name, 'slug', s.slug, 'category', s.category)
        ORDER BY s.total_uses DESC
      ) FILTER (WHERE s.status = 'published') AS top_skills
    FROM skill_communities sc
    JOIN skills s ON s.id = sc.skill_id
    WHERE sc.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
    GROUP BY sc.community_id
    ORDER BY member_count DESC
  `);

  return (rows as unknown as any[]).map((r) => ({
    communityId: Number(r.community_id),
    label: r.label,
    description: r.description,
    memberCount: Number(r.member_count),
    topSkills: (r.top_skills || []).slice(0, 3),
    modularity: Number(r.modularity),
  }));
}
```

### Service: Get Community Detail with Similarity Scores
```typescript
// packages/db/src/services/community-queries.ts (continued)
export interface CommunityDetail {
  communityId: number;
  label: string | null;
  description: string | null;
  modularity: number;
  skills: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    totalUses: number;
    averageRating: number | null;
    similarityPct: number;
  }[];
}

export async function getCommunityDetail(
  tenantId: string,
  communityId: number
): Promise<CommunityDetail | null> {
  if (!db) return null;

  const rows = await db.execute(sql`
    WITH community_skills AS (
      SELECT sc.skill_id
      FROM skill_communities sc
      WHERE sc.tenant_id = ${tenantId}
        AND sc.community_id = ${communityId}
    ),
    centroid AS (
      SELECT AVG(se.embedding) AS center
      FROM skill_embeddings se
      WHERE se.skill_id IN (SELECT skill_id FROM community_skills)
        AND se.tenant_id = ${tenantId}
    ),
    meta AS (
      SELECT
        MAX(sc.community_label) AS label,
        MAX(sc.community_description) AS description,
        MAX(sc.modularity) AS modularity
      FROM skill_communities sc
      WHERE sc.tenant_id = ${tenantId}
        AND sc.community_id = ${communityId}
    )
    SELECT
      s.id, s.name, s.slug, s.description, s.category,
      s.total_uses, s.average_rating,
      ROUND(100 * (1 - (se.embedding <=> c.center) / 2))::int AS similarity_pct,
      m.label, m.description AS community_description, m.modularity
    FROM community_skills cs
    JOIN skills s ON s.id = cs.skill_id
    JOIN skill_embeddings se ON se.skill_id = s.id AND se.tenant_id = ${tenantId}
    CROSS JOIN centroid c
    CROSS JOIN meta m
    WHERE s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
    ORDER BY se.embedding <=> c.center ASC
  `);

  if (rows.length === 0) return null;

  const first = rows[0] as any;
  return {
    communityId,
    label: first.label,
    description: first.community_description,
    modularity: Number(first.modularity),
    skills: (rows as unknown as any[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description),
      category: String(r.category),
      totalUses: Number(r.total_uses),
      averageRating: r.average_rating != null ? Number(r.average_rating) : null,
      similarityPct: Number(r.similarity_pct),
    })),
  };
}
```

### Service: AI Label Generation
```typescript
// apps/web/lib/community-label-generator.ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const LABEL_MODEL = "claude-haiku-4-5-20251001";

const CommunityLabelSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const LABEL_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    description: { type: "string" as const },
  },
  required: ["name", "description"],
  additionalProperties: false,
};

export async function generateCommunityLabel(
  skills: { name: string; description: string; category: string }[]
): Promise<{ name: string; description: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const skillList = skills
    .map((s) => `- ${s.name} (${s.category}): ${s.description.slice(0, 100)}`)
    .join("\n");

  const response = await client.messages.create({
    model: LABEL_MODEL,
    max_tokens: 256,
    system: `You name clusters of related AI automation skills. Given member skills,
produce a community name (2-5 words, title case) and 1-2 sentence description.
Be specific. Good: "Code Review Automation". Bad: "Productivity Tools".`,
    messages: [{
      role: "user",
      content: `Name this skill community:\n\n${skillList}`,
    }],
    output_config: {
      format: { type: "json_schema", schema: LABEL_JSON_SCHEMA },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in label response");
  }

  return CommunityLabelSchema.parse(JSON.parse(textBlock.text));
}
```

### Component: Community Card
```typescript
// apps/web/components/community-card.tsx
import Link from "next/link";
import type { CommunityOverview } from "@everyskill/db/services/community-queries";

export function CommunityCard({ community }: { community: CommunityOverview }) {
  return (
    <Link
      href={`/communities/${community.communityId}`}
      className="group block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
        {community.label || `Community ${community.communityId + 1}`}
      </h3>
      {community.description && (
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
          {community.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
        <span>{community.memberCount} skills</span>
      </div>
      {community.topSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {community.topSkills.map((skill) => (
            <span
              key={skill.slug}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {skill.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
```

### Existing Patterns Reference
| Pattern | Source File | What to Copy |
|---------|-----------|--------------|
| AI structured output | `apps/web/lib/ai-review.ts` | Client init, JSON schema, Zod validation, error handling |
| Card grid | `apps/web/components/category-tiles.tsx` | Grid layout, Link wrapper, hover states |
| Similarity display | `apps/web/components/similar-skills-section.tsx` | Percentage badge, hover popover |
| Browse page | `apps/web/app/(protected)/skills/page.tsx` | Auth, data fetching, layout |
| Detail page | `apps/web/app/(protected)/skills/[slug]/page.tsx` | Params handling, parallel data fetching, notFound() |
| Server action for mutation | `apps/web/app/actions/ai-review.ts` | "use server" pattern for triggering label generation |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON parsing from Claude | `output_config.format.type: "json_schema"` | SDK 0.70+ | Guaranteed valid JSON, no parsing failures |
| Server Actions for data fetching | Server components with direct DB access | Next.js 14+ (App Router) | Simpler, no action overhead for read-only pages |
| Vercel AI SDK | Direct Anthropic SDK | Project decision | Full control, no abstraction layer, already used throughout |

**No deprecated patterns apply.** The codebase is on current versions of all relevant libraries.

## Open Questions

1. **Where to trigger label generation**
   - What we know: Labels should be generated after community detection, not on every page load.
   - What's unclear: Whether to integrate into the existing cron job or create a separate action/endpoint.
   - Recommendation: Add label generation as a second step in the community-detection cron endpoint. After `detectCommunities()` returns, call a `generateAndPersistCommunityLabels()` function for all detected communities. This keeps it atomic and automatic. For initial setup / manual runs, also expose a server action that admins can trigger.

2. **Navigation placement**
   - What we know: The nav bar has: Home, Skills, Leverage, Portfolio, Profile, Admin.
   - What's unclear: Whether communities should get their own nav item or be a sub-section of Skills.
   - Recommendation: Do NOT add to the main nav -- it is at capacity. Add communities as: (1) a section on the dashboard, (2) a dedicated route at `/communities`, (3) an optional link from the skills browse page. This provides discovery without cluttering navigation.

3. **Community ID instability across re-detection**
   - What we know: Louvain assigns community_id as 0, 1, 2, 3... and this resets on each run. The existing `detectCommunities()` does `DELETE + INSERT` atomically.
   - What's unclear: Whether bookmarked community URLs will break after re-detection.
   - Recommendation: After each re-detection run, regenerate ALL community labels (cheap: ~4 Haiku calls). Accept that bookmarked URLs may show different content after re-detection -- this is acceptable since communities are ephemeral analytical groupings, not permanent entities. Document this in the UI with "Communities update periodically" messaging.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/skill-communities.ts` -- Current schema definition (no community_label column)
- `packages/db/src/migrations/0040_create_skill_communities.sql` -- Current migration (confirms no label column)
- `packages/db/src/services/community-detection.ts` -- Detection algorithm, data flow, DELETE+INSERT pattern
- `apps/web/lib/ai-review.ts` -- Established Anthropic SDK pattern with JSON schema
- `apps/web/lib/skill-recommendations.ts` -- Established Haiku integration pattern
- `apps/web/app/(protected)/skills/page.tsx` -- Browse page server component pattern
- `apps/web/app/(protected)/skills/[slug]/page.tsx` -- Detail page server component pattern
- `apps/web/components/category-tiles.tsx` -- Card grid UI pattern
- `apps/web/components/similar-skills-section.tsx` -- Similarity percentage display pattern
- `packages/db/src/lib/visibility.ts` -- Visibility filtering for queries
- `apps/web/app/(protected)/layout.tsx` -- Navigation structure (6 items, no room for more)

### Verified (HIGH confidence)
- pgvector `AVG()` on vector columns -- Tested live on dev database (2026-02-16), returns valid 768-dim vector
- Current community data: 4 communities with 20/19/15/37 members, modularity 0.697
- Database schema confirmed: 7 columns in skill_communities (no community_label, no community_description)

### Secondary (MEDIUM confidence)
- `apps/web/lib/similar-skills.ts` -- Centroid similarity SQL pattern (verified in codebase, similar but uses pre-stored embeddings rather than AVG centroid)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use, zero new dependencies
- Architecture: HIGH -- Every pattern is derived from existing codebase conventions
- Pitfalls: HIGH -- Verified through actual DB queries and code inspection
- pgvector AVG: HIGH -- Verified by runtime test on dev database

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable stack, no fast-moving dependencies)
