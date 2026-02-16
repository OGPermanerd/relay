# Phase 69: Extended Visibility - Research

**Researched:** 2026-02-16
**Domain:** Skill visibility levels, tenant isolation (RLS), query-level access control
**Confidence:** HIGH

## Summary

Phase 69 extends the skill visibility system from 2 levels (tenant, personal) to 4 levels (global_approved, tenant, personal, private). The requirements document uses the names "global_approved, tenant, personal, private" -- note that the prior architecture research used different names ("public, tenant, unlisted, personal") which must be reconciled with the actual requirements.

The current visibility system is well-architected with a centralized helper (`buildVisibilityFilter`/`visibilitySQL`) handling ~10 query locations, plus ~8 inline hardcoded locations that deliberately use `visibility = 'tenant'` for org-level aggregations. The key challenge is updating ALL locations consistently while maintaining backward compatibility for existing "tenant" and "personal" skills.

The critical technical challenge is `global_approved` (cross-tenant visibility). Current RLS policies enforce `tenant_id = current_setting('app.current_tenant_id')` on the skills table. Global_approved skills need to be readable from ANY tenant, requiring a new permissive RLS policy. However, RLS is currently ENABLED but NOT FORCED (the app connects as table owner, bypassing RLS). This means RLS changes are additive/safe -- they prepare for future FORCE RLS without blocking current operation.

**Primary recommendation:** Update the centralized visibility helpers first, then systematically update all inline locations. Deploy code changes BEFORE running the migration that adds the CHECK constraint. Admin-only `global_approved` enforcement belongs in application logic (server actions), not in the database.

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Drizzle ORM | 0.42.0 | Query builder, schema definitions | Already installed |
| PostgreSQL | 16 | RLS policies, CHECK constraints | Already running |
| Zod | 3.25+ | Form/API validation schemas | Already installed |
| Next.js | 16.1.6 | Server actions, UI | Already installed |

### Supporting (No Changes)

No new libraries needed. This phase is entirely modifications to existing code and one database migration.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### The Dual-Pattern Visibility System

The existing visibility system uses two deliberately different patterns that MUST both be updated:

**Pattern A -- Centralized Helper (auto-updates ~10 locations):**
- `packages/db/src/lib/visibility.ts` exports `buildVisibilityFilter(userId?)` and `visibilitySQL(userId?)`
- Used by: hybrid-search, semantic-search, search-skills (pkg), skill-forks, search-skills (app), similar-skills, MCP list tool
- Updating these TWO functions propagates changes to all Pattern A callers

**Pattern B -- Inline Hardcoded (EACH must be updated individually):**
These intentionally use `visibility = 'tenant'` for org-level aggregations where personal/private skills should never appear:

| File | Line | Current SQL | Decision Needed |
|------|------|------------|-----------------|
| `apps/web/lib/trending.ts` | 55 | `AND s.visibility = 'tenant'` | Include global_approved? YES -- global skills should trend |
| `apps/web/lib/leaderboard.ts` | 59 | `AND s.visibility = 'tenant'` | Include global_approved? YES -- global contributors should rank |
| `apps/web/lib/portfolio-queries.ts` | 80 | `FILTER (WHERE visibility = 'personal')` | Unchanged -- personal breakdown stays personal |
| `apps/web/lib/portfolio-queries.ts` | 82 | `FILTER (WHERE visibility = 'tenant')` | Add global_approved to company bucket? YES |
| `apps/web/lib/portfolio-queries.ts` | 197 | `AND s.visibility = 'tenant'` | Include global_approved? YES |
| `apps/web/lib/portfolio-queries.ts` | 230 | `AND visibility = 'tenant'` | Include global_approved? YES |
| `apps/web/lib/resume-queries.ts` | 71 | `AND s.visibility = 'personal'` | Unchanged -- resume personal filter stays |
| `apps/web/lib/search-skills.ts` | 302 | `AND visibility = 'tenant'` (getAvailableTags) | Include global_approved? YES |
| `apps/web/lib/company-approved.ts` | 34 | `eq(skills.visibility, "tenant")` | Include global_approved? YES |

### Visibility Level Semantics (from Requirements)

