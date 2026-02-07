# Phase 01: Project Foundation - Research

**Researched:** 2026-01-31
**Domain:** Monorepo scaffolding, Next.js 15+, PostgreSQL, CI/CD, E2E testing
**Confidence:** HIGH

## Summary

This phase establishes the development infrastructure for Relay: a Turborepo monorepo with Next.js 15+, PostgreSQL via Docker Compose, Drizzle ORM for migrations, and Playwright for E2E testing. The technology choices are well-established with strong community adoption and official documentation.

Key findings:
- **Turborepo + pnpm** is the standard monorepo solution for Next.js applications, with native workspace support and excellent caching
- **Drizzle ORM** provides type-safe schema management with simple migration workflows (`generate` + `migrate`)
- **Playwright** integrates seamlessly with Next.js via `webServer` config for automatic dev server management
- **ESLint flat config** is now standard in ESLint 9+; Next.js 16 removes `next lint` in favor of native ESLint
- **Tailwind CSS v4** uses CSS-first configuration with no `tailwind.config.js` required

**Primary recommendation:** Use `create-turbo@latest` with pnpm workspaces, configure shared packages with `workspace:*` protocol, and set up CI with GitHub Actions caching Turborepo artifacts.

## Standard Stack

The established libraries/tools for project foundation:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Turborepo** | 2.x | Monorepo build orchestration | Official Vercel tool, excellent caching, integrates with Next.js |
| **pnpm** | 9.x | Package manager | Fastest installs, strict dependency resolution, native workspace support |
| **Next.js** | 15.5+ or 16.x | Web framework | React 19 support, App Router, Server Components, industry standard |
| **TypeScript** | 5.6+ | Type safety | Required for end-to-end type safety with Drizzle and tRPC |
| **Drizzle ORM** | 0.40+ | Database ORM | Type-safe, SQL-transparent, excellent serverless/edge support |
| **PostgreSQL** | 16+ | Database | Enterprise-grade, full-text search, JSONB support |
| **Playwright** | 1.50+ | E2E testing | Cross-browser, auto-waiting, excellent Next.js integration |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Husky** | 9.x | Git hooks | Pre-commit linting/formatting |
| **lint-staged** | 15.x | Staged file linting | Run linters only on changed files |
| **ESLint** | 9.x | Linting | Code quality enforcement |
| **Prettier** | 3.x | Formatting | Consistent code style |
| **Tailwind CSS** | 4.x | Styling | Utility-first CSS, shadcn/ui foundation |
| **shadcn/ui** | latest | UI components | Accessible, customizable, copy-paste components |
| **Docker Compose** | 2.x | Local services | PostgreSQL container management |
| **Vitest** | 2.x | Unit testing | Fast, TypeScript-native, Jest-compatible |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Turborepo | Nx | Nx has more features but steeper learning curve; Turborepo simpler for Vercel stack |
| pnpm | yarn | yarn Berry has PnP mode; pnpm's symlink approach is more conventional |
| Drizzle | Prisma | Prisma has better DX for beginners but larger bundle, slower cold starts |
| Playwright | Cypress | Cypress has better DX for component testing; Playwright better for true E2E |
| Vitest | Jest | Jest is slower but has larger ecosystem; Vitest recommended for new projects |

**Installation:**
```bash
# Create monorepo
pnpm dlx create-turbo@latest relay --package-manager pnpm

# Or manually
pnpm init
pnpm add -D turbo

# Core dependencies (in apps/web)
pnpm add next@latest react@latest react-dom@latest
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit typescript @types/node @types/react

# Testing
pnpm add -D @playwright/test vitest @vitejs/plugin-react @testing-library/react

# Linting/Formatting
pnpm add -D eslint prettier husky lint-staged
pnpm add -D eslint-config-next @eslint/js typescript-eslint
```

## Architecture Patterns

### Recommended Project Structure

