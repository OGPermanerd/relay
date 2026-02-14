# Phase 49: Tenant Resolution Cleanup - Research

**Researched:** 2026-02-14
**Domain:** Multi-tenancy cleanup / session-based tenant resolution
**Confidence:** HIGH

## Summary

This phase eliminates the hardcoded `DEFAULT_TENANT_ID` constant from all runtime code paths, replacing it with tenant resolution from the authenticated session (`session.user.tenantId`). The constant is currently defined in `packages/db/src/client.ts` and exported via `packages/db/src/index.ts`, then used in 18+ runtime source files as a fallback when tenant resolution hasn't been implemented.

The good news: the infrastructure is already in place. Auth.js (Phase 26) already resolves tenantId from email domain via `getTenantByDomain()` in the jwt callback, injects it into the JWT token, and exposes it as `session.user.tenantId`. The MCP auth module (`apps/mcp/src/auth.ts`) already resolves tenantId from API key validation (the `validateApiKey` service returns tenantId from the api_keys table). Most files already have `const session = await auth()` calls -- they just fall back to DEFAULT_TENANT_ID instead of using `session.user.tenantId`.

The work is straightforward mechanical refactoring across four categories: (1) server actions that already have sessions, (2) server components/pages that already have sessions, (3) MCP tools that get tenantId from auth module, (4) library/utility functions that need tenantId passed as a parameter. The key risk is regression -- every file change must preserve identical behavior while switching the tenant source.

**Primary recommendation:** Systematically replace all runtime `DEFAULT_TENANT_ID` usages with `session.user.tenantId` (web app) or `getTenantId()` (MCP), keeping the constant only in the seed script, test fixtures, migration files, and the DB connection default.

## Standard Stack

### Core (Already in place -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Auth.js (next-auth) | v5 | Session management, JWT with tenantId claim | Already carries tenantId |
| @everyskill/db | local | DB schema, client, services | Already exports withTenant() |
| drizzle-orm | 0.42.0 | ORM with RLS pgPolicy support | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | existing | E2E regression testing | Verify no regressions |
| vitest | existing | Unit testing (MCP) | Verify MCP tools |

**Installation:** No new packages needed. This is pure refactoring.

## Architecture Patterns

### Pattern 1: Session-Based Tenant Resolution in Server Actions

**What:** Server actions already call `await auth()` and check `session?.user?.id`. The tenant is available as `session.user.tenantId`.

**Current pattern (TO REPLACE):**
```typescript
// BAD: Hardcoded fallback
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export async function someAction() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  await db.insert(skills).values({
    tenantId: DEFAULT_TENANT_ID,  // <-- hardcoded
    authorId: session.user.id,
    ...
  });
}
```

**Target pattern (REPLACEMENT):**
```typescript
export async function someAction() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const tenantId = session.user.tenantId;
  if (!tenantId) return { error: "Tenant not resolved" };

  await db.insert(skills).values({
    tenantId,  // <-- from session
    authorId: session.user.id,
    ...
  });
}
```

### Pattern 2: Null-Coalescing Pattern (Already Partially Used)

Some files already use the correct pattern with fallback:
```typescript
const tenantId = session?.user?.tenantId ?? DEFAULT_TENANT_ID;
```

These need to change to strict resolution (no fallback):
```typescript
const tenantId = session.user.tenantId;
if (!tenantId) throw new Error("Tenant not resolved");
```

### Pattern 3: MCP Tool Tenant Resolution

MCP tools already have `getTenantId()` from `apps/mcp/src/auth.ts` which caches the tenantId from API key validation. The pattern is:

```typescript
// Current (in apps/mcp/src/tools/create.ts):
const tenantId = getTenantId() || DEFAULT_TENANT_ID;

// Target:
const tenantId = getTenantId();
if (!tenantId) {
  return { content: [{ type: "text", text: JSON.stringify({ error: "Tenant not resolved" }) }], isError: true };
}
```

### Pattern 4: Utility Functions That Need TenantId Passed In

