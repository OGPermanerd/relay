# Phase 71: Temporal Tracking - Research

**Researched:** 2026-02-16
**Domain:** User-skill interaction tracking, change detection, "what's new" feed
**Confidence:** HIGH

## Summary

Phase 71 adds temporal awareness so users can see what changed in skills since they last looked. The feature requires four pieces: (1) a new `user_skill_views` table that records when each user last viewed each skill, (2) an "Updated" badge on skill cards when the skill changed since the user's last view, (3) a change summary section on the skill detail page, and (4) a "What's New" feed on the dashboard.

The key insight from the v7.0 research is that this does NOT require bi-temporal schema changes to `skill_versions`. The Out of Scope decision explicitly states: "Full bi-temporal database schema -- Lightweight interaction tracking table sufficient; full temporal tables are massive migration." The entire feature can be built with a single new table (`user_skill_views`) plus queries that compare `skills.updatedAt` against `user_skill_views.lastViewedAt`.

**Primary recommendation:** Create a single `user_skill_views` table with UPSERT pattern, record views on skill detail page load, and compute change diffs by comparing the user's last-viewed version number against the current published version. No changes to `skill_versions` schema are needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.42.0 | Schema definition, queries, migrations | Already in use for all 25+ tables |
| PostgreSQL | 16 | Database with RLS policies | Existing infrastructure |
| Next.js | 16.1.6 | Server components, server actions | Existing app framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Validate server action inputs | View recording action validation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `user_skill_views` table | Extend `usage_events` table | `usage_events` tracks MCP tool invocations (different event type). A dedicated table is cleaner, has proper unique constraint, and avoids polluting analytics |
| UPSERT on each page view | Write-through cache | Extra complexity; UPSERT is one atomic operation, fast with unique index |
| Full bi-temporal columns on `skill_versions` | Application-time columns (valid_from/valid_to) | OUT OF SCOPE per requirements. Lightweight interaction table is sufficient |

**Installation:**
```bash
# No new packages needed -- all dependencies already exist
```

## Architecture Patterns

### Recommended Project Structure

```
packages/db/src/
  schema/
    user-skill-views.ts          # NEW: user_skill_views table definition
  services/
    user-skill-views.ts          # NEW: UPSERT view, get views, what's new queries
  migrations/
    0039_create_user_skill_views.sql  # NEW: table + indexes + RLS

apps/web/
  app/actions/
    skill-views.ts               # NEW: server action to record view
  app/(protected)/skills/[slug]/
    page.tsx                     # MODIFIED: record view, show change summary
  app/(protected)/
    page.tsx                     # MODIFIED: add "What's New" section
  components/
    updated-badge.tsx            # NEW: "Updated" badge component
    change-summary.tsx           # NEW: change summary section
    whats-new-feed.tsx           # NEW: dashboard "What's New" widget
  lib/
    change-detection.ts          # NEW: compute what changed since last view
```

### Pattern 1: Lightweight Interaction Tracking Table

**What:** A single table that records the last time each user viewed each skill, plus the version number they saw.
**When to use:** When you need "what changed since your last visit" without full temporal tables.

```sql
-- Source: v7.0 Research FEATURES.md pattern, adapted for this codebase
CREATE TABLE user_skill_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_version INTEGER,          -- version number at time of viewing
  view_count INTEGER NOT NULL DEFAULT 1, -- total times viewed (for TEMP-04 relevance)
  UNIQUE(tenant_id, user_id, skill_id)
);

CREATE INDEX user_skill_views_user_id_idx ON user_skill_views(user_id);
CREATE INDEX user_skill_views_skill_id_idx ON user_skill_views(skill_id);
CREATE INDEX user_skill_views_tenant_id_idx ON user_skill_views(tenant_id);
-- Composite for "What's New" query: find user's viewed skills that have been updated
CREATE INDEX user_skill_views_user_last_viewed_idx
  ON user_skill_views(user_id, last_viewed_at);
```

### Pattern 2: UPSERT on Page View (Fire-and-Forget)

**What:** Record or update the user's view of a skill when they load the detail page.
**When to use:** Every time `/skills/[slug]` renders for an authenticated user.

