# Phase 32: Admin Panel - Research

**Researched:** 2026-02-08
**Domain:** Next.js admin panel, role-based access control (RBAC), multi-tenant admin features, data table management
**Confidence:** HIGH

## Summary

Phase 32 implements a tenant-scoped admin panel with role-based access control. The codebase already has basic admin functionality (env var-based admin check at `apps/web/lib/admin.ts`) and three admin routes (`/admin/settings`, `/admin/merge`, `/admin/keys`). The work ahead involves: (1) adding a `role` enum column to the users table, (2) implementing first-user-becomes-admin logic in the auth callback, (3) migrating from env var admin checks to role-based checks, (4) building tenant settings management UI, (5) creating skill review/delete interfaces, (6) adding multi-select bulk operations for skill merging, and (7) building a compliance dashboard to show which users have hooks installed and firing.

The existing codebase provides strong foundations: multi-tenancy is complete (Phase 25), auth with JWT tenantId claims works (Phase 26), hook-based tracking exists (Phase 28), and tenant-scoped analytics are functional (Phase 29). The users table has `tenant_id`, the tenants table has configuration fields (`name`, `slug`, `domain`, `logo`), and `usage_events` tracks hook callbacks with metadata. The primary architectural decision is using a simple `role` enum on the users table (not a separate memberships table) since the requirement is exactly two roles per tenant.

**Primary recommendation:** Extend the existing admin foundation with role-based checks. Use Drizzle schema enums for type safety, implement first-user admin logic in the auth.ts jwt callback, build admin UIs with standard Tailwind CSS patterns matching existing components, and leverage the usage_events metadata to track hook compliance.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.42.0 | Database ORM with pgEnum support | Already used for all schemas |
| next.js | 16.1.6 | Server components + API routes | Existing app framework |
| next-auth | 5.0.0-beta.30 | Auth.js v5 with JWT callbacks | Already configured for multi-tenant auth |
| React | ^19.0.0 | Client components | Current framework |
| Tailwind CSS | ^4.0.0 | Styling | Used throughout existing admin pages |
| zod | ^3.25.0 | Schema validation | Already used in server actions |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | All functionality achievable with existing stack |

### Why No New Libraries
- **Data tables:** Build with native HTML tables + Tailwind (matches existing pattern in admin-merge-form.tsx). TanStack Table is overkill for small datasets.
- **Form components:** Use existing pattern of `useActionState` + server actions (see admin-settings-form.tsx, admin-merge-form.tsx).
- **Role checks:** Simple helper function `hasRole(session, 'admin')` wrapping session.user.role enum check.
- **Bulk operations:** Checkbox state management in React + hidden input fields for selected IDs (standard HTML form pattern).

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    users.ts                   # MODIFY: add role enum ('admin' | 'member')
  services/
    user.ts                    # NEW: getFirstUserInTenant(), setUserRole()
  migrations/
    0007_add_user_roles.sql    # NEW: ALTER TABLE users ADD COLUMN role

apps/web/
  lib/
    admin.ts                   # MODIFY: replace env var check with role check
    rbac.ts                    # NEW: hasRole(), requireAdmin(), isAdmin()
  app/(protected)/
    admin/
      settings/page.tsx        # MODIFY: add tenant config form
      skills/page.tsx          # NEW: skill review/delete table
      compliance/page.tsx      # NEW: hook compliance dashboard
      layout.tsx               # NEW: shared admin layout with nav
  app/actions/
    admin-tenant.ts            # NEW: updateTenantSettings()
    admin-skills.ts            # NEW: deleteSkill(), bulkMergeSkills()
  auth.ts                      # MODIFY: first-user admin logic in jwt callback