Functions like `generateSkillEmbedding()` and `getGreeting()` don't have access to the session. They need tenantId passed as a parameter:

```typescript
// Current (embedding-generator.ts):
export async function generateSkillEmbedding(skillId: string, name: string, description: string) {
  // uses DEFAULT_TENANT_ID internally
}

// Target:
export async function generateSkillEmbedding(skillId: string, name: string, description: string, tenantId: string) {
  // tenantId passed from caller (who has the session)
}
```

### Pattern 5: DB Connection Default (KEEP AS-IS)

The connection-level default in `packages/db/src/client.ts` line 41:
```typescript
connection: {
  "app.current_tenant_id": DEFAULT_TENANT_ID,
}
```
This sets the PostgreSQL session variable for RLS policies on every new connection. This is a **legitimate bootstrap default** -- without it, RLS policies would reject all queries before any tenant context is set. This stays until `withTenant()` wraps all DB operations (a separate, larger effort).

### Anti-Patterns to Avoid

- **Removing DEFAULT_TENANT_ID entirely from the codebase:** The constant is still needed for (a) DB connection bootstrap, (b) seed script, (c) test fixtures, (d) migration SQL, (e) users table schema default. Only runtime resolution should stop using it.
- **Making tenantId optional in runtime paths:** All authenticated code paths MUST have a tenantId. The phase goal is to make the runtime error-safe, not silently fallback.
- **Breaking the seed script:** `packages/db/src/seed.ts` uses its own `TENANT_ID` constant (not DEFAULT_TENANT_ID) and is already correct.
- **Changing the users table schema default:** The `.default("default-tenant-000-0000-000000000000")` in `users.ts` is needed for DrizzleAdapter compatibility (new users are inserted before the jwt callback resolves their tenant).

## Comprehensive File Inventory

### Category A: Server Actions (auth session available) -- 9 files
These already call `await auth()`. Replace hardcoded DEFAULT_TENANT_ID with `session.user.tenantId`.

| File | Usages | Notes |
|------|--------|-------|
| `apps/web/app/actions/skills.ts` | 6 uses (insert skills, versions, AI review) | Also passes to `autoGenerateReview()` |
| `apps/web/app/actions/ratings.ts` | 2 uses (insert rating, create notification) | |
| `apps/web/app/actions/fork-skill.ts` | 3 uses (insert skill, version) | |
| `apps/web/app/actions/api-keys.ts` | 2 uses (insert API key, rotate) | |
| `apps/web/app/actions/user-preferences.ts` | 1 use (already has fallback: `session.user.tenantId \|\| DEFAULT_TENANT_ID`) | Change to strict |
| `apps/web/app/actions/notification-preferences.ts` | 1 use (same fallback pattern) | Change to strict |
| `apps/web/app/actions/export-claude-md.ts` | 1 use (fallback pattern) | Change to strict |
| `apps/web/app/actions/skill-messages.ts` | 1 use (fallback pattern) | Change to strict |
| `apps/web/app/actions/discover.ts` | 1 use (`session?.user?.tenantId ?? DEFAULT_TENANT_ID`) | Change to strict |
| `apps/web/app/actions/get-skill-content.ts` | 1 use (import from @everyskill/db) | Change to strict |

### Category B: Server Components/Pages (auth session available) -- 5 files
These already call `await auth()`. Replace hardcoded usage with `session.user.tenantId`.

| File | Usages | Notes |
|------|--------|-------|
| `apps/web/app/(protected)/admin/layout.tsx` | 1 use (import from @everyskill/db) | Already has fallback pattern |
| `apps/web/app/(protected)/admin/reviews/page.tsx` | 1 use (import from @everyskill/db) | Already has fallback pattern |
| `apps/web/app/(protected)/admin/reviews/[skillId]/page.tsx` | 1 use (import from @everyskill/db) | Already has fallback pattern |
| `apps/web/app/(protected)/admin/search/page.tsx` | 1 use (local const) | Already has fallback pattern |
| `apps/web/app/(protected)/skills/page.tsx` | 1 use (local const) | Used for search logging |