```typescript
// packages/db/src/services/user-skill-views.ts
import { db } from "../client";
import { userSkillViews } from "../schema/user-skill-views";
import { eq, and, sql } from "drizzle-orm";

export async function recordSkillView(
  tenantId: string,
  userId: string,
  skillId: string,
  currentVersion: number | null
): Promise<void> {
  if (!db) return;

  await db
    .insert(userSkillViews)
    .values({
      tenantId,
      userId,
      skillId,
      lastViewedAt: new Date(),
      lastViewedVersion: currentVersion,
      viewCount: 1,
    })
    .onConflictDoUpdate({
      target: [userSkillViews.tenantId, userSkillViews.userId, userSkillViews.skillId],
      set: {
        lastViewedAt: new Date(),
        lastViewedVersion: currentVersion,
        viewCount: sql`${userSkillViews.viewCount} + 1`,
      },
    });
}
```

**Calling pattern in page.tsx (fire-and-forget):**
```typescript
// In the skill detail page server component, after fetching skill:
if (session?.user?.id && session.user.tenantId) {
  // Determine current version number
  const currentVersion = skill.publishedVersionId
    ? await getVersionNumber(skill.publishedVersionId)
    : null;

  // Fire-and-forget: don't block page render
  recordSkillView(
    session.user.tenantId,
    session.user.id,
    skill.id,
    currentVersion
  ).catch(() => {});
}
```

### Pattern 3: "Updated" Badge on Skill Cards

**What:** Compare `skills.updatedAt` against the user's `last_viewed_at` to show an "Updated" badge.
**When to use:** In skill browse/search results and dashboard trending/company-approved sections.

```typescript
// The key comparison is: skill.updatedAt > userView.lastViewedAt
// For users who haven't viewed a skill, no badge is shown (it's "new to them" anyway).

// Query pattern for skills list with "updated" flag:
const viewsForUser = db
  .select()
  .from(userSkillViews)
  .where(eq(userSkillViews.userId, userId))
  .as("user_views");

// In the skills query, LEFT JOIN user_skill_views and compare timestamps
// Result row includes: isUpdatedSinceLastView: boolean
```

**Badge data flow:**
1. Server: Query skills LEFT JOIN user_skill_views, compute `isUpdated` flag per skill
2. Pass `isUpdated` boolean through to skill card/row component props
3. Component: Render `<UpdatedBadge />` when `isUpdated === true`

### Pattern 4: Change Summary (TEMP-03)

**What:** On the skill detail page, show what changed since the user's last visit.
**When to use:** When user has a previous view record and the skill has been modified.

```typescript
// Change types to detect (from FEATURES.md research):
interface ChangeItem {
  type: "version_bump" | "description_updated" | "new_feedback" | "rating_changed" | "new_benchmark";
  label: string;
  detail?: string; // e.g., "v3 -> v5"
}

async function detectChanges(
  skillId: string,
  lastViewedAt: Date,
  lastViewedVersion: number | null,
  currentSkill: Skill
): Promise<ChangeItem[]> {
  const changes: ChangeItem[] = [];

  // 1. Version bump
  if (lastViewedVersion !== null && currentSkill.publishedVersionId) {
    const currentVersion = await getVersionNumber(currentSkill.publishedVersionId);
    if (currentVersion && currentVersion > lastViewedVersion) {
      changes.push({
        type: "version_bump",
        label: "New version published",
        detail: `v${lastViewedVersion} -> v${currentVersion}`,
      });
    }
  }

  // 2. Description changed (compare against version snapshot)
  // Version snapshots store name+description, compare to current

  // 3. New feedback since last view
  const newFeedbackCount = await countFeedbackSince(skillId, lastViewedAt);
  if (newFeedbackCount > 0) {
    changes.push({
      type: "new_feedback",
      label: `${newFeedbackCount} new feedback item${newFeedbackCount > 1 ? "s" : ""}`,
    });
  }

  // 4. Rating changed
  // Compare current averageRating against stored-at-view-time rating

  return changes;
}
```

### Pattern 5: "What's New" Feed (TEMP-04)

**What:** Dashboard widget showing recently changed skills the user has previously viewed.
**When to use:** On the dashboard/home page for authenticated users.