```
relay/
├── apps/
│   ├── web/                        # Next.js web application
│   │   ├── app/                    # App Router routes
│   │   │   ├── (auth)/            # Route group for auth pages
│   │   │   ├── (main)/            # Route group for main app
│   │   │   ├── api/               # API routes (if needed)
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── page.tsx           # Home page
│   │   ├── src/
│   │   │   ├── features/          # Feature-based modules
│   │   │   │   ├── auth/          # Auth feature
│   │   │   │   ├── skills/        # Skills feature
│   │   │   │   └── ratings/       # Ratings feature
│   │   │   ├── components/        # Shared app components
│   │   │   └── lib/               # App-specific utilities
│   │   ├── tests/                 # Playwright E2E tests
│   │   │   └── e2e/
│   │   ├── components.json        # shadcn/ui config
│   │   ├── next.config.ts
│   │   ├── playwright.config.ts
│   │   └── package.json
│   └── mcp-server/                # MCP server (Phase 3)
│       ├── src/
│       │   ├── handlers/
│       │   ├── client/
│       │   └── index.ts
│       └── package.json
├── packages/
│   ├── core/                      # @everyskill/core - shared types, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── db/                        # @everyskill/db - database schema, queries
│   │   ├── src/
│   │   │   ├── schema/            # Drizzle schema files
│   │   │   ├── migrations/        # Generated migrations
│   │   │   ├── seed/              # Fixture data
│   │   │   ├── client.ts          # Database client
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── ui/                        # @everyskill/ui - shared React components
│   │   ├── src/
│   │   │   ├── components/        # shadcn/ui components
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   ├── components.json
│   │   └── package.json
│   └── config/                    # Shared configs (optional)
│       ├── eslint/
│       ├── typescript/
│       └── vitest/
├── docker/
│   └── docker-compose.yml         # PostgreSQL, pgAdmin (optional)
├── .github/
│   └── workflows/
│       └── ci.yml
├── .husky/
│   └── pre-commit
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── .gitignore
```

### Pattern 1: pnpm Workspace Configuration

**What:** Define workspace packages in `pnpm-workspace.yaml` with `workspace:*` protocol for internal dependencies.
**When to use:** Always in monorepos with shared packages.
**Example:**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// packages/db/package.json
{
  "name": "@everyskill/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@everyskill/core": "workspace:*",
    "drizzle-orm": "^0.40.0",
    "postgres": "^3.4.0"
  }
}
```

```json
// apps/web/package.json
{
  "name": "web",
  "dependencies": {
    "@everyskill/core": "workspace:*",
    "@everyskill/db": "workspace:*",
    "@everyskill/ui": "workspace:*"
  }
}
```

### Pattern 2: Turborepo Task Pipeline

**What:** Define task dependencies and caching in `turbo.json`.
**When to use:** All monorepo tasks (build, lint, test).
**Example:**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
```

### Pattern 3: Drizzle Schema and Migrations

**What:** Define schema in TypeScript, generate SQL migrations, apply in order.
**When to use:** All database schema changes.
**Example:**

```typescript
// packages/db/src/schema/users.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

```typescript
// packages/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Migration workflow:
```bash
# Generate migration from schema changes
pnpm --filter @everyskill/db drizzle-kit generate

# Apply migrations to database
pnpm --filter @everyskill/db drizzle-kit migrate

# Or push directly (dev only)
pnpm --filter @everyskill/db drizzle-kit push
```

### Pattern 4: Playwright E2E with webServer

**What:** Configure Playwright to auto-start Next.js dev/prod server.
**When to use:** E2E tests that need the full application running.
**Example:**

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Pattern 5: ESLint Flat Config with TypeScript

**What:** Use ESLint 9+ flat config format with TypeScript-ESLint.
**When to use:** All linting configuration.
**Example:**

```javascript
// eslint.config.mjs (root)
import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
  ]),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    rules: {
      // Errors - must fix
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Warnings - stylistic
      "prefer-const": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
]);
```

### Anti-Patterns to Avoid

- **Flat package structure:** Don't put all packages in root; use `apps/` for deployables and `packages/` for libraries
- **Circular dependencies:** Packages should only depend "downward" (`web` -> `ui` -> `core`, never reverse)
- **Missing `workspace:*` protocol:** Using version numbers for internal packages breaks local development
- **Global TypeScript config:** Each package needs its own `tsconfig.json` that extends a shared base
- **Running migrations in CI without safeguards:** Always use `drizzle-kit generate` + code review, never `drizzle-kit push` in CI

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monorepo task orchestration | Custom scripts with npm-run-all | Turborepo | Caching, parallelization, dependency graph |
| Database migrations | Raw SQL files with manual versioning | Drizzle Kit | Type-safe schema, automatic SQL generation, migration tracking |
| Pre-commit hooks | Manual git hooks | Husky + lint-staged | Cross-platform, team-enforced, cached execution |
| Component library setup | Custom build pipeline | shadcn/ui monorepo mode | Pre-configured, accessible, Tailwind integrated |
| E2E test server management | Custom scripts to start/stop server | Playwright webServer | Automatic lifecycle, port detection, CI-aware |
| TypeScript project references | Manual path mapping | Turborepo + pnpm workspaces | Automatic resolution, IDE support |
| Docker local dev | Individual container commands | Docker Compose | Declarative, reproducible, single-command startup |