### Category C: MCP Tools (getTenantId() available) -- 6 files
These use `getTenantId()` from `apps/mcp/src/auth.ts`. Replace `|| DEFAULT_TENANT_ID` with strict check.

| File | Usages | Notes |
|------|--------|-------|
| `apps/mcp/src/tools/create.ts` | 1 use | `getTenantId() \|\| DEFAULT_TENANT_ID` |
| `apps/mcp/src/tools/update-skill.ts` | 1 use | `getTenantId() \|\| DEFAULT_TENANT_ID` |
| `apps/mcp/src/tools/review-skill.ts` | 1 use | `tenantId \|\| DEFAULT_TENANT_ID` |
| `apps/mcp/src/tools/submit-for-review.ts` | 1 use | `tenantId \|\| DEFAULT_TENANT_ID` |
| `apps/mcp/src/tracking/events.ts` | 1 use | `getTenantId() \|\| DEFAULT_TENANT_ID` |
| `apps/web/app/api/mcp/[transport]/route.ts` | 2 uses (local const, trackUsage) | HTTP MCP endpoint |

### Category D: Utility/Library Functions (no session, need param) -- 2 files
These need their signature extended to accept tenantId as a parameter.

| File | Usages | Notes |
|------|--------|-------|
| `apps/web/lib/embedding-generator.ts` | 1 use | Needs tenantId param; callers pass from session |
| `apps/web/lib/greeting-pool.ts` | 1 use (upsert user_preferences) | Needs tenantId param from caller |

### Category E: API Routes (mixed auth) -- 2 files
| File | Usages | Notes |
|------|--------|-------|
| `apps/web/app/api/install-callback/route.ts` | 1 use | Unauthenticated route, uses API key. Already resolves tenantId from `validateApiKey`. Just remove constant fallback -- use result.tenantId or reject |
| `apps/web/app/api/dev-login/route.ts` | 1 use | Dev-only route. Can use hardcoded tenant for dev user. Keep or use a dev tenant lookup |

### Category F: DB Services (internal fallback) -- 1 file
| File | Usages | Notes |
|------|--------|-------|
| `packages/db/src/services/skill-reviews.ts` | 1 use (inline string literal, not importing constant) | `data.tenantId ?? "default-tenant-000-..."` -- make tenantId required |

### Category G: KEEP UNCHANGED -- 5 files
| File | Reason to Keep |
|------|---------------|
| `packages/db/src/client.ts` | DB connection bootstrap for RLS (lines 26, 41) |
| `packages/db/src/index.ts` | Re-export (keep for seed/test consumers) |
| `packages/db/src/schema/users.ts` | `.default()` for DrizzleAdapter new user insertion |
| `packages/db/src/scripts/backfill-embeddings.ts` | Admin script, uses skill's own tenantId already (line 105) |
| `packages/db/src/seed.ts` | Uses its own TENANT_ID, not DEFAULT_TENANT_ID |
| `packages/db/src/migrations/*` | SQL, immutable |

### Category H: Test Files (separate concern) -- 11 files
These need updating in parallel to match runtime changes. They use DEFAULT_TENANT_ID for seeding test data.

| File | Notes |
|------|-------|
| `apps/web/tests/e2e/auth.setup.ts` | Seeds test user with hardcoded tenant. Needs the test tenant to exist in DB |
| `apps/web/tests/e2e/skill-rating.spec.ts` | 2 uses in test fixtures |
| `apps/web/tests/e2e/my-skills.spec.ts` | 2 uses |
| `apps/web/tests/e2e/mcp-usage-tracking.spec.ts` | 3 uses |
| `apps/web/tests/e2e/install.spec.ts` | 2 uses |
| `apps/web/tests/e2e/fork-skill.spec.ts` | 4 uses |
| `apps/web/tests/e2e/delete-skill.spec.ts` | 2 uses |
| `apps/web/tests/e2e/ai-review.spec.ts` | 3 uses |
| `apps/web/tests/e2e/home.spec.ts` | (check for usage) |
| `apps/web/tests/e2e/skill-search.spec.ts` | (check for usage) |
| `apps/mcp/test/setup.ts` | Mock definition |
| `apps/mcp/test/*.test.ts` | (check for usage) |