```

### Pattern 1: Role Enum on Users Table

**What:** Add a `role` column with enum type `'admin' | 'member'` to the users table. Default to `'member'`. The first user in each tenant automatically receives `'admin'` role during auth callback.

**When to use:** When you need exactly two roles per tenant and don't need complex hierarchical permissions or per-resource role assignments.

**Example:**
```typescript
// packages/db/src/schema/users.ts
import { pgTable, text, timestamp, index, pgPolicy, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('user_role', ['admin', 'member']);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull().unique(),
    name: text("name"),
    role: roleEnum("role").notNull().default("member"), // NEW
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // ... indexes and policies
);
```

**Why this pattern:**
- Type-safe: Drizzle infers `role: "admin" | "member"` in TypeScript
- Database-enforced: PostgreSQL ENUM prevents invalid values
- Simple: No JOIN needed for role checks
- Sufficient: Two-role requirement doesn't justify separate memberships table

### Pattern 2: First User Becomes Admin (Bootstrap Pattern)

**What:** In the auth.ts jwt callback, check if the signing-in user is the first user in their tenant. If yes, automatically set their role to 'admin'. Otherwise, default to 'member'.

**When to use:** When bootstrapping a new tenant without pre-seeded admin accounts and you need automatic admin assignment on first sign-in.

**Example:**
```typescript
// apps/web/auth.ts (jwt callback)
async jwt({ token, user, account, profile }) {
  // ... existing tenantId resolution logic ...

  // On initial sign-in, check if user is first in tenant
  if (account && user?.id && token.tenantId) {
    const isFirstUser = await isFirstUserInTenant(token.tenantId as string);
    const role = isFirstUser ? 'admin' : 'member';

    // Update user's role in DB
    await db!.update(users)
      .set({ role })
      .where(eq(users.id, user.id));

    token.role = role;
  }

  return token;
}
```

**Why this pattern:**
- Automatic: No manual admin seeding required
- Secure: Role set server-side during auth, not client-manipulable
- Simple: Leverages existing jwt callback timing
- Tenant-scoped: First user per tenant becomes admin (not global first user)

### Pattern 3: Server Component Role Gating

**What:** Check `session.user.role` in async server components. Redirect non-admins before rendering admin pages.

**When to use:** For page-level access control in Next.js App Router with Auth.js.

**Example:**
```typescript
// apps/web/app/(protected)/admin/settings/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    redirect("/");
  }

  // Admin-only logic here
  return <div>Admin Settings</div>;
}
```

**Why this pattern:**
- Server-side: No client JS can bypass check
- Early exit: Redirect before data fetching
- Type-safe: TypeScript knows `session.user.role` exists after augmentation

### Pattern 4: Server Actions for Admin Operations

**What:** Use Next.js server actions with role checks for admin-only mutations (delete skills, update tenant settings, bulk merge).

**When to use:** For all admin mutations that modify database state.

**Example:**
```typescript
// apps/web/app/actions/admin-skills.ts
"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteSkillAction(skillId: string) {
  const session = await auth();

  // Role check
  if (!session?.user?.id || session.user.role !== 'admin') {
    return { error: "Unauthorized" };
  }

  try {
    await db.delete(skills).where(eq(skills.id, skillId));
    revalidatePath("/admin/skills");
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete skill" };
  }
}
```

**Why this pattern:**
- Type-safe: Zod validates inputs, TypeScript enforces session shape
- Secure: Role check on server, not client
- Optimistic UI: Client components can use `useActionState` for loading states
- Cache aware: `revalidatePath` updates UI after mutation

### Pattern 5: Hook Compliance Tracking via Metadata Query

**What:** Query `usage_events` table for events with `metadata.source = 'hook'` grouped by userId. Users with recent hook events have compliance hooks installed and firing.

**When to use:** For building admin dashboards that show which users have MCP tools with PostToolUse hooks actively tracking usage.

**Example:**
```typescript
// packages/db/src/services/usage-tracking.ts
export async function getHookComplianceStatus(tenantId: string) {
  const result = await db
    .select({
      userId: usageEvents.userId,
      userName: users.name,
      userEmail: users.email,
      lastHookEvent: sql<Date>`MAX(${usageEvents.createdAt})`,
      hookEventCount: sql<number>`COUNT(*)`,
    })
    .from(usageEvents)
    .innerJoin(users, eq(usageEvents.userId, users.id))
    .where(
      and(
        eq(usageEvents.tenantId, tenantId),
        sql`${usageEvents.metadata}->>'source' = 'hook'`
      )
    )
    .groupBy(usageEvents.userId, users.name, users.email);

  return result;
}
```

**Why this pattern:**
- Leverages existing data: No new tables or columns needed
- Real-time: Shows actual hook firing activity, not just "has hook installed"
- Tenant-scoped: Filtered by tenantId for multi-tenancy compliance
- Metadata query: Uses JSONB operators to filter by `source: 'hook'`

### Pattern 6: Multi-Select Bulk Operations (Checkbox + Hidden Inputs)

**What:** Use checkboxes to select multiple table rows, store selected IDs in React state, render hidden input fields in form, submit via server action.

**When to use:** For bulk operations like "select multiple skills to merge" or "delete multiple items."

**Example:**
```tsx
// Client component with multi-select
"use client";