**Key insight:** The monorepo toolchain (Turborepo, pnpm workspaces, Drizzle Kit) handles complex dependency resolution and caching that would be extremely error-prone to build manually.

## Common Pitfalls

### Pitfall 1: TypeScript Path Resolution in Monorepo

**What goes wrong:** IDE shows "Cannot find module '@everyskill/core'" errors, or runtime imports fail despite correct `workspace:*` dependencies.
**Why it happens:** TypeScript resolves paths differently than Node.js. The package's `main`/`exports` field must point to source files (not built), and `tsconfig.json` paths must be configured.
**How to avoid:**
1. Use `"main": "./src/index.ts"` in package.json (not `./dist/index.js`)
2. Configure TypeScript paths in consuming package's tsconfig:
```json
{
  "compilerOptions": {
    "paths": {
      "@everyskill/*": ["../../packages/*/src"]
    }
  }
}
```
3. Or use TypeScript project references (more complex but more correct)
**Warning signs:** Red squiggles in IDE, "Module not found" at runtime, builds work but dev fails.

### Pitfall 2: pnpm 9 Workspace Protocol Bug

**What goes wrong:** pnpm 9 sometimes treats internal workspace packages as npm registry packages, causing install failures.
**Why it happens:** Bug in pnpm 9's workspace detection logic.
**How to avoid:**
1. Ensure `pnpm-workspace.yaml` exists and correctly lists package globs
2. Use explicit workspace protocol: `"@everyskill/core": "workspace:*"`
3. If issues persist, consider pnpm 8 until bug is fixed
**Warning signs:** "ERR_PNPM_NO_MATCHING_VERSION" for internal packages.

### Pitfall 3: Turborepo Cache Invalidation

**What goes wrong:** Changes don't trigger rebuilds, or cache is never hit (constant rebuilds).
**Why it happens:** Incorrect `inputs`/`outputs` in turbo.json, or environment variables not declared.
**How to avoid:**
1. Explicitly declare all outputs: `.next/**`, `dist/**`
2. Exclude cache directories: `!.next/cache/**`
3. Declare environment variables that affect builds:
```json
{
  "globalEnv": ["DATABASE_URL", "NODE_ENV"],
  "tasks": {
    "build": {
      "env": ["NEXT_PUBLIC_*"]
    }
  }
}
```
**Warning signs:** "FULL TURBO" never appears in logs, or stale builds served.

### Pitfall 4: Docker Compose Network Resolution

**What goes wrong:** Next.js app can't connect to PostgreSQL in Docker, or connection works in Docker but fails locally.
**Why it happens:** Different hostname resolution inside vs outside Docker network.
**How to avoid:**
1. Use `host.docker.internal` for app-to-host connections
2. Use service name (e.g., `postgres`) for container-to-container
3. Configure DATABASE_URL with appropriate host per environment:
```bash
# .env.local (running Next.js locally, Postgres in Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/everyskill

# For running Next.js inside Docker
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/relay
```
**Warning signs:** "ECONNREFUSED" errors, connection timeouts.

### Pitfall 5: Drizzle Migrations in Production

**What goes wrong:** Migration fails partway through, leaving database in inconsistent state.
**Why it happens:** Drizzle Kit's `migrate` command runs in a single transaction by default, but complex migrations can timeout or conflict.
**How to avoid:**
1. Keep migrations small and focused
2. Test migrations against production data copy
3. Use `max: 1` connection pool for migrations:
```typescript
const migrationsClient = postgres(connectionString, { max: 1 });
await migrate(drizzle(migrationsClient), { migrationsFolder: "./migrations" });
```
4. Have rollback plan for each migration
**Warning signs:** Partial schema changes, migration lock files, "relation already exists" errors.

### Pitfall 6: ESLint Flat Config Migration

**What goes wrong:** ESLint errors about invalid config, plugins not loading, or rules not applying.
**Why it happens:** Flat config (eslint.config.mjs) has different syntax than legacy .eslintrc format.
**How to avoid:**
1. Use `defineConfig` from eslint/config for type safety
2. Convert plugin configs to flat format or use FlatCompat wrapper
3. Use `globalIgnores` instead of `.eslintignore` file
4. Check that Next.js ESLint plugin supports flat config (Next.js 15.5+)
**Warning signs:** "Invalid configuration" errors, rules silently not running.

## Code Examples

Verified patterns from official sources:

### Single Command Startup Script

```json
// package.json (root)
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:e2e": "turbo test:e2e",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:studio": "pnpm --filter @everyskill/db drizzle-kit studio",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "prepare": "husky"
  }
}
```

