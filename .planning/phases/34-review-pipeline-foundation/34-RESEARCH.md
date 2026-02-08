# Phase 34: Review Pipeline Foundation - Research

**Researched:** 2026-02-08
**Domain:** Skill lifecycle state machine, query filtering, migration safety
**Confidence:** HIGH

## Summary

Phase 34 converts the EverySkill platform from auto-publishing to a gated review pipeline. Currently, skills are immediately published when created (both via web UI and MCP). The new system introduces a `status` column on the `skills` table with a state machine governing transitions: `draft -> pending_review -> ai_reviewed -> approved/rejected/changes_requested -> published`.

The core challenge is **surgical**: adding status-based filtering to 14+ query paths across 3 apps (web, MCP, DB services) without breaking existing published skills or leaking unpublished content. The migration must default existing skills to `published` for zero regression, while new skills default to `draft`.

**Primary recommendation:** Use a TEXT column with DEFAULT `'published'` for backward compatibility. Implement the state machine as a pure function lookup table. Add `status = 'published'` filters to all public-facing queries, and author/admin visibility checks to the skill detail page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema definition, query builder | Already in use, pgTable column addition |
| drizzle-kit | (current) | Migration generation | Already in use for migration workflow |
| zod | (current) | Validation for status transitions | Already used for input validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | (current) | `notFound()` for 404 on unauthorized access | Skill detail page access control |

### No New Dependencies
This phase requires zero new libraries. Everything is achievable with existing stack.

## Architecture Patterns

### Status Column Design

```typescript
// In packages/db/src/schema/skills.ts
// Add to skills table definition:
status: text("status").notNull().default("published"),
```