**Test strategy:** Tests can KEEP using `DEFAULT_TENANT_ID` for fixture data as long as:
1. The default tenant row exists in the DB (it does -- created by migration 0002)
2. The test JWT includes `tenantId` claim
3. The test user in the DB has matching tenantId

**Critical test fix:** `auth.setup.ts` currently does NOT include `tenantId` in the JWT token (lines 60-68). The jwt callback's lazy migration will try to read from DB, but the test user is inserted with DEFAULT_TENANT_ID before jwt resolution. This should work, but adding `tenantId: DEFAULT_TENANT_ID` to the JWT payload in auth.setup.ts is safer and eliminates a DB round-trip on every test request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant resolution from session | Custom middleware/context | `session.user.tenantId` from Auth.js | Already exists and works |
| Tenant resolution from API key | Custom key parsing | `validateApiKey()` returns tenantId | Already exists and works |
| Per-request tenant isolation | Custom DB wrapper | `withTenant()` from tenant-context.ts | Handles RLS set_config safely |

**Key insight:** All the plumbing is already in place. This phase is purely about removing the hardcoded fallback and relying on the existing infrastructure.

## Common Pitfalls

### Pitfall 1: Breaking Unauthenticated Code Paths
**What goes wrong:** Some endpoints allow unauthenticated access (install-callback, MCP anonymous mode) where no session exists.
**Why it happens:** Removing DEFAULT_TENANT_ID without considering anonymous paths.
**How to avoid:** For `install-callback`, the API key validation already returns tenantId. For anonymous MCP usage, the tool should return an auth error rather than silently using a default tenant.
**Warning signs:** 500 errors on `/api/install-callback` or MCP anonymous calls.

### Pitfall 2: Missing tenantId in JWT for Test Users
**What goes wrong:** E2E tests fail because `session.user.tenantId` is undefined.
**Why it happens:** `auth.setup.ts` doesn't include `tenantId` in the JWT token.
**How to avoid:** Add `tenantId: DEFAULT_TENANT_ID` to the JWT payload in auth.setup.ts.
**Warning signs:** All E2E tests that insert data fail with "Tenant not resolved" errors.

### Pitfall 3: Circular Dependency with DB Connection Default
**What goes wrong:** Removing the DEFAULT_TENANT_ID from `client.ts` connection config breaks all queries.
**Why it happens:** RLS policies need `app.current_tenant_id` set on every connection. Without the default, the first query after connection fails.
**How to avoid:** KEEP the connection-level default. It's separate from runtime tenant resolution.
**Warning signs:** "permission denied for table" PostgreSQL errors.

### Pitfall 4: DrizzleAdapter User Insertion Race Condition
**What goes wrong:** New users fail to sign up because tenantId is required but DrizzleAdapter hasn't resolved it yet.
**Why it happens:** DrizzleAdapter inserts the user row BEFORE the jwt callback runs. The users table default provides the fallback.
**How to avoid:** KEEP the `.default("default-tenant-000-0000-000000000000")` in the users schema. The jwt callback already corrects tenantId after the initial insert.
**Warning signs:** New user sign-up fails silently.

### Pitfall 5: Utility Function Signature Changes Breaking Callers
**What goes wrong:** Adding `tenantId` parameter to `generateSkillEmbedding()` or `getGreeting()` without updating all callers.
**Why it happens:** These are fire-and-forget calls scattered across actions.
**How to avoid:** Search for ALL callers before changing the signature. TypeScript will catch missing arguments, but `.catch(() => {})` swallows errors.
**Warning signs:** Embeddings stop being generated silently. Greetings fall back to static pool.

