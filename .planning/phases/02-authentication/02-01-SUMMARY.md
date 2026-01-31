---
phase: 02-authentication
plan: 01
subsystem: auth
tags: [next-auth, auth.js, google-oauth, drizzle, jwt]

# Dependency graph
requires:
  - phase: 01-project-foundation
    provides: Monorepo structure, Drizzle ORM setup, PostgreSQL schema infrastructure
provides:
  - Auth.js v5 with Google OAuth provider
  - Drizzle adapter for PostgreSQL user storage
  - Edge-compatible auth configuration for middleware
  - Domain restriction for company email addresses
  - JWT session strategy for Edge runtime compatibility
affects: [02-02-middleware, 02-03-login-page, 03-mcp-integration]

# Tech tracking
tech-stack:
  added: [next-auth@5.0.0-beta.30, @auth/drizzle-adapter]
  patterns: [split-auth-config, jwt-session-strategy, domain-restriction-callback]

key-files:
  created:
    - apps/web/auth.config.ts
    - apps/web/auth.ts
    - apps/web/app/api/auth/[...nextauth]/route.ts
    - packages/db/src/schema/auth.ts
  modified:
    - packages/db/src/schema/users.ts
    - packages/db/src/schema/index.ts
    - apps/web/package.json
    - packages/db/package.json

key-decisions:
  - "JWT session strategy for Edge middleware compatibility"
  - "Split auth config pattern: auth.config.ts (Edge) + auth.ts (Node with adapter)"
  - "Dual domain validation: signIn callback (security) + hd param (UX)"
  - "Graceful null-db handling to allow builds without DATABASE_URL"

patterns-established:
  - "Split config: auth.config.ts for Edge-compatible providers, auth.ts for full Node config"
  - "Domain restriction: Always validate in signIn callback, hd param is UX-only"
  - "Auth exports: handlers, auth, signIn, signOut from auth.ts"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 2 Plan 01: Auth.js Configuration Summary

**Auth.js v5 with Google OAuth provider, Drizzle adapter for PostgreSQL, and JWT session strategy for Edge middleware compatibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T13:53:00Z
- **Completed:** 2026-01-31T13:58:13Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Installed and configured Auth.js v5 (next-auth@beta) with Google OAuth provider
- Created Drizzle adapter schema with accounts, sessions, and verificationTokens tables
- Implemented dual domain restriction (signIn callback for security, hd param for UX)
- Built Edge-compatible split configuration pattern for middleware support

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Auth.js dependencies and create auth schema** - `09da91a` (feat)
2. **Task 2: Create Auth.js configuration files and API route** - `aeed710` (feat)

## Files Created/Modified

- `apps/web/auth.config.ts` - Edge-compatible auth configuration with Google provider
- `apps/web/auth.ts` - Full auth configuration with Drizzle adapter and domain restriction
- `apps/web/app/api/auth/[...nextauth]/route.ts` - OAuth callback API route handler
- `packages/db/src/schema/auth.ts` - Auth.js required tables (accounts, sessions, verificationTokens)
- `packages/db/src/schema/users.ts` - Updated with text id, emailVerified, and image fields for Auth.js
- `packages/db/src/schema/index.ts` - Added auth schema export
- `apps/web/package.json` - Added next-auth and @auth/drizzle-adapter dependencies
- `packages/db/package.json` - Added next-auth devDependency for type definitions

## Decisions Made

1. **JWT session strategy over database sessions** - Required for Edge middleware. Database sessions cannot be used because middleware runs on Edge runtime which cannot access the database.

2. **Split configuration pattern** - auth.config.ts contains Edge-compatible config (providers only), auth.ts contains full config with Drizzle adapter. This enables middleware route protection while keeping database operations in Node runtime.

3. **Text ID instead of UUID for users** - Auth.js DrizzleAdapter expects text primary keys. Changed from `uuid("id").primaryKey().defaultRandom()` to `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`.

4. **Graceful null database handling** - Auth exports fall back to error-throwing stubs when DATABASE_URL is not set. This allows `pnpm build` to succeed without database connection, with errors thrown at runtime when auth is actually used.

5. **Added Auth.js required user fields** - Added `emailVerified` and `image` columns to users table as required by DrizzleAdapter's DefaultPostgresUsersTable type. Changed `name` from required to optional and removed custom `avatarUrl` in favor of standard `image`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added emailVerified and image columns to users table**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** DrizzleAdapter requires `emailVerified` and `image` columns in users table that weren't in original schema
- **Fix:** Added `emailVerified: timestamp("email_verified", { mode: "date" })` and `image: text("image")`, made `name` nullable
- **Files modified:** packages/db/src/schema/users.ts
- **Verification:** TypeScript compiles, build succeeds
- **Committed in:** aeed710 (Task 2 commit)

**2. [Rule 3 - Blocking] Added graceful null database handling**
- **Found during:** Task 2 (Build failure)
- **Issue:** Build failed because auth.ts threw error at import time when DATABASE_URL not set
- **Fix:** Made auth initialization conditional with `isDatabaseConfigured()` check, exports fall back to error-throwing stubs
- **Files modified:** apps/web/auth.ts
- **Verification:** `pnpm build` succeeds without DATABASE_URL
- **Committed in:** aeed710 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for type safety and build compatibility. No scope creep.

## Issues Encountered

- **@next/swc version mismatch warning** - Build shows "Mismatching @next/swc version, detected: 15.5.7 while Next.js is on 15.5.11". Does not affect functionality, can be resolved by reinstalling next package if needed.

## User Setup Required

**External services require manual configuration.** The following environment variables must be set before authentication will work:

**Environment Variables:**
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `AUTH_GOOGLE_ID` - Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID
- `AUTH_GOOGLE_SECRET` - Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client Secret
- `AUTH_ALLOWED_DOMAIN` - Company domain for restriction (e.g., "company.com")

**Google Cloud Console Configuration:**
1. Create OAuth 2.0 Client ID (Web application type)
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

## Next Phase Readiness

- Auth configuration complete, ready for middleware implementation (02-02)
- Login page can be built using exported signIn function (02-03)
- Database schema ready but needs `pnpm db:push` when DATABASE_URL is available

---
*Phase: 02-authentication*
*Completed: 2026-01-31*