```sql
-- Query: skills the user has viewed that changed since their last view
SELECT s.id, s.name, s.slug, s.description, s.category, s.updated_at,
       usv.last_viewed_at, usv.view_count
FROM user_skill_views usv
JOIN skills s ON s.id = usv.skill_id
WHERE usv.user_id = $userId
  AND s.updated_at > usv.last_viewed_at
  AND s.status = 'published'
ORDER BY s.updated_at DESC
LIMIT 10;
```

### Anti-Patterns to Avoid

- **Full bi-temporal schema changes:** OUT OF SCOPE. Do NOT add valid_from/valid_to to skill_versions. The interaction table handles the user-facing need.
- **Recording anonymous views:** Only track authenticated users. Anonymous users don't need "what's new" features.
- **Blocking page render on view recording:** Always fire-and-forget. The view tracking is for future visits, not the current one.
- **Using `toLocaleDateString()` in client components:** Causes hydration mismatch (documented in project memory). Use manual UTC formatting or `<RelativeTime>` component.
- **Storing view data in `usage_events`:** That table tracks MCP tool invocations and has different schema shape (uuid PK, no unique constraint, different purpose).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict resolution for concurrent view writes | Custom locking logic | PostgreSQL UPSERT (`ON CONFLICT DO UPDATE`) | Atomic, handles race conditions natively |
| Version number resolution | Join through published_version_id manually | Helper function `getVersionNumber()` that queries `skill_versions.version` by ID | Single responsibility, reusable |
| Date display in "Updated" badge | Custom date formatting | Existing `<RelativeTime>` component from `@/components/relative-time` | Already handles hydration-safe date display |
| Badge component styling | Custom badge from scratch | Follow existing `CompanyApprovedBadge` pattern (Tailwind + inline SVG) | Consistent with codebase visual language |

**Key insight:** The entire feature is built on a single new table + queries that JOIN against existing tables. No schema changes to existing tables, no new extensions, no new dependencies.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Skill Lists

**What goes wrong:** When rendering a list of 50 skills, querying `user_skill_views` individually per skill creates 50 extra queries.
**Why it happens:** Naive implementation checks each skill card independently.
**How to avoid:** Batch-load all user views for the visible skill IDs in a single query, build a Map, and pass `isUpdated` as a prop.
**Warning signs:** Slow browse/search page loads for authenticated users.

```typescript
// GOOD: Batch query
const views = await getUserViewsForSkills(userId, skillIds);
const viewMap = new Map(views.map(v => [v.skillId, v]));

// BAD: Per-skill query
for (const skill of skills) {
  const view = await getUserView(userId, skill.id); // N+1!
}
```

### Pitfall 2: Hydration Mismatch with Timestamps

**What goes wrong:** Server renders "Updated 2 hours ago" but client re-renders "Updated 2 hours ago" with a different time reference, causing React hydration errors.
**Why it happens:** Server and client have different `Date.now()` values.
**How to avoid:** Use the existing `<RelativeTime>` component which handles this correctly. For the "Updated" badge, pass a boolean `isUpdated` flag (not a timestamp) to the client component.
**Warning signs:** Console hydration warnings in dev mode.

### Pitfall 3: View Recording Race Condition on Skill Detail

**What goes wrong:** The user opens the skill detail page. The page records the view (updating `lastViewedAt`). The change summary section queries for changes since `lastViewedAt`. Since the view was just recorded, the change summary shows nothing.
**Why it happens:** The view recording happens before the change computation.
**How to avoid:** Compute the change summary BEFORE recording the new view. Read the previous view record first, compute changes, then update the view record.

```typescript
// CORRECT ORDER:
// 1. Fetch the user's PREVIOUS view record
const previousView = await getUserView(userId, skillId);
// 2. Compute changes since previous view
const changes = previousView
  ? await detectChanges(skillId, previousView.lastViewedAt, previousView.lastViewedVersion, skill)
  : [];
// 3. THEN record the new view (fire-and-forget)
recordSkillView(tenantId, userId, skillId, currentVersion).catch(() => {});
// 4. Render the page with changes
```

### Pitfall 4: "What's New" Feed Performance