```
global_approved > tenant > personal > private

global_approved:  Visible across ALL tenants in search, browse, trending, etc.
                  Only admins can set/change to this level.
                  Requires cross-tenant RLS read policy.

tenant:           Visible to all users in the SAME tenant (existing behavior).
                  Any user can set this level.

personal:         Visible only to the author (existing behavior).
                  Any user can set this level.
                  Appears in portfolio but not in org aggregations.

private:          Visible only to the author, excluded from ALL views.
                  Like personal but also hidden from portfolio/resume.
                  This is new -- a truly hidden draft/archive state.
```

### Mapping to Org-Level Aggregations

A critical decision: which visibility levels count as "org-visible" (included in trending, leaderboard, tag aggregation, etc.)?

| Aggregation | Include global_approved | Include tenant | Include personal | Include private |
|-------------|----------------------|----------------|-----------------|-----------------|
| Trending | YES | YES | NO | NO |
| Leaderboard | YES | YES | NO | NO |
| Tag aggregation | YES | YES | NO | NO |
| Company Approved section | YES | YES | NO | NO |
| Portfolio stats (company bucket) | YES | YES | NO | NO |
| Portfolio stats (portable bucket) | NO | NO | YES | NO |
| Contribution ranking | YES | YES | NO | NO |
| Search results | YES | YES | own only | NO |
| Similar skills | YES | YES | own only | NO |
| Skill detail page (direct URL) | YES | YES | own only | own only |

**Helper function to create:** `isOrgVisible(visibility)` returns true for `global_approved` and `tenant`.

### Recommended Project Structure (Changes Only)

```
packages/db/src/
  lib/
    visibility.ts          # MODIFY: add global_approved + private support
  migrations/
    0038_extend_visibility.sql  # NEW: CHECK constraint + RLS policy

apps/web/
  lib/
    trending.ts            # MODIFY: IN ('global_approved', 'tenant')
    leaderboard.ts         # MODIFY: IN ('global_approved', 'tenant')
    portfolio-queries.ts   # MODIFY: multiple locations
    search-skills.ts       # MODIFY: getAvailableTags
    company-approved.ts    # MODIFY: include global_approved
    similar-skills.ts      # AUTO: via centralized helper
  app/actions/
    skills.ts              # MODIFY: Zod schema, admin gate for global_approved
  components/
    skill-upload-form.tsx  # MODIFY: add visibility options
    portfolio-view.tsx     # MODIFY: VisibilityBadge for new levels
    resume-view.tsx        # MODIFY: VisibilityBadge for new levels

apps/mcp/src/tools/
  everyskill.ts           # MODIFY: Zod enum for visibility
  create.ts               # MODIFY: type for visibility param
  update-skill.ts         # MODIFY: type for visibility param
```

### Pattern: Admin-Only Visibility Promotion

VIS-05 requires that only admins can set `global_approved`. This is enforced at the application layer:

```typescript
// In server actions (skills.ts, admin-skills.ts)
if (visibility === "global_approved") {
  if (!isAdmin(session)) {
    return { errors: { visibility: ["Only admins can set global visibility"] } };
  }
}
```

The existing `isAdmin(session)` helper in `apps/web/lib/admin.ts` checks `session.user.role === "admin"`. The `users` table already has a `role` column with `userRoleEnum("user_role", ["admin", "member"])`. The session type already carries `role?: "admin" | "member"`.

### Pattern: Cross-Tenant RLS for global_approved

Current RLS on skills table:
```sql
CREATE POLICY tenant_isolation ON skills FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

Required addition for global_approved reads:
```sql
-- Add a PERMISSIVE policy for cross-tenant reads of global_approved skills
CREATE POLICY global_approved_read ON skills FOR SELECT
  USING (visibility = 'global_approved');