export function SkillBulkSelector({ skills }: { skills: Skill[] }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  return (
    <form action={bulkMergeAction}>
      <table>
        {skills.map(skill => (
          <tr key={skill.id}>
            <td>
              <input
                type="checkbox"
                checked={selected.includes(skill.id)}
                onChange={() => toggleSelection(skill.id)}
              />
            </td>
            <td>{skill.name}</td>
          </tr>
        ))}
      </table>

      {/* Hidden inputs for form submission */}
      {selected.map(id => (
        <input key={id} type="hidden" name="skillIds" value={id} />
      ))}

      <button type="submit" disabled={selected.length < 2}>
        Merge {selected.length} Skills
      </button>
    </form>
  );
}
```

**Why this pattern:**
- No library: Pure React state management
- Progressive enhancement: Works without JS (hidden inputs submit)
- Flexible: Can add "select all" checkbox easily
- Type-safe: Server action receives `FormData` with `getAll('skillIds')`

### Anti-Patterns to Avoid

- **Role in JWT only:** Don't store role exclusively in JWT — always read from DB for admin checks. JWTs can be stale.
- **Client-side role checks for security:** Never rely on `session.user.role` check in client components for access control. Only use for UI display logic.
- **Global admin role:** Don't create a single global admin role. Always scope admin privileges to tenantId.
- **Separate memberships table for 2 roles:** Overkill. Simple enum column is sufficient for two roles.
- **TanStack Table for <100 rows:** Unnecessary complexity for small admin datasets. HTML table + Tailwind suffices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum type safety | String literals everywhere | Drizzle `pgEnum` | Database enforces validity, TypeScript infers union type |
| Multi-row selection state | Manual array mutation logic | React `useState` with array helpers | Already in project, well-understood pattern |
| Form validation | Custom validation functions | Zod schemas in server actions | Already used in existing server actions |
| Role checks | Inline `if (session.user.email === X)` | Helper functions `hasRole()`, `requireAdmin()` | Centralized logic, easier to audit/change |
| Tenant config updates | Direct SQL | Server action + Drizzle ORM | Type-safe, cache-aware with `revalidatePath` |

**Key insight:** For small-scale admin features (2 roles, <1000 skills per tenant, <50 users per tenant), native browser features + React state + Drizzle ORM are simpler and more maintainable than introducing heavy libraries like TanStack Table, CASL, or Permit.io.

## Common Pitfalls

### Pitfall 1: Race Condition on First User Admin Assignment

**What goes wrong:** Two users from the same tenant sign in simultaneously. Both see "no users exist yet" and both become admins.

**Why it happens:** Time-of-check-time-of-use (TOCTOU) race between "count users" and "insert user with role=admin."

**How to avoid:** Use a database transaction with `FOR UPDATE` lock on the tenants row, or use a unique partial index (`WHERE role = 'admin'`) to enforce max 1 admin during bootstrap. Alternatively, accept that the first few seconds might result in 2 admins and provide UI for admins to demote each other.

**Warning signs:** Two users sign in within milliseconds during tenant setup, both see admin UI.

**Recommendation for this project:** Use transaction with `SELECT COUNT(*) FROM users WHERE tenant_id = X FOR UPDATE` before setting role. Lock ensures serial execution.

### Pitfall 2: Stale Role in JWT

**What goes wrong:** Admin demotes user to member, but user's session still has `role: 'admin'` in JWT until token expires (8 hours default).

**Why it happens:** JWT claims are snapshot at sign-in time, not real-time.

**How to avoid:** Always re-check role from database in critical admin actions, even if JWT says `role: 'admin'`. JWT is for performance (fast checks), DB is source of truth.

**Warning signs:** User reports "I was demoted but I can still access admin pages."

**Recommendation for this project:** In server actions that mutate data, always query `users.role` from DB. Use JWT role only for page-level gating (acceptable 8-hour lag) and UI display.

### Pitfall 3: Forgetting Tenant Isolation in Admin Queries

**What goes wrong:** Admin deletes a skill, but query doesn't filter by tenantId. Accidentally deletes skill from another tenant.

**Why it happens:** Copy-paste queries without tenant context, or forgetting to use `withTenant()` helper.

**How to avoid:** ALWAYS include `.where(eq(skills.tenantId, session.user.tenantId))` in admin queries. Better yet, use the `withTenant()` helper (Phase 25) that sets `app.current_tenant_id` connection variable and lets RLS policies enforce isolation.

**Warning signs:** Playwright tests show cross-tenant data leakage. Tenant A admin sees Tenant B's skills.

**Recommendation for this project:** Wrap all admin server actions in `withTenant(session.user.tenantId, async () => { ... })` to enforce RLS.

### Pitfall 4: No Admin Exists After Role Column Migration

**What goes wrong:** After adding `role` column with `DEFAULT 'member'`, all existing users are members. No one can access admin pages.

**Why it happens:** Migration doesn't promote existing users to admin.

**How to avoid:** In migration, after adding column, run `UPDATE users SET role = 'admin' WHERE email IN (SELECT unnest(string_to_array(...)))` using ADMIN_EMAILS env var, OR manually promote first user per tenant to admin.

**Warning signs:** After migration, `/admin/*` pages redirect to home for all users.

**Recommendation for this project:** Include in migration:
```sql
-- Set first user per tenant to admin
WITH first_users AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM users
  ORDER BY tenant_id, created_at ASC
)
UPDATE users
SET role = 'admin'
WHERE id IN (SELECT id FROM first_users);
```

### Pitfall 5: Bulk Merge Without Transaction

**What goes wrong:** User selects 3 skills to merge. First merge succeeds, second fails. Database left in inconsistent state.

**Why it happens:** Bulk operation performs multiple mutations without transaction wrapper.

**How to avoid:** Wrap bulk operations in `db.transaction()`. If any merge fails, rollback all.

**Warning signs:** Admin reports "some skills merged, some didn't" after bulk operation failure.

**Recommendation for this project:** Use Drizzle transactions:
```typescript
await db.transaction(async (tx) => {
  for (const skillId of selectedSkillIds) {
    await mergeSkill(tx, skillId, targetId);
  }
});
```

## Code Examples

### Example 1: Role Enum Schema

```typescript
// packages/db/src/schema/users.ts
// Source: Drizzle ORM pgEnum documentation
import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('user_role', ['admin', 'member']);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
// TypeScript infers: { ..., role: "admin" | "member" }
```

### Example 2: First User Admin Logic

```typescript
// packages/db/src/services/user.ts
// Source: Project-specific pattern based on auth.ts structure
import { db } from "../client";
import { users } from "../schema";
import { eq, and, sql } from "drizzle-orm";

export async function isFirstUserInTenant(tenantId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    return result.count === 0;
  } catch {
    return false;
  }
}
```

### Example 3: Auth.ts JWT Callback with Role Assignment

```typescript
// apps/web/auth.ts
// Source: Existing auth.ts jwt callback pattern
import { isFirstUserInTenant } from "@everyskill/db/services/user";

async jwt({ token, user, account, profile }) {
  // ... existing tenantId resolution logic (lines 47-85) ...

  // NEW: On initial sign-in, assign role based on first-user check
  if (account && user?.id && token.tenantId) {
    const isFirst = await isFirstUserInTenant(token.tenantId as string);
    const role = isFirst ? 'admin' : 'member';

    await db!.update(users)
      .set({ role })
      .where(eq(users.id, user.id));

    token.role = role;
  }

  // Lazy-load role for existing sessions
  if (!token.role && token.id) {
    const [dbUser] = await db!
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, token.id as string))
      .limit(1);
    if (dbUser?.role) {
      token.role = dbUser.role;
    }
  }

  return token;
}
```

### Example 4: Role Check Helper

```typescript
// apps/web/lib/rbac.ts
// Source: Project pattern inspired by existing lib/admin.ts
import { Session } from "next-auth";

export function hasRole(session: Session | null, role: 'admin' | 'member'): boolean {
  if (!session?.user?.role) return false;
  return session.user.role === role;
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, 'admin');
}

// Use in server components:
// const session = await auth();
// if (!isAdmin(session)) redirect("/");
```

### Example 5: Hook Compliance Dashboard Data

```typescript
// packages/db/src/services/usage-tracking.ts
// Source: Existing usage-tracking.ts pattern + JSONB metadata query
import { db } from "../client";
import { usageEvents, users } from "../schema";
import { eq, and, sql } from "drizzle-orm";

export async function getHookComplianceStatus(tenantId: string) {
  if (!db) return [];

  const result = await db
    .select({
      userId: usageEvents.userId,
      userName: users.name,
      userEmail: users.email,
      lastHookEvent: sql<Date>`MAX(${usageEvents.createdAt})`,
      hookEventCount: sql<number>`COUNT(*)::int`,
    })
    .from(usageEvents)
    .innerJoin(users, eq(usageEvents.userId, users.id))
    .where(
      and(
        eq(usageEvents.tenantId, tenantId),
        sql`${usageEvents.metadata}->>'source' = 'hook'`,
        sql`${usageEvents.createdAt} > NOW() - INTERVAL '30 days'`
      )
    )
    .groupBy(usageEvents.userId, users.name, users.email);

  return result;
}
```

### Example 6: Tenant Settings Update Action

```typescript
// apps/web/app/actions/admin-tenant.ts
// Source: Existing admin-settings-form.tsx action pattern
"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { tenants } from "@everyskill/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const tenantSettingsSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  logo: z.string().url().optional().or(z.literal("")),
});

export async function updateTenantSettingsAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return { error: "Unauthorized" };
  }

  const parsed = tenantSettingsSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    logo: formData.get("logo"),
  });

  if (!parsed.success) {
    return { error: "Invalid data", details: parsed.error.flatten() };
  }

  try {
    await db
      .update(tenants)
      .set({
        name: parsed.data.name,
        domain: parsed.data.domain || null,
        logo: parsed.data.logo || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.user.tenantId!));

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update tenant:", error);
    return { error: "Database error" };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Env var ADMIN_EMAILS list | Role column in database | Phase 32 (now) | Role changes take effect immediately without redeploy |
| Global admin role | Tenant-scoped admin role | Phase 25 (multi-tenancy) | Each tenant has independent admins |
| Separate memberships table | Role enum on users table | Modern RBAC pattern | Simpler schema for 2-role systems |
| Client-side role checks | Server-side role checks in server components | Next.js 13+ App Router | Security enforced server-side |
| Admin UI in separate app | Admin routes within main app | Modern monolith pattern | Shared auth, simpler deployment |

**Deprecated/outdated:**
- **ADMIN_EMAILS env var (apps/web/lib/admin.ts):** Replace with database role checks. Env var approach requires redeploy to change admin list and doesn't scale to multi-tenant.
- **Separate admin/member JWT tokens:** Auth.js v5 embeds role in JWT claims. No need for separate token types.
- **Middleware-based role checks:** Auth.js v5 with subdomains has middleware bugs (Phase 26 notes). Use server component checks instead.

## Open Questions

1. **Can multiple users be admin in one tenant?**
   - What we know: User decision says "first user becomes admin." Doesn't specify if additional admins can be promoted later.
   - What's unclear: Should there be a "promote to admin" UI? Or is it strictly 1 admin per tenant forever?
   - Recommendation: Implement first-user-becomes-admin (bootstrap), but add ability for current admin to promote other members to admin in Phase 32 settings page. Allows tenant growth without support tickets.

2. **Should demoted admins be notified?**
   - What we know: Role changes should be tracked in audit log (Phase 25 foundation exists).
   - What's unclear: Is there email notification or just audit log entry?
   - Recommendation: Defer email notifications to future phase. Audit log entry is sufficient for Phase 32. Admin sees "X demoted Y to member" in activity log.

3. **What happens to orphaned tenants (no admin)?**
   - What we know: If only admin leaves/is deleted, tenant has no admin.
   - What's unclear: Support recovery path or prevent last admin deletion?
   - Recommendation: Prevent last admin deletion with database check in delete action. Return error "Cannot delete last admin. Promote another user first."

4. **Compliance dashboard time window?**
   - What we know: Hook events are in usage_events table with timestamps.
   - What's unclear: How far back to look? Last 7 days? 30 days? All time?
   - Recommendation: Default to 30 days (matches typical compliance audit window). Make configurable per tenant in site_settings.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM pgEnum documentation - verified role enum pattern
- Next.js 16 App Router docs (auth patterns) - server component auth checks
- Auth.js v5 callbacks documentation - jwt/session callback structure
- Existing codebase: apps/web/lib/admin.ts, apps/web/auth.ts, packages/db/src/schema/users.ts - current implementation patterns
- Existing codebase: packages/db/src/services/usage-tracking.ts - hook tracking implementation
- Existing codebase: apps/web/components/admin-merge-form.tsx - form patterns

### Secondary (MEDIUM confidence)
- [Auth.js Role Based Access Control Guide](https://authjs.dev/guides/role-based-access-control) - role enum storage patterns
- [Building a Scalable Role-Based Access Control (RBAC) System in Next.js (Medium)](https://medium.com/@muhebollah.diu/building-a-scalable-role-based-access-control-rbac-system-in-next-js-b67b9ecfe5fa) - enum patterns
- [NEXT.JS with PostgreSQL Role Based Access Control implementation (Medium)](https://medium.com/@nikitinal.nal/next-js-with-postgresql-role-based-access-control-implementation-ca024fd6d471) - PostgreSQL role enum
- [Shadcn Data Table documentation](https://www.shadcn.io/ui/data-table) - row selection patterns (verified project doesn't use shadcn)
- [TanStack Table](https://tanstack.com/table/latest) - row selection API reference (decided against using)
- [PatternFly Bulk Selection Pattern](https://www.patternfly.org/patterns/bulk-selection/) - UX patterns for multi-select
- [Clerk RBAC Documentation](https://clerk.com/docs/guides/secure/basic-rbac) - role check patterns
- [Microsoft 365 Audit Log Activities](https://learn.microsoft.com/en-us/purview/audit-log-activities) - admin audit log patterns

### Tertiary (LOW confidence)
- [Bootstrapping an Admin account in Meteor (DEV Community)](https://dev.to/jankapunkt/bootstrapping-an-admin-account-in-meteor-408b) - first-user admin pattern concept
- Web search results on admin dashboard patterns (general concepts, not framework-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in project, verified in package.json
- Architecture patterns: HIGH - all patterns based on existing codebase files + official Drizzle/Next.js docs
- Role enum implementation: HIGH - Drizzle pgEnum documented feature
- First-user admin logic: MEDIUM - pattern verified in other frameworks but custom implementation for this project
- Hook compliance tracking: HIGH - existing usage_events table and metadata structure verified in codebase
- Multi-select patterns: MEDIUM - standard HTML/React pattern but no existing bulk-select example in codebase
- Admin audit logging: MEDIUM - writeAuditLog exists but not yet wired to user actions

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain with established patterns)