### Pitfall 6: install-callback Route Has No Session
**What goes wrong:** Treating install-callback like a server action and expecting `session.user.tenantId`.
**Why it happens:** This route is exempted from auth in middleware -- it's called by CLI install scripts.
**How to avoid:** Install-callback already resolves tenantId from API key via `validateApiKey()`. For anonymous installs (no API key), the default tenant is the only option. This is an acceptable edge case -- anonymous installs go to default tenant.
**Warning signs:** Anonymous install tracking stops working.

### Pitfall 7: dev-login Route Creates Users Without Proper Tenant
**What goes wrong:** Dev login creates a test user with DEFAULT_TENANT_ID but no corresponding tenant lookup.
**Why it happens:** Dev-only route takes shortcuts.
**How to avoid:** This is dev-only (`NODE_ENV !== "production"`). Keep using the hardcoded constant -- it's a development convenience, not a production code path.

## Code Examples

### Example 1: Server Action Conversion (ratings.ts pattern)

```typescript
// BEFORE:
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export async function submitRating(prevState: RatingState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { message: "Not signed in" };

  await db.insert(ratings).values({
    tenantId: DEFAULT_TENANT_ID,
    skillId, userId: session.user.id, rating, comment
  });
}

// AFTER:
export async function submitRating(prevState: RatingState, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { message: "Not signed in" };

  const tenantId = session.user.tenantId;
  if (!tenantId) return { message: "Tenant not resolved" };

  await db.insert(ratings).values({
    tenantId,
    skillId, userId: session.user.id, rating, comment
  });
}
```

### Example 2: Fallback Pattern Conversion (admin pages)

```typescript
// BEFORE:
import { DEFAULT_TENANT_ID } from "@everyskill/db";
const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;

// AFTER:
const tenantId = session.user.tenantId;
if (!tenantId) redirect("/");  // Admin page -- redirect if no tenant
```

### Example 3: MCP Tool Conversion

```typescript
// BEFORE (apps/mcp/src/tools/create.ts):
import { DEFAULT_TENANT_ID } from "@everyskill/db";
const tenantId = getTenantId() || DEFAULT_TENANT_ID;

// AFTER:
const tenantId = getTenantId();
if (!tenantId) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      error: "Tenant not resolved",
      message: "API key does not have a tenant association. Please re-generate your API key."
    })}],
    isError: true,
  };
}
```

### Example 4: HTTP MCP Route (special case)

```typescript
// BEFORE (apps/web/app/api/mcp/[transport]/route.ts):
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";
// Used in trackUsage() and writeAuditLog()

// AFTER:
// The auth handler extracts userId from API key. Extend to extract tenantId:
const authHandler = withMcpAuth(handler, async (_req, bearerToken?) => {
  if (!bearerToken) return undefined;
  const result = await validateApiKey(bearerToken);
  if (!result) return undefined;
  return {
    token: bearerToken,
    clientId: result.keyId,
    scopes: [],
    extra: { userId: result.userId, tenantId: result.tenantId }, // <-- add tenantId
  };
}, { required: true });

// Then in trackUsage:
const tenantId = extra.authInfo?.extra?.tenantId as string;
```

### Example 5: Utility Function Signature Change

```typescript
// BEFORE (lib/embedding-generator.ts):
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";
export async function generateSkillEmbedding(skillId: string, name: string, description: string) {
  await upsertSkillEmbedding({ tenantId: DEFAULT_TENANT_ID, skillId, ... });
}

// AFTER:
export async function generateSkillEmbedding(skillId: string, name: string, description: string, tenantId: string) {
  await upsertSkillEmbedding({ tenantId, skillId, ... });
}

// Callers (in skills.ts):
generateSkillEmbedding(newSkill.id, name, description, tenantId).catch(() => {});
```

### Example 6: Test Setup Fix

```typescript
// BEFORE (auth.setup.ts):
const token = await encode({
  token: {
    id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name,
    sub: TEST_USER.id, iat: now, exp: expiresAt,
  },
  secret: authSecret, salt: "authjs.session-token",
});

// AFTER:
const token = await encode({
  token: {
    id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name,
    sub: TEST_USER.id, iat: now, exp: expiresAt,
    tenantId: DEFAULT_TENANT_ID,  // <-- add tenantId to JWT
  },
  secret: authSecret, salt: "authjs.session-token",
});
```