**Why TEXT not ENUM:** The project already uses TEXT columns for categorical data (category field). TEXT with application-level validation is simpler to evolve (adding new statuses doesn't require ALTER TYPE). Consistent with project patterns.

**Why DEFAULT 'published':** Backward compatibility. Existing rows get 'published' automatically. The migration is a single `ALTER TABLE ADD COLUMN ... DEFAULT 'published'` which PostgreSQL handles as a metadata-only change (no table rewrite for DEFAULT values in PG 11+).

### Valid Status Values
```typescript
const SKILL_STATUSES = [
  "draft",
  "pending_review",
  "ai_reviewed",
  "approved",
  "rejected",
  "changes_requested",
  "published",
] as const;

type SkillStatus = typeof SKILL_STATUSES[number];
```

### State Machine Pattern

Pure function lookup table -- no XState, no class hierarchy:

```typescript
// packages/db/src/services/skill-status.ts (new file)
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],              // Author can re-edit and resubmit
  changes_requested: ["draft"],     // Author can re-edit and resubmit
  published: [],                    // Terminal (for now)
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionSkillStatus(
  skillId: string,
  currentStatus: string,
  targetStatus: string,
  actorId: string
): { valid: boolean; error?: string } {
  if (!canTransition(currentStatus, targetStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
    };
  }
  return { valid: true };
}
```

### Query Filtering Strategy

There are **three categories** of query paths that need updating:

#### Category 1: Public Browsing (must filter `status = 'published'`)
These queries power search, browse, trending, leaderboard -- they must ONLY show published skills.

| File | Query Type | Filter Method |
|------|-----------|---------------|
| `apps/web/lib/search-skills.ts` | Drizzle `.from(skills)` | Add `eq(skills.status, 'published')` to conditions array |
| `apps/web/lib/similar-skills.ts` | Raw SQL `JOIN skills s` | Add `AND s.status = 'published'` to WHERE clauses (4 raw SQL blocks) |
| `apps/web/lib/trending.ts` | Raw SQL CTE | Add `AND s.status = 'published'` to JOIN condition |
| `apps/web/lib/leaderboard.ts` | Raw SQL CTE | Add `AND s.status = 'published'` to LEFT JOIN condition |
| `apps/web/lib/platform-stats.ts` | Drizzle `.from(skills)` | Already filters `isNotNull(skills.publishedVersionId)` -- add `eq(skills.status, 'published')` for defense-in-depth |
| `apps/web/lib/user-stats.ts` | Drizzle `.from(skills)` | Already filters `isNotNull(skills.publishedVersionId)` -- add `eq(skills.status, 'published')` |
| `apps/web/lib/my-leverage.ts` | Raw SQL | `getSkillsCreated`: add `AND s.status = 'published'` |
| `apps/web/lib/total-stats.ts` | Drizzle `.from(skills)` | Add `eq(skills.status, 'published')` to first query; second query joins via usage_events (already scoped) |
| `apps/web/lib/search-skills.ts` (`getAvailableTags`) | Raw SQL | Add `WHERE status = 'published'` |
| `packages/db/src/services/search-skills.ts` | Drizzle `.from(skills)` | Add `eq(skills.status, 'published')` to conditions |
| `packages/db/src/services/skill-forks.ts` | Drizzle `.from(skills)` / `db.query` | `getForkCount` and `getTopForks`: add status = 'published' filter so fork listings only show published forks |
| `apps/mcp/src/tools/list.ts` | `db.query.skills.findMany` | Filter results to only include `status === 'published'` |
| `apps/mcp/src/tools/deploy.ts` | `db.query.skills.findMany` | Filter results to only include `status === 'published'` |

#### Category 2: Skill Detail Page (conditional access)
| File | Current Behavior | New Behavior |
|------|-----------------|--------------|
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | Shows any skill or 404 | Show if published OR if current user is author OR if current user is admin; else `notFound()` |

#### Category 3: Author's Own Skills (no public status filter)
| File | Current Behavior | New Behavior |
|------|-----------------|--------------|
| `apps/web/app/(protected)/my-skills/page.tsx` | Shows all author's skills | Shows all author's skills WITH status badge -- no status filter needed |

### Recommended Project Structure Changes

```
packages/db/src/
  schema/skills.ts           # Add status column
  services/skill-status.ts   # NEW: state machine, transition logic
  migrations/0013_add_skill_status.sql  # NEW: migration

apps/web/
  lib/search-skills.ts       # Add status filter
  lib/similar-skills.ts      # Add status filter to raw SQL
  lib/trending.ts            # Add status filter
  lib/leaderboard.ts         # Add status filter
  lib/platform-stats.ts      # Add status filter (defense-in-depth)
  lib/user-stats.ts          # Add status filter
  lib/my-leverage.ts         # Add status filter to getSkillsCreated
  lib/total-stats.ts         # Add status filter
  app/actions/skills.ts      # Set status='draft' on create
  app/actions/submit-for-review.ts  # NEW: transition draft -> pending_review
  app/(protected)/skills/[slug]/page.tsx  # Access control
  app/(protected)/my-skills/page.tsx      # Add status badge display
  components/my-skills-list.tsx           # Add status badge

apps/mcp/src/tools/
  create.ts                  # Set status='draft', update response message
  list.ts                    # Add status filter
  search.ts                  # Filter via searchSkillsByQuery (fixed in DB service)
  deploy.ts                  # Add status filter
```

### Anti-Patterns to Avoid

- **Creating a separate `skill_pipeline_states` table:** The status column on the skills table IS the pipeline state. The existing `skill_reviews` table is advisory/AI-review data, NOT pipeline gating. Do not conflate them.
- **Using PostgreSQL ENUM for status:** Harder to evolve. TEXT with app-level validation is the project pattern.
- **Filtering in application code instead of SQL:** For MCP tools that use `db.query.skills.findMany()`, the filter happens in-memory today. Continue this pattern but add status filtering to the in-memory filter step. For Drizzle ORM queries, add the filter to the WHERE clause.
- **Forgetting `getAvailableTags()`:** This raw SQL query in `search-skills.ts` scans ALL skills for tag extraction. Must add status filter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine | Custom event-driven FSM or XState | Plain object lookup table | Only 7 states and simple transitions; overkill to add a library |
| Status validation | Runtime type checking | Zod enum + TypeScript literal union | Catches invalid values at compile time and runtime |
| Migration | Manual SQL + schema updates | drizzle-kit generate + manual SQL | Project uses hand-written SQL migrations with drizzle schema for type safety |

## Common Pitfalls

### Pitfall 1: Breaking Existing Skills
**What goes wrong:** Adding `status` column with DEFAULT 'draft' would make all existing skills disappear from search/browse.
**Why it happens:** Wrong default value in migration.
**How to avoid:** Migration MUST use `DEFAULT 'published'`. The Drizzle schema can specify `default("published")` but the migration SQL must also match. Verify with: `SELECT count(*) FROM skills WHERE status != 'published'` should return 0 after migration.
**Warning signs:** Zero skills showing after migration.

### Pitfall 2: Missing Query Path
**What goes wrong:** A forgotten query path leaks draft/pending skills to non-author users.
**Why it happens:** There are 14+ files with skill queries. Easy to miss one.
**How to avoid:** Comprehensive grep for all files touching the skills table. Verification query: create a draft skill, then check every page/endpoint that lists skills to confirm it's invisible.
**Warning signs:** Draft skills appearing in search results, leaderboard counts, platform stats.

### Pitfall 3: MCP `create_skill` Raw SQL Missing Status
**What goes wrong:** MCP create_skill uses `db.execute(sql\`INSERT INTO skills ...\`)` with explicit column list. If `status` isn't explicitly set to `'draft'`, it gets the column DEFAULT.
**Why it happens:** Raw SQL INSERT with explicit columns bypasses Drizzle defaults.
**How to avoid:** The column DEFAULT is `'published'` for backward compatibility. The MCP INSERT must explicitly set `status = 'draft'`. Similarly, web UI insert via Drizzle ORM must explicitly set `status: 'draft'`.
**Warning signs:** Skills created via MCP auto-publishing.

### Pitfall 4: Schema Default vs. Application Default Mismatch
**What goes wrong:** The DB column DEFAULT is 'published' (for migration safety), but application code should INSERT with 'draft'. If any code path relies on the column DEFAULT for new inserts, it auto-publishes.
**Why it happens:** Two different intents: migration safety (existing rows -> published) vs. new behavior (new rows -> draft).
**How to avoid:** Explicitly set `status: 'draft'` in every skill creation code path. Never rely on column DEFAULT for new skill creation. There are 3 creation paths: (1) `checkAndCreateSkill` in skills.ts, (2) `createSkill` in skills.ts, (3) `handleCreateSkill` in MCP create.ts. Plus (4) `forkSkill` in fork-skill.ts -- forks should also be draft (or handle separately per Phase 39 note).
**Warning signs:** Any INSERT into skills that doesn't explicitly set status.

### Pitfall 5: Skill Detail Page Access Control Race
**What goes wrong:** The skill detail page checks `session` after fetching the skill. If session check is async and skill fetch completes first, the page briefly loads before redirecting.
**Why it happens:** Server component renders sequentially.
**How to avoid:** Fetch session in parallel with skill data, then check access before rendering. Current code already calls `auth()` -- just move the access check before the render.
**Warning signs:** Flash of unpublished skill content to unauthorized users.

### Pitfall 6: `similar-skills.ts` Has 4 Separate Raw SQL Blocks
**What goes wrong:** Missing status filter on one of the 4 raw SQL query blocks in similar-skills.ts.
**Why it happens:** The file has `trySemanticSearch` (2 variants: with/without excludeSkillId), `trySemanticSearchBySkill`, and `checkSimilarSkills` ILIKE fallback -- each with separate SQL.
**How to avoid:** Audit all 4 SQL blocks. Each `JOIN skills s ON s.id = se.skill_id` needs `AND s.status = 'published'`. The ILIKE fallback query at line 168-186 also needs the filter.
**Warning signs:** Draft skills showing up as "similar" recommendations.

### Pitfall 7: Fork Creation Status
**What goes wrong:** Forks auto-publish because fork-skill.ts doesn't set status.
**Why it happens:** The phase description says "defer fork-specific logic to Phase 39" but forks still create skills.
**How to avoid:** Set `status: 'draft'` on fork creation in `fork-skill.ts`. Phase 39 can add more nuance later, but the safe default is draft.
**Warning signs:** Forked skills immediately visible in search.

## Code Examples

### Migration SQL (0013_add_skill_status.sql)
```sql
-- Add status column to skills table
-- DEFAULT 'published' ensures existing skills remain visible
-- New skills will explicitly set status='draft' in application code
ALTER TABLE skills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Index for efficient filtering on status
CREATE INDEX IF NOT EXISTS skills_status_idx ON skills (status);

-- Composite index for author + status queries (My Skills page)
CREATE INDEX IF NOT EXISTS skills_author_status_idx ON skills (author_id, status);
```

### Drizzle Schema Change
```typescript
// In packages/db/src/schema/skills.ts, add to table columns:
status: text("status").notNull().default("published"),
```

### State Machine Service
```typescript
// packages/db/src/services/skill-status.ts
export const SKILL_STATUSES = [
  "draft",
  "pending_review",
  "ai_reviewed",
  "approved",
  "rejected",
  "changes_requested",
  "published",
] as const;

export type SkillStatus = typeof SKILL_STATUSES[number];

const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],
  changes_requested: ["draft"],
  published: [],
};

export function canTransition(from: SkillStatus, to: SkillStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidTransitions(status: SkillStatus): SkillStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
```

### Adding Status Filter to Drizzle Queries
```typescript
// Pattern for Drizzle ORM queries (e.g., search-skills.ts):
import { eq } from "drizzle-orm";

// Add to conditions array:
conditions.push(eq(skills.status, "published"));
```

### Adding Status Filter to Raw SQL Queries
```typescript
// Pattern for raw SQL queries (e.g., trending.ts, leaderboard.ts):
// Before: JOIN skills s ON s.id = ue.skill_id
// After:  JOIN skills s ON s.id = ue.skill_id AND s.status = 'published'

// Or in WHERE clause:
// Before: WHERE ue.created_at >= NOW() - INTERVAL '7 days'
// After:  WHERE ue.created_at >= NOW() - INTERVAL '7 days' AND s.status = 'published'
```

### Skill Detail Page Access Control
```typescript
// In apps/web/app/(protected)/skills/[slug]/page.tsx:
// After fetching skill and session:

const isPublished = skill.status === "published";
const isAuthorOfSkill = session?.user?.id === skill.authorId;
const userIsAdmin = isAdmin(session);

if (!isPublished && !isAuthorOfSkill && !userIsAdmin) {
  notFound();
}
```

### MCP Create Tool Status Change
```typescript
// In apps/mcp/src/tools/create.ts:
// Change the INSERT SQL to include status:
await db.execute(sql`
  INSERT INTO skills (id, tenant_id, name, slug, description, category, content, hours_saved, author_id, tags, status)
  VALUES (${skillId}, ${tenantId}, ${name}, ${slug}, ${description}, ${category}, ${rawContent}, ${hoursSaved}, ${userId}, ${tagsJson}::jsonb, 'draft')
`);

// Update response message:
responseBody.message = `Skill "${name}" created as a draft. It will be visible after review and approval. You can check its status at https://${rootDomain}/my-skills`;
```

### MCP List Tool Status Filter
```typescript
// In apps/mcp/src/tools/list.ts:
// After fetching allResults, add status filter:
const publishedResults = tenantFiltered.filter(
  (s: { status?: string }) => s.status === "published" || s.status === undefined
);
```

### Submit for Review Action
```typescript
// apps/web/app/actions/submit-for-review.ts
"use server";
import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { eq, and } from "drizzle-orm";
import { canTransition } from "@everyskill/db/services/skill-status";
import { revalidatePath } from "next/cache";

export async function submitForReview(skillId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  if (!db) return { error: "Database not configured" };

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.authorId, session.user.id)),
    columns: { id: true, status: true },
  });

  if (!skill) return { error: "Skill not found" };

  if (!canTransition(skill.status as any, "pending_review")) {
    return { error: `Cannot submit for review from status '${skill.status}'` };
  }

  await db
    .update(skills)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(skills.id, skillId));

  revalidatePath("/my-skills");
  return { success: true };
}
```

### My Skills Page Status Badge
```typescript
// In apps/web/components/my-skills-list.tsx, add to MySkillItem:
export interface MySkillItem {
  // ... existing fields
  status: string;
}

