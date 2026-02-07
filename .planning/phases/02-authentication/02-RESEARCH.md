# Phase 2: Authentication - Research

**Researched:** 2026-01-31
**Domain:** Next.js App Router Authentication with Auth.js v5 and Google OAuth
**Confidence:** HIGH

## Summary

This phase implements Google Workspace SSO authentication using Auth.js v5 (formerly NextAuth.js) with domain restriction to company email addresses. The research covers the complete stack for Next.js 15 App Router with Drizzle ORM PostgreSQL adapter.

Auth.js v5 is the current recommended authentication solution for Next.js 15 App Router applications. While still in beta (v5.0.0-beta.30), it is production-ready and widely adopted. The library provides built-in Google OAuth support, Drizzle ORM adapter, and seamless integration with Next.js middleware for route protection.

The key architectural decision is using **JWT session strategy** instead of database sessions. This is required because the project needs middleware for route protection, and middleware runs on Edge runtime which cannot access the database. The split configuration pattern (auth.config.ts for Edge, auth.ts for full functionality) enables this while maintaining database storage for user accounts via the Drizzle adapter.

**Primary recommendation:** Use Auth.js v5 with Google provider, JWT session strategy, split Edge configuration, and domain restriction via signIn callback.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 | Authentication framework | Official Next.js auth solution, v5 designed for App Router |
| @auth/drizzle-adapter | 1.11.1 | Database adapter | Official adapter for Drizzle ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-auth/providers/google | (bundled) | Google OAuth provider | Google Workspace SSO |
| next-auth/react | (bundled) | Client-side hooks | useSession in client components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js | Clerk | Hosted solution, faster setup but adds external dependency and cost |
| Auth.js | Lucia Auth | More control but more manual setup, less ecosystem support |
| JWT strategy | Database sessions | Database sessions cannot work with Edge middleware |

**Installation:**
```bash
pnpm add next-auth@beta @auth/drizzle-adapter
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── auth.config.ts       # Edge-compatible config (providers only)
├── auth.ts              # Full config with Drizzle adapter
├── middleware.ts        # Route protection using auth.config
└── app/
    ├── api/
    │   └── auth/
    │       └── [...nextauth]/
    │           └── route.ts    # Auth API handlers
    ├── (auth)/                 # Auth route group
    │   ├── login/
    │   │   └── page.tsx
    │   └── error/
    │       └── page.tsx
    └── (protected)/            # Protected route group
        └── profile/
            └── page.tsx
```

### Pattern 1: Split Configuration for Edge Compatibility
**What:** Separate auth configuration into Edge-compatible (auth.config.ts) and full (auth.ts) files
**When to use:** Always when using middleware with database adapter
**Example:**
```typescript
// Source: https://authjs.dev/guides/edge-compatibility

// auth.config.ts - Edge compatible, no database
import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export default {
  providers: [
    Google({
      authorization: {
        params: {
          hd: "company.com",  // Restrict to company domain in Google picker
        },
      },
    }),
  ],
  callbacks: {
    authorized: async ({ auth }) => {
      return !!auth
    },
  },
} satisfies NextAuthConfig

// auth.ts - Full config with database
import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@everyskill/db"
import { users, accounts, sessions } from "@everyskill/db/schema"
import authConfig from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return (
          profile?.email_verified === true &&
          profile?.email?.endsWith("@company.com")
        )
      }
      return false
    },
  },
  ...authConfig,
})

// middleware.ts - Uses Edge-compatible config
import NextAuth from "next-auth"
import authConfig from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const newUrl = new URL("/login", req.nextUrl.origin)
    return Response.redirect(newUrl)
  }
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

### Pattern 2: Domain Restriction with Dual Validation
**What:** Combine Google `hd` parameter (UX) with signIn callback (security)
**When to use:** Company domain restriction requirement
**Example:**
```typescript
// Source: https://next-auth.js.org/providers/google

// In auth.ts signIn callback
callbacks: {
  async signIn({ account, profile }) {
    if (account?.provider === "google") {
      // Security validation - cannot be bypassed
      const isVerified = profile?.email_verified === true
      const isCompanyDomain = profile?.email?.endsWith("@company.com")
      return isVerified && isCompanyDomain
    }
    return false // Reject non-Google providers
  },
}
```

### Pattern 3: Server Component Session Access
**What:** Use auth() function directly in server components
**When to use:** Accessing session in RSC (preferred over client-side)
**Example:**
```typescript
// Source: https://authjs.dev/getting-started/session-management/get-session

