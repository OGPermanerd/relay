# Phase 43: User Preferences - Research

**Researched:** 2026-02-13
**Domain:** User preferences storage (JSONB), settings UI, CLAUDE.md generation
**Confidence:** HIGH

## Summary

User preferences require a new `user_preferences` table with a JSONB `preferences` column, a settings page at `/settings/preferences`, and a CLAUDE.md export feature. The codebase already has a well-established pattern for user settings via the `notification_preferences` table and its corresponding service/action/UI stack, which this phase should mirror closely.

The skill categories are hardcoded as `["prompt", "workflow", "agent", "mcp"]`. Sort options are `["uses", "quality", "rating", "days_saved"]`. These become the valid values for preferred categories and default sort preferences.

For CLAUDE.md generation, the user's published skills (queried via `skills.authorId`) provide the portfolio data. The skill content field contains the full markdown (with frontmatter), and the deploy tool already demonstrates the pattern for building structured markdown output from skill data.

**Primary recommendation:** Add a `user_preferences` table with JSONB column, create a preferences service following the `notification-preferences` pattern, build a settings page with sub-navigation, and add a CLAUDE.md export endpoint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema + queries | Already in use, pgTable + jsonb column type |
| zod | 3.x | Preferences validation | Already used in all server actions |
| next.js | 16.1.6 | Server components + server actions | Existing app framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | (existing) | URL state for sort/filter defaults | Already used in skills-table for sort state |

### No New Dependencies Required

All functionality can be built with existing packages. JSONB column + Zod validation is the established pattern (see `skill-reviews.ts` schema with `.$type<ReviewCategories>()`).

## Architecture Patterns

### Existing Settings Structure
```
apps/web/app/(protected)/settings/
  notifications/
    page.tsx                           # Server component, fetches prefs
    notification-preferences-form.tsx   # Client component, useActionState
```

### Proposed Structure
```
apps/web/app/(protected)/settings/
  layout.tsx                            # NEW: settings sub-nav (Notifications | Preferences | Export)
  page.tsx                              # NEW: redirect to /settings/preferences
  notifications/
    page.tsx                            # EXISTING (unchanged)
    notification-preferences-form.tsx   # EXISTING (unchanged)
  preferences/
    page.tsx                            # NEW: server component
    preferences-form.tsx                # NEW: client form component
  export/
    page.tsx                            # NEW: CLAUDE.md generation page
    claude-md-preview.tsx               # NEW: client preview + download component

packages/db/src/schema/
  user-preferences.ts                   # NEW: table definition

packages/db/src/services/
  user-preferences.ts                   # NEW: getOrCreate + update

apps/web/app/actions/
  user-preferences.ts                   # NEW: server actions
  export-claude-md.ts                   # NEW: CLAUDE.md generation action
```

### Pattern: JSONB with Zod Validation and Code-Defined Defaults

This is the recommended approach (PREF-02 requirement). The pattern:

1. **Schema**: Single JSONB column with `.$type<T>()` for TypeScript typing
2. **Zod schema**: Validates on write, defines shape
3. **Code defaults**: Merged at read time (not stored in DB), so new fields can be added without migration
4. **Service**: `getOrCreate` pattern (same as notification-preferences)

### Pattern: Server Action with FormData (existing, well-proven)

The notification preferences action shows the exact pattern:
- `useActionState` in client component
- FormData parsing in server action
- Checkbox = "on" when checked, absent when unchecked
- Select = string value
- Return `{ success?: boolean; error?: string }`

### Anti-Patterns to Avoid
- **Adding columns to the users table:** The users table is Auth.js managed (DrizzleAdapter). Adding non-standard columns risks adapter conflicts. Use a separate table.
- **Storing defaults in DB:** If defaults change (e.g., adding a new preference field), rows with stored defaults would need migration. Instead, merge code defaults at read time.
- **Re-exporting types from "use server" files:** Causes runtime bundler errors (documented in MEMORY.md).

## Current State of Key Data

### Skill Categories (hardcoded)
```typescript
// From apps/web/app/actions/skills.ts (Zod schema)
z.enum(["prompt", "workflow", "agent", "mcp"])

// From apps/mcp/src/tools/list.ts
z.enum(["prompt", "workflow", "agent", "mcp"])

// From apps/web/lib/skill-type-utils.ts (URL mapping)
// "claude-skill" -> ["agent"]
// "ai-prompt" -> ["prompt"]
// "other" -> ["workflow", "mcp"]
```

### Sort Options (from search-skills.ts)
```typescript
sortBy?: "uses" | "quality" | "rating" | "days_saved"
// Default (no sortBy): orders by days_saved DESC
```

### Sort Options (from skills-table client-side sort)
```typescript
const SORT_COLUMNS = ["name", "days_saved", "installs", "date", "author", "rating"] as const;
// Default: days_saved descending
```

### Users Table (current)
```typescript
// packages/db/src/schema/users.ts
{
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("member"),
  name: text("name"),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}
```
This is Auth.js-managed. Do NOT add columns here.

