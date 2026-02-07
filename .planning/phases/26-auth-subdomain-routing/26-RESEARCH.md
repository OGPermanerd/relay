# Phase 26: Auth & Subdomain Routing - Research

**Researched:** 2026-02-07
**Domain:** Multi-tenant authentication, subdomain routing, Auth.js v5, Google OAuth
**Confidence:** MEDIUM (Auth.js v5 subdomain support has known bugs; architecture is sound but implementation needs careful handling)

## Summary

Phase 26 transforms the single-tenant EverySkill app into a subdomain-routed multi-tenant system where `tenant-slug.everyskill.ai` loads the correct tenant context, Google SSO maps users by email domain, and JWT sessions carry `tenantId` claims.

The core challenge is that Auth.js v5 (beta.30) has known bugs with its `auth()` middleware wrapper when used with subdomains (GitHub issues #9631, #10915, #11450). The recommended workaround is to **NOT wrap middleware with `auth()`** and instead use a standalone middleware that manually reads the JWT via cookie parsing or `getToken()`, then sets custom request headers (`x-tenant-id`, `x-tenant-slug`) for downstream consumption.

Google OAuth does NOT support wildcard redirect URIs. The solution is a single redirect URI on the apex domain (`everyskill.ai/api/auth/callback/google`) with the originating tenant subdomain encoded in the OAuth `state` parameter and Auth.js `redirect` callback routing back to the correct subdomain after authentication.

**Primary recommendation:** Use a two-layer middleware approach: (1) subdomain extraction + tenant header injection runs first as plain Next.js middleware, (2) Auth.js handles authentication via its route handler with `trustHost: true` and `headers()` from `next/headers` to access the host in callbacks. Configure domain-scoped cookies with `__Secure-` prefix (not `__Host-`) to enable cross-subdomain session sharing.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 | Authentication framework | Already in use, JWT strategy, Edge-compatible |
| next | 16.1.6 | App framework with middleware | Already in use, provides Edge middleware |
| drizzle-orm | 0.42.0 | Database queries for tenant lookup | Already in use |

### No New Dependencies Required
This phase modifies existing auth and middleware configuration. No new npm packages are needed.

### Key Environment Variables (new/modified)
| Variable | Value | Purpose |
|----------|-------|---------|
| `AUTH_URL` | `https://everyskill.ai` | Apex domain for OAuth redirect URI |
| `AUTH_TRUST_HOST` | `true` | Let Auth.js derive host from request headers |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `everyskill.ai` | Root domain for subdomain extraction |
| `NEXTAUTH_URL` | Remove or set to `https://everyskill.ai` | Deprecated in v5, but set for safety |

## Architecture Patterns

### Recommended Approach: Unwrapped Middleware + Auth.js Route Handler

The critical architectural decision: **Do NOT use `auth()` as a middleware wrapper.** Auth.js v5 beta.30 has bugs where the `auth()` wrapper rewrites `req.url` to match `AUTH_URL`, breaking subdomain routing. Instead:

```
Request Flow:
1. Browser: tenant-slug.everyskill.ai/dashboard
2. Middleware (unwrapped): Extract subdomain, resolve tenant, set headers
3. Next.js routes: Read x-tenant-id from headers
4. Auth route handler (/api/auth/*): Auth.js handles OAuth with trustHost
5. signIn callback: Use headers() to get host, resolve tenant by email domain
6. jwt callback: Inject tenantId into JWT
7. session callback: Expose tenantId in session
```

### Pattern 1: Subdomain Extraction in Middleware
**What:** Extract tenant slug from Host header, look up tenant, inject headers
**When to use:** Every request
**Example:**
```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

export default async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const pathname = req.nextUrl.pathname;

  // Skip auth API routes, static files
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Extract subdomain
  const subdomain = extractSubdomain(host, ROOT_DOMAIN);

  // No subdomain = apex domain request
  if (!subdomain) {
    // Could redirect to a landing page or default tenant
    return NextResponse.next();
  }

  // Set tenant context headers for downstream consumption
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-slug", subdomain);

  // Check auth via cookie (manual JWT read, no auth() wrapper)
  const sessionToken = req.cookies.get("__Secure-authjs.session-token")?.value
    || req.cookies.get("authjs.session-token")?.value;

  if (!sessionToken && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function extractSubdomain(host: string, rootDomain: string): string | null {
  // Development: tenant-slug.localhost:2000
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length > 1 && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  }

  // Production: tenant-slug.everyskill.ai
  if (host.endsWith(rootDomain)) {
    const subdomain = host.replace(`.${rootDomain}`, "");
    if (subdomain && subdomain !== "www") {
      return subdomain;
    }
  }
  return null;
}
```

### Pattern 2: Domain-Scoped Cookie Configuration
**What:** Configure Auth.js cookies to work across all subdomains
**When to use:** Auth.js initialization
**Critical:** Must use `__Secure-` prefix, NOT `__Host-` prefix. `__Host-` cookies cannot have a `domain` attribute set, which prevents cross-subdomain sharing.
**Example:**
```typescript
// Cookie configuration for cross-subdomain sharing
const isSecure = process.env.NODE_ENV === "production";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

const cookieConfig = {
  cookies: {
    sessionToken: {
      name: isSecure
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    callbackUrl: {
      name: isSecure
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token", // CSRF token does NOT use __Secure- prefix
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
  },
};
```

### Pattern 3: Tenant Resolution in signIn Callback via Email Domain
**What:** Map user's email domain to tenant using DB lookup
**When to use:** During Google OAuth signIn callback
**Key insight:** `headers()` from `next/headers` works inside Auth.js callbacks in App Router
**Example:**
```typescript
// In auth.ts signIn callback
import { headers } from "next/headers";
import { db } from "@everyskill/db";
import { tenants } from "@everyskill/db/schema";
import { eq } from "drizzle-orm";

async signIn({ account, profile }) {
  if (account?.provider !== "google") return false;
  if (!profile?.email_verified) return false;

  const emailDomain = profile.email?.split("@")[1];
  if (!emailDomain) return false;

  // Look up tenant by email domain
  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.domain, emailDomain))
    .limit(1);

  if (!tenant.length || !tenant[0].isActive) return false;

  // Tenant found and active - allow sign in
  return true;
}
```

### Pattern 4: JWT tenantId Injection
**What:** Add tenantId claim to JWT token
**When to use:** jwt callback on sign-in
**Example:**
```typescript
// In auth.ts jwt callback
async jwt({ token, user, account, profile }) {
  if (user) {
    token.id = user.id;
  }

  // On initial sign-in (account present), resolve tenant
  if (account && profile?.email) {
    const emailDomain = profile.email.split("@")[1];
    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.domain, emailDomain))
      .limit(1);

    if (tenant.length) {
      token.tenantId = tenant[0].id;
    }
  }

  return token;
},

async session({ session, token }) {
  if (session.user && token.id) {
    session.user.id = token.id as string;
  }
  if (token.tenantId) {
    session.user.tenantId = token.tenantId as string;
  }
  return session;
}
```

### Pattern 5: TypeScript Module Augmentation
**What:** Extend Auth.js types to include tenantId
**Example:**
```typescript
// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      tenantId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
  }
}
```

### Pattern 6: Google OAuth Single Redirect URI + State
**What:** All tenant subdomains share one Google OAuth app with one redirect URI
**How:** Register `https://everyskill.ai/api/auth/callback/google` as the single authorized redirect URI. Auth.js handles the state parameter internally -- the `redirectTo` option in `signIn()` encodes where to send the user post-auth. The `redirect` callback in Auth.js allows cross-subdomain redirects.
**Example:**
```typescript
// In auth.ts redirect callback
async redirect({ url, baseUrl }) {
  // Allow redirects to any subdomain of our root domain
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.endsWith(rootDomain)) {
      return url;
    }
  } catch {}
  // Relative URLs
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return baseUrl;
}
```

### Pattern 7: Session Timeout (SOC2-04)
**What:** Reduce session maxAge from 30 days to 8 hours
**Example:**
```typescript
session: {
  strategy: "jwt",
  maxAge: 8 * 60 * 60, // 8 hours in seconds (28800)
},
```

### Recommended Project Structure (modified files)
```
apps/web/
  middleware.ts              # REWRITE: subdomain extraction, tenant header injection
  auth.config.ts             # MODIFY: cookie config, remove hd param (multi-tenant)
  auth.ts                    # MODIFY: signIn callback for email-domain lookup, jwt tenantId
  types/next-auth.d.ts       # NEW: module augmentation for tenantId
  app/(auth)/login/page.tsx  # MODIFY: pass tenant context in signIn redirectTo
packages/db/
  src/client.ts              # MODIFY: remove hardcoded DEFAULT_TENANT_ID connection setting
  src/services/tenant.ts     # NEW: tenant lookup service (by slug, by domain)
```

### Anti-Patterns to Avoid
- **DO NOT use `auth()` middleware wrapper with subdomains:** Known bugs in beta.30 cause CSRF errors and incorrect URL rewriting. Use unwrapped middleware instead.
- **DO NOT use `__Host-` cookie prefix:** Cannot set domain attribute, breaks cross-subdomain sharing. Use `__Secure-` prefix.
- **DO NOT set `AUTH_URL` to a specific subdomain:** It gets hardcoded for all requests, breaking multi-tenant routing.
- **DO NOT register separate Google OAuth redirect URIs per tenant:** Not scalable. Use single redirect URI on apex domain.
- **DO NOT do DB queries in `auth.config.ts`:** This file is used by Edge middleware. Keep it Edge-compatible (no DB imports). All DB queries go in `auth.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT token management | Custom JWT signing/verification | Auth.js JWT strategy | Handles rotation, encoding, cookie management |
| Cookie security | Manual cookie prefixing/domain | Auth.js `cookies` config | Handles __Secure- prefix, secure flag, httpOnly |
| OAuth state management | Custom state parameter encoding | Auth.js built-in state handling | CSRF protection, redirect URL preservation |
| Session expiry | Manual token expiration checks | Auth.js `session.maxAge` | Handles refresh, expiry, updateAge |
| Subdomain extraction | Complex regex parsing | Simple string split on host header | Subdomains are always the first part before root domain |

## Common Pitfalls

### Pitfall 1: Auth.js `auth()` Wrapper Breaks Subdomain Routing
**What goes wrong:** Using `export default auth((req) => { ... })` causes Auth.js to rewrite `req.url` to match `AUTH_URL`, losing subdomain context. CSRF errors when signing in from subdomains.
**Why it happens:** Auth.js internally resolves the auth endpoint URL and may not preserve the original Host header correctly in the middleware wrapper context.
**How to avoid:** Use unwrapped middleware: `export default function middleware(req: NextRequest)`. Check auth via cookie presence or `getToken()`. Handle redirects manually.
**Warning signs:** CSRF token mismatch errors, redirect loops, `req.url` showing apex domain instead of subdomain.
**Confidence:** HIGH (multiple confirmed GitHub issues: #9631, #10915, #11450)

### Pitfall 2: `__Host-` Cookie Prefix Prevents Subdomain Sharing
**What goes wrong:** Auth.js defaults to `__Host-` prefixed cookies in HTTPS environments. `__Host-` cookies CANNOT have a `domain` attribute, so they're locked to the exact origin.
**Why it happens:** `__Host-` is the most secure cookie prefix (prevents domain override), but it's incompatible with cross-subdomain sharing.
**How to avoid:** Explicitly configure cookies in Auth.js config with `__Secure-` prefix and a `.everyskill.ai` domain.
**Warning signs:** User signs in on `auth.everyskill.ai` but session cookie not available on `acme.everyskill.ai`.
**Confidence:** HIGH (well-documented cookie security specification)

### Pitfall 3: Google OAuth Redirect URI Mismatch
**What goes wrong:** Google OAuth returns `redirect_uri_mismatch` error because the callback URL includes the tenant subdomain, which isn't registered.
**Why it happens:** Google OAuth requires exact redirect URI matches. Wildcard subdomains are not supported.
**How to avoid:** Set `AUTH_URL` (or `NEXTAUTH_URL`) to the apex domain `https://everyskill.ai`. Register `https://everyskill.ai/api/auth/callback/google` as the only redirect URI in Google Cloud Console. Use `trustHost: true` and the `redirect` callback to route back to the tenant subdomain after auth.
**Warning signs:** 400 error from Google during OAuth flow, "redirect_uri_mismatch" in error response.
**Confidence:** HIGH (Google documentation explicitly states no wildcard support)

### Pitfall 4: RLS Bypassed During Auth (Table Owner)
**What goes wrong:** Auth.js DrizzleAdapter runs as the table owner, which bypasses RLS (because RLS is ENABLED but not FORCED). This means user creation during signIn could land in the wrong tenant or skip tenant assignment.
**Why it happens:** Phase 25 set RLS to ENABLED (not FORCED) deliberately. The DrizzleAdapter doesn't know about tenant context.
**How to avoid:** The signIn callback should validate tenant membership. The jwt callback should look up and inject the correct tenantId. The DrizzleAdapter's user creation will use the default tenant_id from the column default -- this is acceptable because the signIn callback will reject users whose email domain doesn't match any tenant.
**Warning signs:** New users created with default tenant ID instead of correct one.
**Confidence:** MEDIUM (architecture is sound, but needs careful testing)

### Pitfall 5: Development Subdomain Testing
**What goes wrong:** `*.localhost` doesn't resolve by default on all systems. Cookie domain doesn't work with `localhost`.
**Why it happens:** Browsers handle `localhost` specially. Cookie domain scoping differs between `localhost` and real domains.
**How to avoid:** In development, use `*.localhost:2000` (most modern browsers support this). Add `/etc/hosts` entries if needed: `127.0.0.1 acme.localhost`. Configure cookies with `domain: undefined` in development (no domain scoping for localhost).
**Warning signs:** Cookies not being set, subdomain not resolving, infinite redirect loops.
**Confidence:** MEDIUM (browser behavior varies; Chrome supports `*.localhost`, Firefox may need `/etc/hosts`)

### Pitfall 6: signIn Callback Cannot Access Request Directly
**What goes wrong:** The signIn callback parameters don't include the request object, so you can't directly read the Host header.
**Why it happens:** Auth.js callback signatures don't include request context.
**How to avoid:** Use `headers()` from `next/headers` inside the callback. This works in App Router. Alternatively, use lazy initialization `NextAuth(async (req) => { ... })` to access request in route handler config.
**Warning signs:** `undefined` when trying to access `req.headers` in callbacks.
**Confidence:** HIGH (confirmed working in GitHub discussion #8991)

## Code Examples

### Complete auth.config.ts (Edge-compatible)
```typescript
// Source: Auth.js docs + GitHub discussions on subdomain cookies
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

const isSecure = process.env.NODE_ENV === "production";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

export default {
  providers: [
    Google({
      // Remove hd param -- multi-tenant, each tenant has its own domain
      // Domain restriction happens in signIn callback
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours (SOC2-04)
  },
  trustHost: true,
  cookies: {
    sessionToken: {
      name: isSecure
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    callbackUrl: {
      name: isSecure
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: isSecure ? `.${rootDomain}` : undefined,
        secure: isSecure,
      },
    },
  },
  callbacks: {
    authorized: async ({ auth }) => !!auth,
  },
} satisfies NextAuthConfig;
```

### Complete auth.ts (with tenant resolution)
```typescript
// Source: Auth.js docs, GitHub #8991 (headers in callbacks)
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@everyskill/db";
import { users, accounts, sessions, verificationTokens, tenants } from "@everyskill/db/schema";
import authConfig from "./auth.config";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

function createAuthConfig(): NextAuthConfig {
  return {
    ...authConfig,
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    callbacks: {
      ...authConfig.callbacks,

      async signIn({ account, profile }) {
        if (account?.provider !== "google") return false;
        if (!profile?.email_verified) return false;

        const emailDomain = profile.email?.split("@")[1];
        if (!emailDomain) return false;

        // Look up tenant by email domain
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.domain, emailDomain))
          .limit(1);

        return !!tenant && tenant.isActive;
      },

      async jwt({ token, user, account, profile }) {
        if (user) token.id = user.id;

        // On initial sign-in, inject tenantId
        if (account && profile?.email) {
          const emailDomain = profile.email.split("@")[1];
          const [tenant] = await db
            .select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.domain, emailDomain))
            .limit(1);

          if (tenant) token.tenantId = tenant.id;
        }

        return token;
      },

      async session({ session, token }) {
        if (session.user && token.id) {
          session.user.id = token.id as string;
        }
        if (token.tenantId) {
          session.user.tenantId = token.tenantId as string;
        }
        return session;
      },

      async redirect({ url, baseUrl }) {
        // Allow redirects to any subdomain of our root domain
        try {
          const urlObj = new URL(url);
          if (urlObj.hostname.endsWith(rootDomain)) return url;
        } catch {}
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        return baseUrl;
      },
    },
  };
}
```

### Tenant Lookup Service
```typescript
// packages/db/src/services/tenant.ts
import { eq } from "drizzle-orm";
import { db } from "../client";
import { tenants } from "../schema";

export async function getTenantBySlug(slug: string) {
  if (!db) return null;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return tenant ?? null;
}

export async function getTenantByDomain(domain: string) {
  if (!db) return null;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.domain, domain))
    .limit(1);
  return tenant ?? null;
}
```

### Middleware Subdomain Extraction (Development-Aware)
```typescript
function extractSubdomain(host: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

  // Development: acme.localhost:2000
  if (host.includes("localhost")) {
    const hostname = host.split(":")[0]; // Remove port
    const parts = hostname.split(".");
    // "acme.localhost" => ["acme", "localhost"] => subdomain = "acme"
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      return parts[0] === "localhost" ? null : parts[0];
    }
    return null;
  }

  // Production: acme.everyskill.ai
  const hostname = host.split(":")[0];
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return null;
  }
  if (hostname.endsWith(`.${rootDomain}`)) {
    return hostname.replace(`.${rootDomain}`, "");
  }
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AUTH_ALLOWED_DOMAIN` env var (single domain) | DB lookup via `tenants.domain` column | Phase 26 | Supports multiple tenant email domains |
| `auth()` middleware wrapper | Unwrapped middleware with manual cookie check | Auth.js v5 beta (ongoing) | Avoids subdomain routing bugs |
| `__Host-` cookie prefix (default) | `__Secure-` prefix with domain scoping | When subdomains needed | Enables cross-subdomain session sharing |
| 30-day session expiry | 8-hour session expiry | Phase 26 (SOC2-04) | Stricter security posture |
| Single `NEXTAUTH_URL` | `trustHost: true` with dynamic host detection | Auth.js v5 | Proper multi-subdomain support |
| Hardcoded DEFAULT_TENANT_ID | JWT tenantId + withTenant() | Phase 26 | Per-request tenant isolation |

**Deprecated/outdated:**
- `process.env.AUTH_ALLOWED_DOMAIN`: Replace with DB-based tenant domain lookup
- `hd` parameter in Google OAuth config: Remove (was restricting to single domain)
- `DEFAULT_TENANT_ID` connection-level setting: Keep for backward compatibility during migration, but new requests should use JWT tenantId

## Open Questions

1. **Tenant resolution from middleware without DB (Edge)**
   - What we know: Edge middleware cannot import DB directly. The middleware needs to validate that a subdomain corresponds to a real tenant.
   - What's unclear: Whether to trust any subdomain slug (and let downstream routes fail if invalid), use an API route for tenant validation, or maintain a cached tenant list.
   - Recommendation: For Phase 26, trust the subdomain slug in middleware and validate in the auth callbacks (which DO have DB access). If a slug is invalid, the user will get a 404 or error page. A tenant cache can be added later. This keeps middleware Edge-compatible.

2. **User-tenant assignment during first sign-in**
   - What we know: Auth.js DrizzleAdapter creates users with the default tenant_id. The signIn callback validates email domain, the jwt callback injects tenantId.
   - What's unclear: Should we update the user's tenant_id in the database during first sign-in, or rely solely on the JWT claim?
   - Recommendation: Update user.tenantId in the signIn callback after tenant validation. This ensures the DB record is correct for RLS and admin queries. The JWT tenantId is the runtime authority, but the DB should match.

3. **Apex domain behavior (everyskill.ai without subdomain)**
   - What we know: The OAuth callback must be on the apex domain.
   - What's unclear: What should the apex domain serve? A landing page? A redirect to a default tenant? An error?
   - Recommendation: For Phase 26, redirect apex domain to a "select your organization" page or show a simple landing. The auth routes (`/api/auth/*`) must be accessible on the apex domain for OAuth callbacks.

4. **HTTPS for local development**
   - What we know: `__Secure-` cookies require HTTPS. Local dev uses HTTP.
   - What's unclear: Whether to set up local HTTPS or use non-prefixed cookies in development.
   - Recommendation: Use conditional cookie config (already shown in code examples). In development (`NODE_ENV !== "production"`), use non-prefixed cookie names and skip domain scoping. This avoids the complexity of local HTTPS certs.

5. **Auth.js beta.30 compatibility with lazy initialization**
   - What we know: Lazy initialization `NextAuth(async (req) => ...)` exists but has been reported buggy with the middleware wrapper.
   - What's unclear: Whether lazy init works correctly in the route handler (non-middleware) context with beta.30.
   - Recommendation: For Phase 26, avoid lazy initialization in the main auth config. Use `headers()` from `next/headers` in callbacks instead. This is simpler and confirmed working.

## Sources

### Primary (HIGH confidence)
- Auth.js official TypeScript docs: https://authjs.dev/getting-started/typescript - Module augmentation syntax
- Auth.js official migration guide: https://authjs.dev/getting-started/migrating-to-v5 - v5 changes
- Auth.js official deployment docs: https://authjs.dev/getting-started/deployment - AUTH_TRUST_HOST

### Secondary (MEDIUM confidence)
- GitHub Discussion #8991: headers() works in Auth.js callbacks - Confirmed by multiple users
- GitHub Discussion #9785: Dynamic NEXTAUTH_URL with lazy init pattern - Community-verified approach
- GitHub Issue #10915: v5 subdomain CSRF bugs - Confirmed, open issue
- GitHub Issue #9631: AUTH_URL + subdomain + middleware wrapper bug - Confirmed, open issue
- GitHub Issue #11450: Lazy init + auth() wrapper incompatibility - Confirmed, open issue
- GitHub Discussion #1299: Cross-subdomain cookie config examples - Working code from community
- Vercel Edge middleware docs: Custom header injection via NextResponse.next() - Official docs
- sometechblog.com: NextAuth subdomain cookie config - Community blog, verified pattern

### Tertiary (LOW confidence)
- Google OAuth wildcard discussion (groups.google.com): "Wildcards not supported" - Matches official docs but from community forum
- Various Medium articles on multi-tenant Next.js - Patterns consistent but not officially verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing stack, no new dependencies
- Cookie configuration: HIGH - Well-documented across multiple sources, standard cookie spec
- Subdomain middleware: HIGH - Standard Next.js middleware pattern, well-documented
- Auth.js callbacks (tenantId injection): MEDIUM - headers() confirmed working, but Auth.js beta may have edge cases
- Google OAuth redirect strategy: HIGH - Single redirect URI is the documented approach
- Auth.js middleware wrapper bugs: HIGH - Multiple confirmed GitHub issues
- Development workflow: MEDIUM - Browser support for *.localhost varies

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (Auth.js v5 is in beta; check for new releases before implementing)
