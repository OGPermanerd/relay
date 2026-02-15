# Contributing to EverySkill

## Development Setup

### Prerequisites
- Node.js 22+
- pnpm 9+
- PostgreSQL 16 with pgvector extension
- Google OAuth credentials (ask the project lead)

### First-Time Setup

```bash
git clone <repository-url>
cd everyskill
pnpm install

# Configure environment
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with DATABASE_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# Set up database
pnpm db:migrate

# Start development server
cd apps/web && npm run dev
# Visit http://localhost:2002
```

### Daily Workflow

```bash
git pull origin master
pnpm install              # if lockfile changed
cd apps/web && npm run dev
```

---

## Project Structure

```
everyskill/
├── apps/
│   ├── web/                    # Next.js 16 web application
│   │   ├── app/                # App Router pages and API routes
│   │   │   ├── (protected)/    # Authenticated pages (layout wraps with auth)
│   │   │   ├── actions/        # Server actions (form mutations)
│   │   │   └── api/            # REST API routes
│   │   ├── components/         # React components (client + server)
│   │   ├── lib/                # Shared utilities, search, AI integrations
│   │   └── tests/e2e/          # Playwright E2E tests
│   └── mcp/                    # MCP server (stdio + HTTP transports)
│       └── src/tools/          # MCP tool handlers
├── packages/
│   ├── core/                   # Shared types and constants
│   ├── db/                     # Database layer
│   │   └── src/
│   │       ├── schema/         # Drizzle table definitions
│   │       ├── services/       # Data access functions
│   │       ├── migrations/     # SQL migration files
│   │       └── relations/      # Drizzle relation definitions
│   ├── storage/                # File storage abstractions
│   └── ui/                     # Shared UI components
└── docs/                       # Documentation
```

### Key Conventions

| Pattern | Location | Example |
|---------|----------|---------|
| Pages | `apps/web/app/(protected)/` | `skills/[slug]/page.tsx` |
| Server actions | `apps/web/app/actions/` | `skill-feedback.ts` |
| API routes | `apps/web/app/api/` | `track/route.ts` |
| DB schema | `packages/db/src/schema/` | `skills.ts` |
| DB services | `packages/db/src/services/` | `skill-feedback.ts` |
| Components | `apps/web/components/` | `suggestion-form.tsx` |
| Utilities | `apps/web/lib/` | `sanitize-payload.ts` |
| E2E tests | `apps/web/tests/e2e/` | `skill-detail.spec.ts` |

---

## Code Style

### TypeScript
- Strict mode enabled across all packages
- No `any` types (enforced by ESLint)
- Unused variables prefixed with `_`
- Prefer `interface` over `type` for object shapes
- Use `satisfies` for type narrowing where appropriate

### React
- Server components by default; add `"use client"` only when needed
- `useActionState` for form mutations (React 19 pattern)
- No `toLocaleDateString()` or `toLocaleString()` in client components (causes hydration mismatches)
- Use manual UTC formatting for dates passed from server to client
- Server-to-client date serialization: `.toISOString()` before passing, accept `string` in client interfaces

### Database
- All tables must have `tenant_id` NOT NULL FK to `tenants`
- Services return plain objects, not Drizzle row types
- Fire-and-forget pattern for non-critical writes: `void asyncFunction()`
- Use `sql.raw()` for identifiers, `.toISOString()` for dates in SQL templates

### Server Actions
- Always validate with Zod schemas
- Always check `auth()` session at the top
- Always sanitize user input via `sanitizePayload()` before storage
- Use `revalidatePath()` after mutations that affect the current page
- Don't re-export types from `"use server"` files (causes bundler errors)

### File Naming
- Components: `kebab-case.tsx` (e.g., `suggestion-form.tsx`)
- Pages: `page.tsx` in route directories
- Server actions: `kebab-case.ts` in `app/actions/`
- DB services: `kebab-case.ts` in `packages/db/src/services/`

---

## Testing

### E2E Tests (Playwright)

```bash
cd apps/web

# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/skill-detail.spec.ts

# Run with UI mode
npx playwright test --ui

# Run headed (visible browser)
npx playwright test --headed
```

**Important**: E2E tests may stop the dev server. Always restart it after running tests:
```bash
cd apps/web && npm run dev
```

### Auth in Tests
- `auth.setup.ts` seeds a test user and creates a JWT session
- Storage state saved to `playwright/.auth/user.json`
- Tests run authenticated via the setup project dependency

### Writing Tests
- Test files go in `apps/web/tests/e2e/*.spec.ts`
- Follow existing patterns for page load verification
- Always check for hydration errors (no client-side console errors)
- 3 test accounts available (a, b, c) — labels are arbitrary

### Unit Tests (vitest)

```bash
pnpm test
```

---

## Database Changes

### Adding a Column

1. Create migration file: `packages/db/src/migrations/NNNN_description.sql`
2. Update schema: `packages/db/src/schema/<table>.ts`
3. Run migration: `cd packages/db && source ../../apps/web/.env.local && export DATABASE_URL && pnpm db:migrate`
4. Update services if needed: `packages/db/src/services/<service>.ts`
5. Update exports: `packages/db/src/services/index.ts`

### Migration Numbering
- Sequential 4-digit prefix: `0000`, `0001`, ..., `0035`
- Descriptive suffix: `0035_enable_advanced_features_by_default.sql`
- Custom runner tracks in `_applied_migrations` table (NOT Drizzle's built-in tracking)
- Run with `pnpm db:migrate`, NOT `drizzle-kit migrate`

### Adding a Service Function
1. Add function to `packages/db/src/services/<service>.ts`
2. Export from `packages/db/src/services/index.ts`
3. Import in server actions or API routes as `@everyskill/db/services/<service>`

---

## Common Patterns

### Server Action with Form
```typescript
"use server";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({ /* ... */ });

export type ActionState = { success?: boolean; error?: string; errors?: Record<string, string[]> };

export async function myAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // ... do work ...
  revalidatePath("/relevant/path");
  return { success: true };
}
```

### Client Form Component
```typescript
"use client";
import { useActionState } from "react";
import { myAction, type ActionState } from "@/app/actions/my-action";

export function MyForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionState, formData: FormData) => myAction(formData),
    {} as ActionState
  );

  return (
    <form action={formAction}>
      {/* inputs */}
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
```

### Fire-and-Forget DB Write
```typescript
// Don't await — let it complete in the background
void insertTokenMeasurement({ skillId, model, tokens });
```

---

## Pre-Commit Hooks

Husky + lint-staged runs automatically on `git commit`:
- **ESLint** with auto-fix on `.ts` and `.tsx` files
- **Prettier** formatting on all staged files

If a hook fails, fix the issue and create a new commit (don't amend).

---

## Deployment

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for full deployment documentation.

Quick reference:
```bash
./deploy.sh staging   # Build + deploy to staging
./deploy.sh promote   # Promote staging to production
```

---

*Last updated: 2026-02-15*