// Status badge colors:
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  ai_reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  changes_requested: "bg-orange-100 text-orange-700",
  published: "bg-emerald-100 text-emerald-700",
};
```

## Comprehensive Query Audit

Every file that queries the `skills` table, categorized by required action:

### Must Add `status = 'published'` Filter (Public Queries)
1. **`apps/web/lib/search-skills.ts`** - `searchSkills()`: Drizzle query, add to conditions
2. **`apps/web/lib/search-skills.ts`** - `getAvailableTags()`: Raw SQL, add WHERE clause
3. **`apps/web/lib/similar-skills.ts`** - `trySemanticSearch()` (2 SQL variants): Raw SQL JOINs
4. **`apps/web/lib/similar-skills.ts`** - `trySemanticSearchBySkill()`: Raw SQL JOIN
5. **`apps/web/lib/similar-skills.ts`** - `checkSimilarSkills()` ILIKE fallback: Drizzle query
6. **`apps/web/lib/similar-skills.ts`** - `findSimilarSkillsByName()` ILIKE fallback: Drizzle query
7. **`apps/web/lib/trending.ts`** - `getTrendingSkills()`: Raw SQL CTE
8. **`apps/web/lib/leaderboard.ts`** - `getLeaderboard()`: Raw SQL CTE
9. **`apps/web/lib/platform-stats.ts`** - `getPlatformStats()`: Drizzle queries (3 parallel)
10. **`apps/web/lib/user-stats.ts`** - `getUserStats()`: Drizzle query
11. **`apps/web/lib/my-leverage.ts`** - `getSkillsCreated()`: Raw SQL
12. **`apps/web/lib/my-leverage.ts`** - `getSkillsCreatedStats()`: Raw SQL
13. **`apps/web/lib/total-stats.ts`** - `getTotalStats()`: Drizzle query (first query)
14. **`packages/db/src/services/search-skills.ts`** - `searchSkillsByQuery()`: Drizzle query (used by MCP search)
15. **`packages/db/src/services/skill-forks.ts`** - `getForkCount()`: Drizzle query
16. **`packages/db/src/services/skill-forks.ts`** - `getTopForks()`: Drizzle relational query
17. **`apps/mcp/src/tools/list.ts`** - `handleListSkills()`: Drizzle relational query
18. **`apps/mcp/src/tools/deploy.ts`** - `handleDeploySkill()`: Drizzle relational query

### Must Add Access Control (Conditional Visibility)
19. **`apps/web/app/(protected)/skills/[slug]/page.tsx`** - Show if published OR author OR admin

### Must Explicitly Set `status = 'draft'` on Creation
20. **`apps/web/app/actions/skills.ts`** - `checkAndCreateSkill()`: Drizzle insert
21. **`apps/web/app/actions/skills.ts`** - `createSkill()`: Drizzle insert
22. **`apps/mcp/src/tools/create.ts`** - `handleCreateSkill()`: Raw SQL INSERT
23. **`apps/web/app/actions/fork-skill.ts`** - `forkSkill()`: Drizzle insert

### Must Show Status Badge (Author View)
24. **`apps/web/app/(protected)/my-skills/page.tsx`** - Add status to query + display
25. **`apps/web/components/my-skills-list.tsx`** - Add status badge

### No Change Needed (Already Scoped or Irrelevant)
- **`apps/web/lib/skill-stats.ts`** - Queries by specific skillId (OK -- detail page handles access)
- **`apps/web/lib/skill-detail-trends.ts`** - Queries by specific skillId (OK)
- **`apps/web/lib/usage-trends.ts`** - Queries by specific skillIds passed from search (already filtered upstream)
- **`apps/web/lib/platform-stat-trends.ts`** - Joins via usage_events to skills (only counts actual usage, which only published skills have)
- **`apps/web/lib/my-leverage.ts`** - `getSkillsUsed()` and `getSkillsUsedStats()`: Queries usage_events by userId (OK -- usage only exists for published skills)
- **`packages/db/src/services/usage-tracking.ts`** - Lookup by specific skillId (OK)
- **`packages/db/src/services/skill-merge.ts`** - Admin operation by specific skillId (OK)
- **`apps/web/lib/quality-score.ts`** - Pure function, no DB queries

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-publish on create | Draft status on create | Phase 34 | Skills invisible until approved |
| No status column | TEXT status column | Phase 34 | All queries must filter |
| Single My Skills view | My Skills with status badges | Phase 34 | Authors see pipeline state |

## Open Questions

1. **Should `approved -> published` be automatic or manual?**
   - What we know: The state machine has `approved` as separate from `published`. In Phase 34, there's no admin approval UI yet -- that's Phase 35+.
   - What's unclear: Whether Phase 34 needs a manual "publish" step after approval, or if approval auto-publishes.
   - Recommendation: For Phase 34, only implement `draft -> pending_review` as the author-triggered transition. The rest of the pipeline (pending_review -> ai_reviewed -> approved -> published) can be triggered manually via DB or admin panel in future phases. Phase 34 focuses on the foundation.

2. **Should `submit_for_review` be an MCP tool?**
   - What we know: MCP `create_skill` already exists. Authors might want to submit from CLI.
   - What's unclear: Whether this is Phase 34 scope or later.
   - Recommendation: Defer to later phase. The MCP create tool already creates as draft. Web UI "Submit for Review" button is sufficient for Phase 34.

3. **Fork status assignment**
   - What we know: Phase description says "defer fork-specific logic to Phase 39".
   - What's unclear: Should forks be `draft` (safe default) or something else?
   - Recommendation: Set to `draft` -- safest. Phase 39 can change this.

## Sources

### Primary (HIGH confidence)
- Codebase audit of all 25 files touching skills table
- `packages/db/src/schema/skills.ts` - current schema
- `packages/db/src/migrations/` - migration pattern (0011 for reference)
- All query files listed in Comprehensive Query Audit section

### Secondary (MEDIUM confidence)
- PostgreSQL documentation on ALTER TABLE ADD COLUMN DEFAULT behavior (metadata-only in PG 11+)
- Drizzle ORM `.default()` behavior from existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, existing patterns
- Architecture: HIGH - comprehensive codebase audit of all query paths
- State machine design: HIGH - simple lookup table, well-understood pattern
- Migration safety: HIGH - DEFAULT 'published' strategy verified against existing patterns
- Query audit completeness: HIGH - grepped all files, identified 25 touchpoints
- Pitfalls: HIGH - identified from direct code analysis

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable domain, no external dependencies)