```

**Important nuance:** The existing policy is created without `AS RESTRICTIVE` in the migration (0005), but the Drizzle schema marks it `as: "restrictive"`. When multiple policies exist:
- RESTRICTIVE policies are AND-ed together
- PERMISSIVE policies are OR-ed together
- Final = (any permissive passes) AND (all restrictive pass)

Since the existing `tenant_isolation` policy was created as RESTRICTIVE (via Drizzle schema definition), adding a PERMISSIVE `global_approved_read` means:
- A global_approved skill passes the permissive policy
- BUT still needs to pass the restrictive tenant_isolation

This is a problem. A global_approved skill from tenant B won't pass tenant_isolation for a user in tenant A.

**Resolution options:**
1. Change `tenant_isolation` from RESTRICTIVE to PERMISSIVE (breaking change for all tables)
2. Modify `tenant_isolation` USING clause: `tenant_id = current_setting(...) OR visibility = 'global_approved'`
3. Since RLS is NOT FORCED (table owner bypasses), this is currently moot -- but we should get it right for when FORCE is enabled

**Recommendation:** Option 2. Modify the existing tenant_isolation policy on the skills table only:

```sql
-- Drop and recreate the skills tenant_isolation policy to allow global_approved reads
DROP POLICY IF EXISTS tenant_isolation ON skills;

CREATE POLICY tenant_isolation ON skills FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR (visibility = 'global_approved')
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
  );
```

The USING clause allows reads of global_approved skills from any tenant. The WITH CHECK clause still restricts writes to the user's own tenant (you can't INSERT a skill into another tenant's scope).

**CRITICAL NOTE:** Since RLS is ENABLED but NOT FORCED (app connects as table owner), this policy change has zero runtime effect today. It prepares for future FORCE RLS. The actual cross-tenant visibility is enforced at the application layer via `buildVisibilityFilter()` / `visibilitySQL()`.

### Updated Centralized Helpers

```typescript
// packages/db/src/lib/visibility.ts

/**
 * Visibility levels (ordered from most to least visible):
 * - global_approved: visible across all tenants (admin-only)
 * - tenant: visible to same-tenant users
 * - personal: visible only to the author
 * - private: hidden from all views (author-only, not in portfolio)
 */
export const VISIBILITY_LEVELS = ["global_approved", "tenant", "personal", "private"] as const;
export type VisibilityLevel = typeof VISIBILITY_LEVELS[number];

/** Visibility levels that appear in org-level aggregations */
export const ORG_VISIBLE_LEVELS = ["global_approved", "tenant"] as const;

export function isOrgVisible(visibility: string): boolean {
  return visibility === "global_approved" || visibility === "tenant";
}

/**
 * Build a Drizzle query-builder visibility filter.
 * - global_approved: always visible (cross-tenant)
 * - tenant: always visible (same tenant, enforced by RLS/connection)
 * - personal: visible only to the author
 * - private: visible only to the author
 */
export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    return or(
      eq(skills.visibility, "global_approved"),
      eq(skills.visibility, "tenant")
    )!;
  }

  return or(
    eq(skills.visibility, "global_approved"),
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId)),
    and(eq(skills.visibility, "private"), eq(skills.authorId, userId))
  )!;
}

/**
 * Build a raw SQL visibility clause for template-string queries.
 */
export function visibilitySQL(userId?: string): SQL {
  if (!userId) {
    return sql`visibility IN ('global_approved', 'tenant')`;
  }

  return sql`(visibility IN ('global_approved', 'tenant') OR (visibility IN ('personal', 'private') AND author_id = ${userId}))`;
}

/**
 * Raw SQL clause for org-level aggregations (trending, leaderboard, etc.)
 * Excludes personal and private skills.
 */
export function orgVisibleSQL(): SQL {
  return sql`visibility IN ('global_approved', 'tenant')`;
}
```

### Inline Location Update Pattern

For each Pattern B location, replace `visibility = 'tenant'` with `visibility IN ('global_approved', 'tenant')`:

```sql
-- Before:
AND s.visibility = 'tenant'