### Docker Compose for PostgreSQL

```yaml
# docker/docker-compose.yml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: everyskill-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: everyskill
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Husky Pre-commit Hook

```bash
# .husky/pre-commit
pnpm lint-staged
```

```json
// package.json (root)
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

### GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: everyskill_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm turbo typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Install Playwright browsers
        run: pnpm --filter web exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/everyskill_test

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

### Environment Variables Setup

```bash
# .env.example
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/everyskill

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Auth (Phase 2)
# AUTH_SECRET=
# AUTH_GOOGLE_ID=
# AUTH_GOOGLE_SECRET=
```

```gitignore
# .gitignore additions
.env
.env.local
.env.*.local
```

### Tailwind CSS v4 Setup

```css
/* packages/ui/src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-brand-50: #f0f9ff;
  --color-brand-500: #0ea5e9;
  --color-brand-900: #0c4a6e;
}
```

```javascript
// apps/web/postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.json` | `eslint.config.mjs` flat config | ESLint 9 (2024) | Simpler config, better TypeScript support |
| `tailwind.config.js` | CSS-first with `@theme` | Tailwind v4 (2025) | One less config file, faster builds |
| `next lint` CLI | Native ESLint | Next.js 16 (2026) | More control, better flat config support |
| Prisma | Drizzle ORM | 2024-2025 | Faster cold starts, better serverless support |
| Jest | Vitest | 2023-2024 | 10-20x faster, native ESM/TypeScript |
| yarn workspaces | pnpm workspaces | 2022-2023 | Faster installs, stricter dependency resolution |

**Deprecated/outdated:**
- `@types/react` package (React 19 includes types natively)
- `@tailwindcss/typography` via plugins array (use CSS `@import` in v4)
- `.eslintignore` file (use `globalIgnores` in flat config)
- `next lint` command (removed in Next.js 16)

## Open Questions

Things that couldn't be fully resolved:

1. **pnpm 9 workspace bug status**
   - What we know: Bug exists where pnpm 9 treats workspace packages as npm packages
   - What's unclear: Whether this is fixed in latest pnpm 9.x
   - Recommendation: Monitor pnpm releases; use explicit `workspace:*` protocol; fall back to pnpm 8 if needed

2. **Turborepo remote caching without Vercel**
   - What we know: Vercel Remote Cache is default; self-hosted options exist
   - What's unclear: Best self-hosted solution for GitHub Actions
   - Recommendation: Use `setup-github-actions-caching-for-turbo` action for GitHub-native caching without Vercel dependency

3. **shadcn/ui with Tailwind v4 in monorepo**
   - What we know: shadcn/ui CLI supports monorepos; Tailwind v4 requires different config
   - What's unclear: Whether latest shadcn/ui CLI fully supports Tailwind v4 in monorepo mode
   - Recommendation: Test during setup; may need manual configuration of CSS paths

## Sources

### Primary (HIGH confidence)
- [Turborepo Next.js Guide](https://turborepo.dev/docs/guides/frameworks/nextjs) - Official monorepo setup
- [Drizzle ORM PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new) - Database setup and migrations
- [Next.js Playwright Testing](https://nextjs.org/docs/app/guides/testing/playwright) - E2E test configuration
- [pnpm Workspaces](https://pnpm.io/workspaces) - Workspace protocol and configuration
- [Husky Get Started](https://typicode.github.io/husky/get-started.html) - Pre-commit hook setup
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo) - Component library in monorepo
- [Tailwind CSS v4 Install](https://tailwindcss.com/docs/guides/nextjs) - CSS-first configuration
- [GitHub Actions Turborepo](https://turborepo.dev/docs/guides/ci-vendors/github-actions) - CI workflow patterns

### Secondary (MEDIUM confidence)
- [Nhost Turborepo Configuration](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) - Real-world pnpm + Turborepo setup
- [Drizzle Migrations Blog](https://frontendmasters.com/blog/drizzle-database-migrations/) - Migration best practices
- [ESLint Flat Config Guide](https://eslint.org/docs/latest/use/configure/migration-guide) - Migration from legacy config
- [Next.js 15 Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) - Official structure guidance

### Tertiary (LOW confidence)
- Medium articles on Turborepo setup (verify against official docs)
- Dev.to tutorials (use for patterns, verify versions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are well-documented with official guides
- Architecture: HIGH - Patterns verified against Turborepo and Next.js docs
- Pitfalls: MEDIUM - Based on community reports and GitHub issues; may be resolved in latest versions

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable ecosystem, but check for Next.js 16 changes)