### Auth Session Shape
```typescript
// apps/web/types/next-auth.d.ts
interface Session {
  user: {
    tenantId?: string;
    role?: "admin" | "member";
  } & DefaultSession["user"]; // id, name, email, image
}
```

### Navigation
```
Header nav: Home | Skills | Analytics | Profile | Admin (if admin)
```
The Profile page links to `/my-skills` and has an API key setup wizard. There is NO link to `/settings/notifications` in the main nav -- it's only reachable from the notification bell dropdown.

Settings pages are currently orphaned from main nav. The preferences page should be linked from the Profile page (add a "Settings" section with links to Preferences, Notifications, Export).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONB validation | Manual type guards | Zod `.safeParse()` on read/write | Edge cases with partial data, future field additions |
| Default merging | If-checks per field | Spread operator: `{ ...DEFAULTS, ...stored }` | Clean, extensible, handles missing fields |
| Settings layout/nav | Inline conditional links | Shared layout.tsx with sub-nav | Already needed for notifications page |
| Markdown generation | String concatenation | Template literals with sections | Readable, maintainable |

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Date Formatting
**What goes wrong:** Using `toLocaleDateString()` causes server/client mismatch
**Why it happens:** Node.js and browser Intl implementations differ
**How to avoid:** Use manual UTC formatting (documented in MEMORY.md)
**Warning signs:** React hydration warnings in console

### Pitfall 2: Auth.js Adapter Column Conflicts
**What goes wrong:** Adding columns to users table breaks DrizzleAdapter
**Why it happens:** Auth.js DrizzleAdapter expects specific column shape
**How to avoid:** Use separate `user_preferences` table with `userId` FK
**Warning signs:** Auth errors after schema changes

### Pitfall 3: JSONB Default Handling on Schema Evolution
**What goes wrong:** Adding new preference fields returns `undefined` for existing rows
**Why it happens:** Old rows don't have the new field in their JSONB
**How to avoid:** Always merge with code defaults: `{ ...DEFAULTS, ...row.preferences }`
**Warning signs:** TypeError on accessing new preference fields

### Pitfall 4: FormData Checkbox Parsing
**What goes wrong:** Unchecked checkboxes are absent from FormData (not "off")
**Why it happens:** HTML spec -- unchecked checkboxes don't submit
**How to avoid:** Use `formData.get("field") === "on"` pattern (already used in notification-preferences)
**Warning signs:** All booleans save as false

### Pitfall 5: Re-exporting Types from Server Actions
**What goes wrong:** Runtime bundler errors
**Why it happens:** "use server" files have special bundling rules
**How to avoid:** Define shared types in separate files, import in both action and component
**Warning signs:** Webpack/Turbopack errors mentioning "use server"

## Schema Design

### Recommended: Separate Table with JSONB

```typescript
// packages/db/src/schema/user-preferences.ts
import { pgTable, text, timestamp, jsonb, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

export interface UserPreferencesData {
  preferredCategories: string[];  // subset of ["prompt", "workflow", "agent", "mcp"]
  defaultSort: string;            // one of "uses" | "quality" | "rating" | "days_saved"
  claudeMdWorkflowNotes: string;  // free-text personal workflow notes for CLAUDE.md
}

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    userId: text("user_id").notNull().unique().references(() => users.id),
    preferences: jsonb("preferences").$type<UserPreferencesData>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_preferences_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Zod Validation Schema

```typescript
import { z } from "zod";

export const SKILL_CATEGORIES = ["prompt", "workflow", "agent", "mcp"] as const;
export const SORT_OPTIONS = ["uses", "quality", "rating", "days_saved"] as const;

export const userPreferencesSchema = z.object({
  preferredCategories: z.array(z.enum(SKILL_CATEGORIES)).default([]),
  defaultSort: z.enum(SORT_OPTIONS).default("days_saved"),
  claudeMdWorkflowNotes: z.string().max(2000).default(""),
});

export type UserPreferencesData = z.infer<typeof userPreferencesSchema>;