## Execution Strategy

### Recommended Order

1. **Test infrastructure first:** Update `auth.setup.ts` to include tenantId in JWT. Update `dev-login/route.ts` to include tenantId in JWT. This ensures sessions carry tenantId before we start requiring it.

2. **Utility functions next:** Update `embedding-generator.ts` and `greeting-pool.ts` signatures. All callers get TypeScript errors immediately, making it easy to find and fix them.

3. **Server actions in batch:** These are all the same pattern. Update all 9 files, remove the local `const DEFAULT_TENANT_ID` from each.

4. **Server components/pages:** Update all 5 files, same pattern.

5. **MCP tools:** Update all 6 files, same pattern (use getTenantId() strictly).

6. **API routes:** Handle install-callback (keep API key resolution, handle anonymous case) and HTTP MCP route (extend auth info with tenantId).

7. **DB services:** Make tenantId required in `skill-reviews.ts` upsert params.

8. **Clean up exports:** The DEFAULT_TENANT_ID export in `packages/db/src/index.ts` can remain for test consumers, but add a comment marking it as "bootstrap/test only."

9. **Run ALL E2E tests:** Full regression suite.

### File Count Summary

| Category | Files | Approach |
|----------|-------|----------|
| Server actions | 10 | Session-based, remove local const |
| Server components | 5 | Session-based, remove import |
| MCP tools | 6 | getTenantId() strict |
| API routes | 2 | Mixed (API key, dev-only) |
| Utility functions | 2 | Add tenantId param |
| DB services | 1 | Make param required |
| Test files | ~11 | Add tenantId to JWT |
| **Total** | **~37** | |

## Open Questions

1. **Anonymous MCP usage policy**
   - What we know: MCP tracking currently uses DEFAULT_TENANT_ID for anonymous users (no API key)
   - What's unclear: Should anonymous MCP usage still be tracked, and if so, under which tenant?
   - Recommendation: Anonymous MCP tracking is a fire-and-forget concern. For now, skip tracking entirely if no tenantId is available (log a warning). The MCP tools already work anonymously by returning data without tracking.

2. **Anonymous install-callback tracking**
   - What we know: `/api/install-callback` accepts requests without API keys
   - What's unclear: Should anonymous installs (no API key) still be recorded?
   - Recommendation: Keep anonymous install tracking with DEFAULT_TENANT_ID as a special "unattributed" bucket. This is the only legitimate runtime use of the constant.

3. **Connection-level DEFAULT_TENANT_ID timeline**
   - What we know: The DB connection default `app.current_tenant_id` is set to DEFAULT_TENANT_ID
   - What's unclear: When will all queries use `withTenant()` instead?
   - Recommendation: Out of scope for this phase. The connection default is a safety net for RLS, not a runtime tenant resolution path. A separate phase would be needed to wrap all DB calls in `withTenant()`.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of 37+ files in /home/dev/projects/relay
- `packages/db/src/client.ts` -- DEFAULT_TENANT_ID definition and DB connection config
- `apps/web/auth.ts` -- JWT callback tenant resolution logic
- `apps/mcp/src/auth.ts` -- MCP tenant resolution from API key
- `packages/db/src/services/api-keys.ts` -- validateApiKey returns tenantId
- `packages/db/src/tenant-context.ts` -- withTenant() implementation
- `packages/db/src/schema/users.ts` -- users table default tenant
- `packages/db/src/migrations/0002_add_tenants.sql` -- default tenant creation

### Secondary (MEDIUM confidence)
- Project MEMORY.md -- historical context on multi-tenancy architecture decisions

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- exhaustive grep + manual review of every file
- Refactoring patterns: HIGH -- all patterns derived from existing codebase code
- Pitfalls: HIGH -- identified from actual architecture analysis
- Test impact: HIGH -- reviewed all test files using the constant

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- no external dependencies changing)