**What goes wrong:** The dashboard "What's New" query scans all `user_skill_views` rows for the user and JOINs against `skills` to find updated ones. With many viewed skills, this becomes slow.
**Why it happens:** Missing composite index, or query not limited.
**How to avoid:**
1. Index on `user_skill_views(user_id, last_viewed_at)` for efficient user-scoped queries.
2. Always LIMIT results (10 items for dashboard).
3. Only check skills updated in the last 30 days (bounded time window).
**Warning signs:** Dashboard page load time increases with user activity.

### Pitfall 5: RLS Policy Missing on New Table

**What goes wrong:** The `user_skill_views` table is created without a tenant_isolation RLS policy, allowing cross-tenant data leaks.
**Why it happens:** Every existing table in the schema has `pgPolicy("tenant_isolation", ...)`. Easy to forget for new tables.
**How to avoid:** Follow the exact pattern from every other schema file. Include `tenantId` column, `REFERENCES tenants(id)`, and the standard RLS policy.

## Code Examples

Verified patterns from codebase analysis:

### Schema Definition (Following Existing Patterns)

```typescript
// packages/db/src/schema/user-skill-views.ts
import { pgTable, text, timestamp, integer, index, uniqueIndex, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import { skills } from "./skills";

export const userSkillViews = pgTable(
  "user_skill_views",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    lastViewedVersion: integer("last_viewed_version"), // nullable: skills without versions
    viewCount: integer("view_count").notNull().default(1),
  },
  (table) => [
    uniqueIndex("user_skill_views_tenant_user_skill_unique")
      .on(table.tenantId, table.userId, table.skillId),
    index("user_skill_views_user_id_idx").on(table.userId),
    index("user_skill_views_skill_id_idx").on(table.skillId),
    index("user_skill_views_tenant_id_idx").on(table.tenantId),
    index("user_skill_views_user_last_viewed_idx").on(table.userId, table.lastViewedAt),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type UserSkillView = typeof userSkillViews.$inferSelect;
export type NewUserSkillView = typeof userSkillViews.$inferInsert;
```

### Migration SQL

```sql
-- 0039_create_user_skill_views.sql
-- Phase 71: Temporal Tracking
-- Lightweight interaction tracking for "what changed since you last looked"

CREATE TABLE IF NOT EXISTS user_skill_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_version INTEGER,
  view_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(tenant_id, user_id, skill_id)
);

CREATE INDEX user_skill_views_user_id_idx ON user_skill_views(user_id);
CREATE INDEX user_skill_views_skill_id_idx ON user_skill_views(skill_id);
CREATE INDEX user_skill_views_tenant_id_idx ON user_skill_views(tenant_id);
CREATE INDEX user_skill_views_user_last_viewed_idx ON user_skill_views(user_id, last_viewed_at);

-- RLS policy (matches existing pattern)
ALTER TABLE user_skill_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_skill_views FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

### "Updated" Badge Component

```typescript
// apps/web/components/updated-badge.tsx
// Following CompanyApprovedBadge pattern

interface UpdatedBadgeProps {
  size?: "sm" | "md";
}