export const PREFERENCES_DEFAULTS: UserPreferencesData = {
  preferredCategories: [],
  defaultSort: "days_saved",
  claudeMdWorkflowNotes: "",
};
```

### Migration (0020)

```sql
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_preferences_tenant_id_idx ON user_preferences(tenant_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_preferences
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

## CLAUDE.md Generation Design

### Data Sources for CLAUDE.md
1. **User info:** `session.user.name`, `session.user.email`
2. **User preferences:** `preferredCategories`, `claudeMdWorkflowNotes`
3. **User's published skills:** Query `skills` where `authorId = userId` and `status = 'published'`
4. **Skill details per skill:** `name`, `category`, `description`, `tags`, `content` (for extracting key patterns)

### CLAUDE.md Template Structure

```markdown
# {userName}'s AI Configuration

Generated from EverySkill profile on {date}.

## About Me
{claudeMdWorkflowNotes if set, otherwise omit section}

## My Skill Areas
{preferredCategories as prose, e.g. "I primarily work with prompts and workflows."}

## Skills Portfolio

### {skillName}
- **Category:** {category}
- **Description:** {description}
- **Tags:** {tags joined}
- **Impact:** {totalUses} uses, {hoursSaved}h saved per use

{Repeat for each published skill, ordered by totalUses desc}

## Workflow Preferences
- Default skill sort: {defaultSort as human-readable}
- Preferred categories: {preferredCategories joined}

---
*Generated by EverySkill (everyskill.ai)*
```

### Implementation Approach
- Server action `generateClaudeMd()` fetches user data + skills + preferences
- Returns markdown string
- Client component shows preview (read-only textarea or markdown render)
- "Copy to Clipboard" and "Download as CLAUDE.md" buttons
- No file system operations -- user downloads and places the file themselves

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `packages/db/src/schema/user-preferences.ts` | Table schema + types |
| `packages/db/src/services/user-preferences.ts` | getOrCreate, update, getPreferences |
| `packages/db/src/migrations/0020_add_user_preferences.sql` | Migration |
| `apps/web/app/(protected)/settings/layout.tsx` | Settings sub-navigation layout |
| `apps/web/app/(protected)/settings/page.tsx` | Redirect to /settings/preferences |
| `apps/web/app/(protected)/settings/preferences/page.tsx` | Preferences page (server component) |
| `apps/web/app/(protected)/settings/preferences/preferences-form.tsx` | Client form component |
| `apps/web/app/actions/user-preferences.ts` | Server actions (get, save) |
| `apps/web/app/(protected)/settings/export/page.tsx` | CLAUDE.md export page |
| `apps/web/app/(protected)/settings/export/claude-md-preview.tsx` | Preview + download client component |
| `apps/web/app/actions/export-claude-md.ts` | CLAUDE.md generation server action |
| `apps/web/lib/preferences-defaults.ts` | Shared Zod schema + defaults (avoid "use server" re-export issues) |

### Modified Files
| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Add `export * from "./user-preferences"` |
| `packages/db/src/services/index.ts` | Add exports from user-preferences service |
| `packages/db/src/relations/index.ts` | Add `userPreferencesRelations` |
| `apps/web/app/(protected)/profile/page.tsx` | Add "Settings" section with links to Preferences, Notifications, Export |

### NOT Modified
| File | Reason |
|------|--------|
| `packages/db/src/schema/users.ts` | Auth.js managed -- do not add columns |
| `apps/web/app/(protected)/layout.tsx` | No nav change -- settings accessed via Profile page |

## Plan Structure Recommendation

### Plan 1: Schema + Service + Migration (foundation)
- Create `user-preferences.ts` schema
- Create `user-preferences.ts` service (getOrCreate, update)
- Create migration SQL
- Update schema/index.ts, services/index.ts, relations/index.ts
- Create `apps/web/lib/preferences-defaults.ts` (shared Zod schema + defaults)
- Run migration
- **Verify:** Service unit-level check (import and call getOrCreate)

### Plan 2: Settings Layout + Preferences UI Page
- Create settings layout.tsx with sub-nav (Preferences | Notifications | Export)
- Create settings/page.tsx (redirect)
- Create preferences/page.tsx (server component)
- Create preferences-form.tsx (client form)
- Create user-preferences server action
- Add Settings links on Profile page
- **Verify:** Playwright test loads /settings/preferences, saves, and persists

### Plan 3: CLAUDE.md Export
- Create export-claude-md.ts server action (generates markdown from user data + skills + preferences)
- Create export/page.tsx (server component)
- Create claude-md-preview.tsx (client: preview, copy, download)
- **Verify:** Playwright test loads /settings/export, generates preview, downloads file

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/users.ts` - current users table shape
- `packages/db/src/schema/notification-preferences.ts` - pattern for per-user settings table
- `packages/db/src/services/notification-preferences.ts` - getOrCreate + update pattern
- `apps/web/app/actions/notification-preferences.ts` - server action pattern
- `apps/web/app/(protected)/settings/notifications/` - settings page + form pattern
- `apps/web/lib/search-skills.ts` - sort options and category types
- `apps/web/app/actions/skills.ts` - Zod validation pattern, category enum
- `apps/web/hooks/use-sort-state.ts` - client-side sort columns
- `apps/mcp/src/tools/deploy.ts` - skill content format with frontmatter
- `apps/web/app/(protected)/profile/page.tsx` - profile page structure (where to add settings links)
- `packages/db/src/relations/index.ts` - all existing relation definitions

### Secondary (MEDIUM confidence)
- MEMORY.md entries on hydration prevention, "use server" re-export issues, and Auth.js adapter behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new deps
- Architecture: HIGH - directly mirrors existing notification-preferences pattern
- Schema design: HIGH - JSONB + Zod is proven pattern in codebase (skill-reviews)
- CLAUDE.md generation: HIGH - data sources verified, template is straightforward
- Pitfalls: HIGH - all documented from prior project experience (MEMORY.md)

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable -- no external dependencies or fast-moving APIs)