// app/(protected)/profile/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div>
      <h1>{session.user.name}</h1>
      <img src={session.user.image} alt="Avatar" />
      <p>{session.user.email}</p>
    </div>
  )
}
```

### Pattern 4: Client Component Session (when needed)
**What:** SessionProvider wrapper for useSession hook
**When to use:** Only when client-side session access is required
**Example:**
```typescript
// Source: https://authjs.dev/getting-started/session-management/get-session

// components/providers.tsx
"use client"
import { SessionProvider } from "next-auth/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}

// app/layout.tsx
import { Providers } from "@/components/providers"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// components/user-menu.tsx (client component)
"use client"
import { useSession, signOut } from "next-auth/react"

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") return <div>Loading...</div>
  if (!session) return null

  return (
    <div>
      <span>{session.user?.name}</span>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Relying solely on middleware for authorization:** Middleware can be bypassed (CVE-2025-29927). Always verify session close to data access.
- **Using database session strategy with Edge middleware:** Database adapters are not Edge-compatible; use JWT strategy.
- **Storing sensitive data in JWT:** JWTs are client-readable; store only user ID and minimal claims.
- **Using hd parameter without signIn callback validation:** The hd parameter only affects Google picker UI, can be bypassed.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow | Custom OAuth implementation | Auth.js Google provider | OAuth spec is complex, security-critical, constantly evolving |
| Session management | Custom JWT/cookie handling | Auth.js session strategy | Token rotation, refresh, expiry handling is subtle |
| CSRF protection | Custom CSRF tokens | Auth.js built-in CSRF | Already implemented and tested |
| Database user sync | Manual user insert/update | Drizzle adapter | Handles upsert, account linking automatically |
| Route protection | Per-route auth checks | Middleware + auth() | Centralized, consistent protection |

**Key insight:** Authentication is security-critical infrastructure. Custom implementations almost always have vulnerabilities that battle-tested libraries have already solved.

## Common Pitfalls

### Pitfall 1: Missing AUTH_SECRET in Production
**What goes wrong:** Sessions fail, users can't authenticate, cryptic errors
**Why it happens:** AUTH_SECRET is required in production but not development
**How to avoid:** Set AUTH_SECRET to a 32-byte random string in production environment
**Warning signs:** "Missing secret" errors, sessions disappearing on refresh

### Pitfall 2: Edge Runtime Database Access
**What goes wrong:** Middleware crashes with "X is not a function" or module errors
**Why it happens:** Drizzle/pg driver uses Node.js APIs unavailable in Edge runtime
**How to avoid:** Use split configuration pattern - auth.config.ts for Edge, auth.ts for Node
**Warning signs:** Errors mentioning "edge runtime", "crypto", "Buffer"

### Pitfall 3: Trusting hd Parameter for Security
**What goes wrong:** Non-company users can access the application
**Why it happens:** hd parameter only filters Google picker UI, doesn't prevent account switching
**How to avoid:** Always validate email domain in signIn callback
**Warning signs:** Users from unexpected domains appearing in database

### Pitfall 4: Cookie Size Limits with Large JWTs
**What goes wrong:** Sessions silently fail or are truncated
**Why it happens:** Browser cookies limited to ~4KB, large tokens exceed this
**How to avoid:** Store minimal data in JWT, use database for extended user data
**Warning signs:** Intermittent auth failures, session data missing fields

### Pitfall 5: Hydration Mismatch with SessionProvider
**What goes wrong:** React hydration errors, flickering auth state
**Why it happens:** Server and client session state differ during hydration
**How to avoid:** Prefer server component auth(), pass session as prop if needed
**Warning signs:** Console hydration warnings, auth UI flickering

### Pitfall 6: Middleware Matcher Too Broad
**What goes wrong:** Static assets blocked, API routes inaccessible
**Why it happens:** Middleware runs on all matched routes including assets
**How to avoid:** Exclude _next/static, _next/image, api/auth, favicon.ico from matcher
**Warning signs:** Images not loading, 401 on static files

## Code Examples

Verified patterns from official sources:

### API Route Handler
```typescript
// Source: https://authjs.dev/getting-started/migrating-to-v5

// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

### Sign In/Out Actions
```typescript
// Source: https://authjs.dev/getting-started/session-management/login

// app/(auth)/login/page.tsx
import { signIn } from "@/auth"

export default function LoginPage() {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google", { redirectTo: "/profile" })
      }}
    >
      <button type="submit">Sign in with Google</button>
    </form>
  )
}