export function UpdatedBadge({ size = "sm" }: UpdatedBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 font-medium text-amber-700 ${sizeClasses}`}
      title="Updated since your last visit"
    >
      {/* Arrow-path icon (Heroicons refresh) */}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
      {size === "md" && <span>Updated</span>}
    </span>
  );
}
```

### Batch View Loading for Skill Lists

```typescript
// packages/db/src/services/user-skill-views.ts

export async function getUserViewsForSkills(
  userId: string,
  skillIds: string[]
): Promise<Map<string, UserSkillView>> {
  if (!db || skillIds.length === 0) return new Map();

  const views = await db
    .select()
    .from(userSkillViews)
    .where(
      and(
        eq(userSkillViews.userId, userId),
        inArray(userSkillViews.skillId, skillIds)
      )
    );

  return new Map(views.map(v => [v.skillId, v]));
}
```

### "What's New" Dashboard Query

```typescript
// apps/web/lib/whats-new.ts

export interface WhatsNewItem {
  skillId: string;
  skillName: string;
  skillSlug: string;
  category: string;
  updatedAt: string; // ISO string for client serialization
  lastViewedAt: string;
  viewCount: number;
}

export async function getWhatsNew(userId: string, limit = 10): Promise<WhatsNewItem[]> {
  if (!db) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results = await db.execute(sql`
    SELECT
      s.id as skill_id,
      s.name as skill_name,
      s.slug as skill_slug,
      s.category,
      s.updated_at,
      usv.last_viewed_at,
      usv.view_count
    FROM user_skill_views usv
    JOIN skills s ON s.id = usv.skill_id
    WHERE usv.user_id = ${userId}
      AND s.updated_at > usv.last_viewed_at
      AND s.status = 'published'
      AND s.updated_at >= ${thirtyDaysAgo.toISOString()}::timestamptz
    ORDER BY s.updated_at DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map(row => ({
    skillId: String(row.skill_id),
    skillName: String(row.skill_name),
    skillSlug: String(row.skill_slug),
    category: String(row.category),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastViewedAt: new Date(row.last_viewed_at).toISOString(),
    viewCount: Number(row.view_count),
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full bi-temporal tables | Lightweight interaction tracking | v7.0 research (2026-02-16) | Explicit Out of Scope decision: skip massive migration, use simple table |
| WebSocket real-time notifications | Passive "Updated" badge on page load | v7.0 requirements | Out of Scope: "Real-time change notifications (WebSocket)" |
| Subscribe to skill changes | Show changes passively | v7.0 requirements | Anti-feature: notification fatigue for infrequently changing content |

**Deprecated/outdated:**
- Bi-temporal approach from ARCHITECTURE.md Pitfall 5: Explicitly descoped. Do NOT add valid_from/valid_to to skill_versions.

## Existing Code Touch Points

### Files to MODIFY

| File | What Changes | Why |
|------|-------------|-----|
| `packages/db/src/schema/index.ts` | Add `export * from "./user-skill-views"` | Schema barrel export |
| `packages/db/src/relations/index.ts` | Add relations for `userSkillViews` | Enable Drizzle relational queries |
| `packages/db/src/services/index.ts` | Export new service functions | Service barrel export |
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | Record view (fire-and-forget), fetch previous view, compute change summary | TEMP-01 + TEMP-03 |
| `apps/web/app/(protected)/page.tsx` | Add "What's New" section | TEMP-04 |
| `apps/web/app/(protected)/skills/page.tsx` | Pass `isUpdated` map to SkillsTable | TEMP-02 |
| `apps/web/components/skills-table.tsx` | Accept `updatedSkillIds` prop | TEMP-02 |
| `apps/web/components/skills-table-row.tsx` | Render `<UpdatedBadge />` when skill is updated | TEMP-02 |

### Files to CREATE

| File | Purpose |
|------|---------|
| `packages/db/src/schema/user-skill-views.ts` | Table definition |
| `packages/db/src/services/user-skill-views.ts` | UPSERT, batch get, what's new queries |
| `packages/db/src/migrations/0039_create_user_skill_views.sql` | Migration |
| `apps/web/components/updated-badge.tsx` | "Updated" badge component |
| `apps/web/components/change-summary.tsx` | Change summary section for skill detail |
| `apps/web/components/whats-new-feed.tsx` | Dashboard "What's New" widget |
| `apps/web/lib/change-detection.ts` | Compute what changed since last view |
| `apps/web/lib/whats-new.ts` | Dashboard query for updated skills |

### Existing Queries That Need "Updated" Awareness

The browse/search page uses `searchSkills()` from `apps/web/lib/search-skills.ts`. This function returns skill objects but does NOT currently include view information. Two approaches:

1. **Join in the query** (modifies searchSkills): Adds a LEFT JOIN on `user_skill_views` into the main search query. More efficient (one query), but modifies a complex function.
2. **Separate batch query** (no modification): After getting skill results, run a second query `getUserViewsForSkills(userId, skillIds)`. Simpler, no risk to existing search.

**Recommendation:** Approach 2 (separate batch query). The search query is already complex with full-text search + semantic similarity + quality scoring. Adding another JOIN risks regressions. A separate batch query is O(1) regardless of search complexity.

### Version Number Resolution

The `skills.publishedVersionId` stores the version UUID, not the version number. To compare version numbers, we need a helper:

```typescript
async function getVersionNumber(versionId: string): Promise<number | null> {
  if (!db) return null;
  const v = await db.query.skillVersions.findFirst({
    where: eq(skillVersions.id, versionId),
    columns: { version: true },
  });
  return v?.version ?? null;
}
```

This is needed in two places:
1. When recording a view (to store `lastViewedVersion`)
2. When computing changes (to compare versions)

### Dashboard Integration

The homepage (`apps/web/app/(protected)/page.tsx`) already fetches 10 data items in parallel with `Promise.all()`. The "What's New" query will be added as an 11th item. The component renders after the existing sections (compact stats, discovery search, category tiles, company recommended, trending).

### Serialization Discipline

Per project memory: "Server to client Date serialization: use `.toISOString()` before passing, accept `string` in client interfaces." All `Date` objects from the new queries must be serialized before passing to client components. The `WhatsNewItem` interface uses `string` (not `Date`) for `updatedAt` and `lastViewedAt`.

## Open Questions

1. **Should we store `averageRating` at view time for "rating changed" detection?**
   - What we know: The `skills.averageRating` field is denormalized. We can detect rating changes by comparing current vs. a stored snapshot.
   - What's unclear: Whether the interaction table should store a `lastViewedRating` column, or if we just detect the change via a separate query.
   - Recommendation: Start without it (YAGNI). Version bumps and new feedback are the primary change signals. Rating changes can be added later by adding a column.

2. **Should the "Updated" badge appear on trending/company-approved cards (dashboard) in addition to the browse table?**
   - What we know: The dashboard renders skills via `TrendingSection` and `CompanyApprovedSection` -- both use custom card layouts, not the `SkillsTable`.
   - What's unclear: Whether adding the badge to these components is in scope for v1 or a follow-up.
   - Recommendation: Include in TEMP-02 scope. The badge is simple, and the batch view query already provides the data. All skill-rendering components should show it.

3. **What's the migration number?**
   - The latest migration is `0038_extend_visibility.sql`. The next number is `0039`.
   - Verify no other phases have claimed `0039` before executing.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: `packages/db/src/schema/*.ts` (25 tables), `packages/db/src/services/*.ts` (30+ services), `apps/web/app/(protected)/skills/[slug]/page.tsx`, `apps/web/app/(protected)/page.tsx`, `apps/web/components/skills-table-row.tsx`
- **v7.0 research**: `.planning/research/FEATURES.md` (lines 255-370: temporal tracking feature landscape with schema design, change detection types, anti-features)
- **v7.0 research**: `.planning/research/ARCHITECTURE.md` (lines 347-447: temporal version tracking architecture, but explicitly descoped for Phase 71)
- **v7.0 research**: `.planning/research/STACK.md` (lines 88-95: temporal model recommendations)
- **v7.0 research**: `.planning/research/PITFALLS.md` (lines 250-302: bi-temporal migration pitfalls -- all avoided by using lightweight table)
- **Requirements**: `.planning/REQUIREMENTS.md` (TEMP-01 through TEMP-04, Out of Scope)
- **Existing patterns**: `packages/db/src/schema/user-preferences.ts` (per-user table with tenant isolation, same structure needed)

### Secondary (MEDIUM confidence)
- **Existing badge pattern**: `apps/web/components/company-approved-badge.tsx` (Tailwind + inline SVG badge component pattern)
- **Dashboard data loading**: `apps/web/app/(protected)/page.tsx` (Promise.all parallel fetch pattern for homepage)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; uses existing Drizzle, PostgreSQL, Next.js
- Architecture: HIGH - Single new table, UPSERT pattern, batch queries; all verified against codebase
- Schema design: HIGH - Follows exact patterns of existing per-user tables (user_preferences, notification_preferences)
- Change detection: MEDIUM - Version comparison is straightforward, but detecting description changes requires comparing version snapshots (which exist in `skill_versions.name` and `skill_versions.description`)
- Pitfalls: HIGH - All identified pitfalls have concrete prevention strategies verified against codebase

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable patterns, no dependency changes expected)