-- After:
AND s.visibility IN ('global_approved', 'tenant')
```

Or import and use the new `orgVisibleSQL()` helper where possible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visibility enum validation | Custom string checks | Zod `.enum()` with `VISIBILITY_LEVELS` | Single source of truth, compile-time safety |
| Admin check | Custom role parsing | Existing `isAdmin(session)` from `apps/web/lib/admin.ts` | Already handles JWT role extraction |
| Cross-tenant reads | Application-level tenant bypass | Modified RLS policy on skills table | Security at the DB layer, not scattered in code |
| Org-visible check | Repeated inline `IN ('global_approved', 'tenant')` | `isOrgVisible()` helper + `orgVisibleSQL()` | Single definition, change one place to add future levels |

**Key insight:** The centralized `buildVisibilityFilter()` pattern was correctly designed in Phase 40. Extending it to 4 levels is the right approach. The inline Pattern B locations are the risk -- each must be individually reviewed for the correct semantic meaning.

## Common Pitfalls

### Pitfall 1: Forgetting Inline Visibility Locations
**What goes wrong:** Updating the centralized helper but missing one or more of the 8+ inline hardcoded locations.
**Why it happens:** Pattern B locations were deliberately different from Pattern A. A developer updating visibility.ts assumes they're done.
**How to avoid:** Run the grep audit BEFORE and AFTER changes: `grep -rn "visibility.*=.*'tenant'\|visibility.*=.*'personal'\|buildVisibilityFilter\|visibilitySQL\|orgVisibleSQL" --include='*.ts' apps/ packages/`
**Warning signs:** Skills appear in search but not in trending. Or appear in trending but not leaderboard.

### Pitfall 2: global_approved Skills Disappearing in Single-Tenant Mode
**What goes wrong:** global_approved skills from the same tenant work fine. But in the current single-tenant setup, there's only one tenant. Testing cross-tenant reads is impossible without a second tenant.
**Why it happens:** The system runs with `DEFAULT_TENANT_ID` hardcoded everywhere. RLS is not forced. Cross-tenant visibility has no test path in dev.
**How to avoid:** For Phase 69, focus on the application-layer logic (buildVisibilityFilter returning global_approved skills). The RLS policy change is forward-looking. Write unit tests for `buildVisibilityFilter()` and `visibilitySQL()` that verify global_approved is included regardless of tenant context.
**Warning signs:** All tests pass in dev but skills aren't visible cross-tenant when multi-tenant is enabled.

### Pitfall 3: Deploying Migration Before Code
**What goes wrong:** Migration adds CHECK constraint limiting to 4 values. If old code tries to insert with an unexpected value, it fails. More importantly: if there were a bug in the CHECK constraint (e.g., typo in a value), skills could fail to be created.
**Why it happens:** Standard deploy order is: migration, then code. But defensive order for additive values is: code first (handles new values), then constraint (prevents invalid values).
**How to avoid:** Deploy the code changes first. The code should handle all 4 values. Then run the migration to add the CHECK constraint. Existing data is all 'tenant' or 'personal' which passes the constraint.
**Warning signs:** `INSERT ... visibility = 'global_approved'` fails with CHECK violation.

### Pitfall 4: MCP Tool Hardcoded Visibility Types
**What goes wrong:** The MCP `everyskill.ts` tool has `visibility: z.enum(["tenant", "personal"])` in its Zod schema. The `create.ts` and `update-skill.ts` handlers type visibility as `"tenant" | "personal"`. If not updated, MCP users can't create global_approved or private skills.
**Why it happens:** MCP tools are in a separate `apps/mcp/` directory, easy to overlook.
**How to avoid:** Update the Zod enum in `everyskill.ts` and the type annotations in `create.ts`/`update-skill.ts`. For `global_approved` via MCP: this requires admin check, which MCP currently doesn't have role information for. Decision needed: should MCP support global_approved at all?
**Warning signs:** MCP `create` with `visibility: "global_approved"` returns validation error.

### Pitfall 5: Private vs Personal Confusion
**What goes wrong:** "Private" and "personal" sound similar. Developers confuse which is which. The key difference: personal skills appear in the author's portfolio/resume; private skills are hidden from everything.
**Why it happens:** Both are author-only visibility. The distinction is subtle.
**How to avoid:** Use clear constants and JSDoc. `personal` = "my portfolio skill" (visible to others in context of my profile). `private` = "truly hidden" (draft, archived, or test skill).
**Warning signs:** Private skills showing up in portfolio stats or resume exports.

### Pitfall 6: Portfolio Stats Buckets Need Expansion
**What goes wrong:** `getPortfolioStats()` uses `FILTER (WHERE visibility = 'personal')` and `FILTER (WHERE visibility = 'tenant')` to compute `portableSkills` and `companySkills`. With 4 levels, where do `global_approved` and `private` go?
**Why it happens:** The 2-bucket model (portable vs company) doesn't map cleanly to 4 levels.
**How to avoid:** Decision: `global_approved` goes into the company bucket (it's shared work). `private` gets its own count or is excluded entirely. The `PortfolioStats` interface may need a new field or the existing buckets need clear documentation.
**Warning signs:** Portfolio stats don't add up (skills_authored != portable + company because some are private/global_approved).

## Code Examples

### Migration: 0038_extend_visibility.sql

```sql
-- Phase 69: Extended Visibility
-- Adds CHECK constraint for 4 visibility levels
-- Modifies RLS policy on skills to allow cross-tenant reads of global_approved