// components/sign-out-button.tsx
import { signOut } from "@/auth"

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}
    >
      <button type="submit">Sign out</button>
    </form>
  )
}
```

### Drizzle Schema for Auth.js
```typescript
// Source: https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/pg.ts

// packages/db/src/schema/auth.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"
import { users } from "./users"

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
)

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
)
```

### Environment Variables
```bash
# .env.local (development)
AUTH_SECRET="development-secret-at-least-32-characters"
AUTH_GOOGLE_ID="your-google-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Production (set in hosting platform)
AUTH_SECRET="production-random-32-byte-secret"
AUTH_GOOGLE_ID="production-client-id"
AUTH_GOOGLE_SECRET="production-client-secret"
AUTH_TRUST_HOST=true  # If behind proxy
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-auth v4 with pages/ | Auth.js v5 with app/ | 2024 | New config pattern, different exports |
| getServerSession(authOptions) | auth() function | v5 | Simpler, no options passing |
| authOptions export | Single auth.ts export | v5 | Centralized configuration |
| @next-auth/\*-adapter | @auth/\*-adapter | v5 | Framework-agnostic adapters |
| NEXTAUTH_URL required | Auto-detected from headers | v5 | Simpler deployment |
| NEXTAUTH_SECRET | AUTH_SECRET | v5 | Consistent naming |

**Deprecated/outdated:**
- OAuth 1.0 support: Removed in v5, use OAuth 2.0 providers
- `next-auth/next` import: Use direct exports from auth.ts
- `next-auth/middleware` import: Use auth() wrapper function
- `authOptions` pattern: Export auth, signIn, signOut, handlers from auth.ts

## Open Questions

Things that couldn't be fully resolved:

1. **Custom error pages for domain restriction**
   - What we know: signIn callback returning false shows generic error
   - What's unclear: Best way to show "company email required" message
   - Recommendation: Use redirect URL from signIn callback to custom error page with query param

2. **Existing users table compatibility**
   - What we know: Users table already exists with uuid id, project uses Drizzle adapter
   - What's unclear: Whether default Auth.js schema (text id) conflicts with existing uuid
   - Recommendation: Use custom table mapping in DrizzleAdapter to point to existing users table, may need to adjust id generation

## Sources

### Primary (HIGH confidence)
- [Auth.js Official Documentation](https://authjs.dev) - Core configuration, providers, adapters
- [Auth.js Drizzle Adapter](https://authjs.dev/getting-started/adapters/drizzle) - Schema requirements
- [Auth.js Edge Compatibility Guide](https://authjs.dev/guides/edge-compatibility) - Split configuration pattern
- [Auth.js Migration Guide v5](https://authjs.dev/getting-started/migrating-to-v5) - Breaking changes, new patterns
- [GitHub nextauthjs/next-auth pg.ts](https://github.com/nextauthjs/next-auth/blob/main/packages/adapter-drizzle/src/lib/pg.ts) - Official schema

### Secondary (MEDIUM confidence)
- [Next.js Official Auth Tutorial](https://nextjs.org/learn/dashboard-app/adding-authentication) - App Router patterns
- [NextAuth.js Google Provider Docs](https://next-auth.js.org/providers/google) - hd parameter, domain restriction
- [GitHub Discussion #266](https://github.com/nextauthjs/next-auth/discussions/266) - Domain restriction patterns

### Tertiary (LOW confidence)
- Medium articles on Auth.js v5 setup - Implementation examples
- Dev.to tutorials - Additional code patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official npm packages verified, versions confirmed
- Architecture: HIGH - Official documentation covers all patterns
- Pitfalls: HIGH - Multiple sources confirm common issues
- Schema compatibility: MEDIUM - Need to verify uuid handling with existing users table

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - Auth.js v5 is stable beta, patterns established)