-- Step 1: Add CHECK constraint
-- Existing data is all 'tenant' or 'personal' -- both are valid
ALTER TABLE skills
  ADD CONSTRAINT skills_visibility_check
  CHECK (visibility IN ('global_approved', 'tenant', 'personal', 'private'));

-- Step 2: Modify skills RLS policy for cross-tenant global_approved reads
-- Drop existing policy
DROP POLICY IF EXISTS tenant_isolation ON skills;

-- Recreate with global_approved exception for reads
CREATE POLICY tenant_isolation ON skills FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR visibility = 'global_approved'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
  );
```

### Updated Zod Schema in Server Actions

```typescript
// apps/web/app/actions/skills.ts
import { VISIBILITY_LEVELS } from "@everyskill/db/lib/visibility";
import { isAdmin } from "@/lib/admin";

const createSkillSchema = z.object({
  // ... existing fields ...
  visibility: z.enum(["global_approved", "tenant", "personal", "private"]).default("tenant"),
});

// In checkAndCreateSkill:
if (parsed.data.visibility === "global_approved") {
  if (!isAdmin(session)) {
    return { errors: { visibility: ["Only admins can set global visibility"] } };
  }
}
```

### Updated MCP Visibility Enum

```typescript
// apps/mcp/src/tools/everyskill.ts
visibility: z
  .enum(["global_approved", "tenant", "personal", "private"])
  .optional()
  .describe("Skill visibility: global_approved (cross-tenant, admin only), tenant (team), personal (author portfolio), private (hidden)"),
```

### Updated Inline Query (Trending Example)

```sql
-- apps/web/lib/trending.ts, line 55
-- Before:
AND s.visibility = 'tenant'
-- After:
AND s.visibility IN ('global_approved', 'tenant')
```

### Updated Portfolio Stats

```typescript
// apps/web/lib/portfolio-queries.ts
// The FILTER clauses need expansion:
COUNT(*) FILTER (WHERE visibility = 'personal')::integer AS portable_skills,
COUNT(*) FILTER (WHERE visibility IN ('global_approved', 'tenant'))::integer AS company_skills,
// private skills excluded from both counts (they're truly hidden)
```

### UI: Visibility Selector (Updated)

```tsx
// apps/web/components/skill-upload-form.tsx
// Add global_approved option (conditionally shown for admins)
// Add private option
<fieldset>
  <legend>Visibility</legend>
  <label>
    <input type="radio" name="visibility" value="tenant" />
    <span>Team</span>
    <span>Visible to your organization</span>
  </label>
  <label>
    <input type="radio" name="visibility" value="personal" />
    <span>Personal</span>
    <span>Only you can see it, shown in your portfolio</span>
  </label>
  <label>
    <input type="radio" name="visibility" value="private" />
    <span>Private</span>
    <span>Hidden from all views, only you can access</span>
  </label>
  {isAdmin && (
    <label>
      <input type="radio" name="visibility" value="global_approved" />
      <span>Global</span>
      <span>Visible across all organizations (admin only)</span>
    </label>
  )}
</fieldset>
```

### VisibilityBadge Component (Updated)

```tsx
function VisibilityBadge({ visibility }: { visibility: string }) {
  switch (visibility) {
    case "global_approved":
      return <span className="...">Global</span>;
    case "tenant":
      return <span className="...">Team</span>;
    case "personal":
      return <span className="...">Personal</span>;
    case "private":
      return <span className="...">Private</span>;
    default:
      return null;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2 visibility values (tenant, personal) | 4 values (global_approved, tenant, personal, private) | Phase 69 | All visibility queries updated |
| No CHECK constraint on visibility | CHECK constraint limits to valid values | Phase 69 | Data integrity enforced at DB level |
| Single RLS policy (tenant_id match) | Modified policy with global_approved exception | Phase 69 | Prepares for cross-tenant reads |
| No admin gate on visibility | Admin-only global_approved | Phase 69 | Privilege escalation prevented |

**Deprecated/outdated:**
- The `companyApproved` boolean on skills overlaps conceptually with `global_approved`. Phase 69 does NOT deprecate it -- `companyApproved` is a quality signal ("this is vetted"), while `global_approved` is a visibility level ("who can see it"). A skill can be `global_approved` AND `companyApproved`.

## Complete Audit: All Files Requiring Changes

### Centralized (1 file, updates ~10 callers automatically)

| File | Change | Priority |
|------|--------|----------|
| `packages/db/src/lib/visibility.ts` | Add VISIBILITY_LEVELS, isOrgVisible, orgVisibleSQL; update buildVisibilityFilter and visibilitySQL for 4 levels | P0 - Do First |

### Inline Visibility Queries (8 files, ~12 locations)

| File | Line(s) | Current | Required Change |
|------|---------|---------|-----------------|
| `apps/web/lib/trending.ts` | 55 | `s.visibility = 'tenant'` | `s.visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/leaderboard.ts` | 59 | `s.visibility = 'tenant'` | `s.visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/portfolio-queries.ts` | 80 | `FILTER (WHERE visibility = 'personal')` | Unchanged |
| `apps/web/lib/portfolio-queries.ts` | 82 | `FILTER (WHERE visibility = 'tenant')` | `FILTER (WHERE visibility IN ('global_approved', 'tenant'))` |
| `apps/web/lib/portfolio-queries.ts` | 197 | `AND s.visibility = 'tenant'` | `AND s.visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/portfolio-queries.ts` | 230 | `AND visibility = 'tenant'` | `AND visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/resume-queries.ts` | 71 | `AND s.visibility = 'personal'` | Unchanged (or add `OR visibility = 'private'` if private shows in resume) |
| `apps/web/lib/search-skills.ts` | 302 | `AND visibility = 'tenant'` | `AND visibility IN ('global_approved', 'tenant')` |
| `apps/web/lib/company-approved.ts` | 34 | `eq(skills.visibility, "tenant")` | `inArray(skills.visibility, ["global_approved", "tenant"])` |

### Validation & Types (3 files)

| File | Change |
|------|--------|
| `apps/web/app/actions/skills.ts` | Update Zod schema enum, add admin gate for global_approved |
| `apps/mcp/src/tools/everyskill.ts` | Update visibility Zod enum + EverySkillArgs type |
| `apps/mcp/src/tools/create.ts` | Update visibility param type |
| `apps/mcp/src/tools/update-skill.ts` | Update visibility param type |

### UI Components (3 files)

| File | Change |
|------|--------|
| `apps/web/components/skill-upload-form.tsx` | Add radio buttons for private + conditional global_approved |
| `apps/web/components/portfolio-view.tsx` | Update VisibilityBadge for new levels |
| `apps/web/components/resume-view.tsx` | Update VisibilityBadge for new levels |

### Drizzle Schema (1 file)

| File | Change |
|------|--------|
| `packages/db/src/schema/skills.ts` | Update comment on visibility column to document 4 levels |

### Migration (1 file)

| File | Change |
|------|--------|
| `packages/db/src/migrations/0038_extend_visibility.sql` | CHECK constraint + RLS policy update |

### Tests (new files)

| File | Purpose |
|------|---------|
| `packages/db/src/lib/__tests__/visibility.test.ts` | Unit tests for all 4 visibility levels in both helpers |

**Total files to modify:** ~16
**Total files to create:** ~2 (migration + tests)

## Open Questions

1. **Private visibility in portfolio/resume**
   - What we know: Private is "hidden from all views"
   - What's unclear: Should private skills still appear when the author views their OWN portfolio? Or truly invisible everywhere?
   - Recommendation: Private skills are excluded from portfolio and resume. The author can see them only via a dedicated "My Skills" management page (if one exists) or by directly navigating to the skill URL. This keeps the behavior maximally simple.

2. **MCP admin detection for global_approved**
   - What we know: MCP auth resolves `userId` from API key but doesn't currently resolve `role`
   - What's unclear: Can MCP users set global_approved? The MCP `auth.ts` resolves userId but not role
   - Recommendation: For Phase 69, MCP cannot set global_approved. The Zod enum includes it for future use, but the create/update handlers reject it without role information. Add a TODO for MCP role resolution in a future phase.

3. **Resume queries and private visibility**
   - What we know: `getResumeData()` has a `visibilityClause` that filters to personal skills for the resume export
   - What's unclear: Should `private` be included in resume exports when `includeCompanySkills = false`?
   - Recommendation: No. Private means private. Resume exports should only include personal + optionally tenant/global_approved.

4. **Existing `companyApproved` field relationship**
   - What we know: `companyApproved` is a boolean quality signal; `global_approved` is a visibility level
   - What's unclear: Should setting `global_approved` auto-set `companyApproved = true`?
   - Recommendation: No automatic coupling. They serve different purposes. An admin can set a skill to global_approved without it being companyApproved (e.g., a standard template that's useful but not vetted). Keep them independent.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/lib/visibility.ts` -- 34 lines, both helper functions analyzed
- `packages/db/src/schema/skills.ts` -- visibility column definition (text, default 'tenant')
- `packages/db/src/schema/users.ts` -- role enum (admin, member)
- `apps/web/lib/admin.ts` -- isAdmin helper
- `apps/web/types/next-auth.d.ts` -- session.user.role type
- `apps/web/app/actions/skills.ts` -- Zod schema, create flow, visibility handling
- `apps/web/lib/trending.ts` -- inline visibility = 'tenant' at line 55
- `apps/web/lib/leaderboard.ts` -- inline visibility = 'tenant' at line 59
- `apps/web/lib/portfolio-queries.ts` -- 4 inline visibility locations
- `apps/web/lib/resume-queries.ts` -- visibility clause at line 71
- `apps/web/lib/search-skills.ts` -- getAvailableTags visibility at line 302
- `apps/web/lib/company-approved.ts` -- eq(visibility, "tenant") at line 34
- `apps/web/lib/similar-skills.ts` -- uses visibilitySQL/buildVisibilityFilter
- `apps/mcp/src/tools/everyskill.ts` -- Zod enum ["tenant", "personal"] at line 112
- `apps/mcp/src/tools/create.ts` -- visibility type "tenant" | "personal"
- `apps/mcp/src/tools/update-skill.ts` -- visibility type "tenant" | "personal"
- `apps/web/components/skill-upload-form.tsx` -- visibility radio buttons
- `packages/db/src/migrations/0005_enforce_tenant_id.sql` -- RLS policy definitions
- `packages/db/src/migrations/0019_add_skill_visibility.sql` -- visibility column + indexes

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` -- Pitfall 1 (visibility dual-pattern) verified
- `.planning/research/ARCHITECTURE.md` -- Priority 4 visibility architecture

### Tertiary (LOW confidence)
- RLS policy behavior with RESTRICTIVE vs PERMISSIVE when RLS is ENABLED but NOT FORCED -- confirmed from PostgreSQL docs that table owner bypasses RLS, making this a forward-looking change only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, purely modification work
- Architecture: HIGH -- every file and line number verified from codebase
- Pitfalls: HIGH -- all 8+ inline locations confirmed with line numbers
- RLS implications: MEDIUM -- RLS is not forced so policy change is theoretical until FORCE is enabled
- Private vs Personal semantics: MEDIUM -- requirements say 4 levels but exact portfolio/resume behavior needs confirmation

**Research date:** 2026-02-16
**Valid until:** Stable (visibility is fundamental infrastructure, unlikely to change externally)
