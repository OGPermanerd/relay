# Phase 30: Branding & Navigation - Research

**Researched:** 2026-02-08
**Domain:** UI branding, navigation UX, tenant white-labeling, contributor gamification
**Confidence:** HIGH

## Summary

Phase 30 transforms the EverySkill navigation bar and branding layer to support white-label tenant branding, animated logo, active nav indicators, contributor tiers, and vanity domain support. The existing codebase has a solid foundation: the tenant schema already has `logo`, `plan`, and `domain` columns; subdomain routing is fully operational in middleware; and user stats computation (`getUserStats`) already calculates `skillsShared`, `totalUses`, `avgRating`, and `fteDaysSaved` -- exactly the four axes needed for contributor tiers.

The main work areas are: (1) a new `NavLink` client component using `usePathname()` for active indicators, (2) tenant-aware branding in the header with conditional logo display, (3) an animated SVG logo using CSS keyframes (no new dependencies), (4) a `getContributorTier()` function that computes composite tier from existing data, (5) a redesigned greeting area with personal stats, (6) schema additions for `vanityDomain` on tenants, and (7) Caddy on-demand TLS configuration for paid tenant vanity URLs.

**Primary recommendation:** Split into 7 focused plans: (1) schema migration for `vanity_domain`, (2) animated SVG logo component, (3) tenant-aware branding header, (4) NavLink active indicator + Skills nav button + remove HeaderStats, (5) contributor tier computation, (6) greeting area redesign, (7) Caddy vanity domain config.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, Server Components | Already in use |
| Tailwind CSS | 4.0.0 | Styling, animations via `@theme` | Already in use |
| Drizzle ORM | 0.42.0 | Schema, migrations | Already in use |
| next/navigation | (bundled) | `usePathname()` for active links | Official Next.js hook |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | 2.8.7 | URL state management | Already used in HomeTabs |
| react-sparklines | 1.7.0 | Trend sparklines | Keep for any remaining sparklines |

### No New Dependencies Needed
| Problem | Don't Install | Use Instead |
|---------|---------------|-------------|
| Logo animation | framer-motion, GSAP, Lottie | CSS `@keyframes` + SVG inline |
| Active nav link | third-party nav library | `usePathname()` + Tailwind classes |
| Tier badges | icon library | Tailwind + inline SVG or Unicode |
| Image optimization | external CDN | `next/image` with `remotePatterns` |

## Architecture Patterns

### Current Navigation Structure
```
apps/web/app/(protected)/layout.tsx     -- Server component, renders header + nav
  components/header-stats.tsx           -- Client: "2.7Y saved" sparkline (REMOVE per BRAND-06)
  components/sparkline.tsx              -- Client: react-sparklines wrapper
  components/sign-out-button.tsx        -- Server action form
```

### Current Header Layout (line-by-line)
```
<header border-b bg-white>
  <div h-16 flex justify-between>
    LEFT:  [Logo text "EverySkill"] [HeaderStats sparkline] [Nav: Home, Analytics, Profile, Admin?]
    RIGHT: [User avatar + name link] [Sign Out]
  </div>
</header>
```

### Target Header Layout
```
<header border-b bg-white>
  <div h-16 flex justify-between>
    LEFT:  [AnimatedLogo OR TenantBranding] [Nav: Home, Skills, Analytics, Profile, Admin?]
    RIGHT: [GreetingArea: "Name -- XX Days | Tier"] [User avatar] [Sign Out]
  </div>
</header>
```

### Key Changes Summary
1. **Logo area:** Text "EverySkill" becomes animated SVG logo. For freemium tenants: "TenantName x EverySkill". For paid tenants: tenant logo only.
2. **HeaderStats removed:** The sparkline/"years saved" display is removed from nav (BRAND-06).
3. **Skills nav added:** New "Skills" link between Home and Analytics (BRAND-05).
4. **Active indicator:** Each NavLink gets bottom border-2 when pathname matches (BRAND-04).
5. **Greeting area:** Right side shows "Name -- XX Days Saved | Gold Contributor" (BRAND-07, BRAND-08).

### Recommended Component Structure
```
apps/web/
  components/
    nav-link.tsx               -- NEW: Client component with usePathname() active state
    animated-logo.tsx          -- NEW: SVG logo with CSS keyframes animation
    tenant-branding.tsx        -- NEW: Server component, selects branding per tenant plan
    greeting-area.tsx          -- NEW: Server component, shows name + days + tier
    contributor-tier-badge.tsx -- NEW: Client component, renders tier badge
  lib/
    contributor-tier.ts        -- NEW: getContributorTier() computation logic
```

### Pattern 1: Active NavLink with usePathname
**What:** Client component that wraps Next.js Link with active state detection
**When to use:** Every nav link in the header
**Example:**
```typescript
// Source: Next.js docs + verified pattern
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  // Exact match for "/" (Home), prefix match for others
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`text-sm font-medium transition ${
        isActive
          ? "border-b-2 border-blue-500 text-blue-600 pb-[18px]"
          : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </Link>
  );
}
```

### Pattern 2: Tenant-Aware Branding (Server Component)
**What:** Server component that reads tenant data and renders appropriate branding
**When to use:** Logo area of the header
**Example:**
```typescript
// Server component in layout — no "use client"
import { getTenantBySlug } from "@everyskill/db/services/tenant";
import { headers } from "next/headers";
import Image from "next/image";
import { AnimatedLogo } from "@/components/animated-logo";

export async function TenantBranding() {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  if (!slug) {
    // No subdomain = show EverySkill logo
    return <AnimatedLogo />;
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return <AnimatedLogo />;
  }

  if (tenant.plan === "paid" && tenant.logo) {
    // Paid: show tenant logo only
    return (
      <Image src={tenant.logo} alt={tenant.name} width={120} height={32} />
    );
  }

  // Freemium: "TenantName x EverySkill"
  return (
    <div className="flex items-center gap-2">
      {tenant.logo && (
        <Image src={tenant.logo} alt={tenant.name} width={24} height={24} />
      )}
      <span className="text-sm font-semibold text-gray-700">{tenant.name}</span>
      <span className="text-xs text-gray-400">x</span>
      <AnimatedLogo size="small" />
    </div>
  );
}
```

### Pattern 3: Contributor Tier Computation
**What:** Pure function that takes user stats and returns a tier
**When to use:** Greeting area, profile page
**Example:**
```typescript
// Composite scoring: weighted sum of normalized metrics
export type ContributorTier = "Platinum" | "Gold" | "Silver" | "Bronze";

interface TierInput {
  skillsShared: number;    // Count of published skills
  daysSaved: number;       // FTE days saved by their skills
  avgRating: number | null; // 0-5 scale, null if no ratings
  totalUses: number;       // Total uses of their skills
}

// Thresholds (tune as needed)
const TIER_THRESHOLDS = {
  Platinum: 75,
  Gold: 50,
  Silver: 25,
  Bronze: 0,
} as const;

export function getContributorTier(input: TierInput): ContributorTier {
  // Normalize each metric to 0-25 points (max 100 total)
  const skillsScore = Math.min(input.skillsShared * 5, 25);
  const daysScore = Math.min(input.daysSaved * 2, 25);
  const ratingScore = input.avgRating !== null ? (input.avgRating / 5) * 25 : 0;
  const usageScore = Math.min(input.totalUses * 0.5, 25);

  const total = skillsScore + daysScore + ratingScore + usageScore;

  if (total >= TIER_THRESHOLDS.Platinum) return "Platinum";
  if (total >= TIER_THRESHOLDS.Gold) return "Gold";
  if (total >= TIER_THRESHOLDS.Silver) return "Silver";
  return "Bronze";
}
```

### Pattern 4: Animated SVG Logo with CSS Keyframes
**What:** Inline SVG with CSS animation -- no external dependencies
**When to use:** Logo area (replaces text "EverySkill")
**Example:**
```typescript
"use client";

// Baton-pass concept: two elements passing motion to each other
// Using CSS @keyframes for a smooth hand-off animation
export function AnimatedLogo({ size = "default" }: { size?: "default" | "small" }) {
  const w = size === "small" ? 100 : 140;
  const h = size === "small" ? 24 : 32;

  return (
    <div className="flex items-center gap-1">
      <svg width={h} height={h} viewBox="0 0 32 32" className="animated-logo">
        {/* Baton / relay symbol */}
        <circle cx="10" cy="16" r="4" fill="#0ea5e9" className="animate-relay-left" />
        <circle cx="22" cy="16" r="4" fill="#6366f1" className="animate-relay-right" />
        <rect x="12" y="14" width="8" height="4" rx="2" fill="#0ea5e9" className="animate-relay-baton" />
      </svg>
      <span className={`font-bold text-gray-900 ${size === "small" ? "text-sm" : "text-xl"}`}>
        EverySkill
      </span>
    </div>
  );
}

// CSS (add to globals.css):
// @keyframes relay-left { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
// @keyframes relay-right { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
// @keyframes relay-baton { 0%,100% { opacity: 1; } 50% { opacity: 0.6; transform: scaleX(1.2); } }
// .animate-relay-left { animation: relay-left 3s ease-in-out infinite; }
// .animate-relay-right { animation: relay-right 3s ease-in-out infinite; }
// .animate-relay-baton { animation: relay-baton 3s ease-in-out infinite; }
```

### Anti-Patterns to Avoid
- **Don't use `toLocaleDateString()` in client components** -- causes hydration mismatches (documented in MEMORY.md)
- **Don't add framer-motion or GSAP** -- CSS keyframes are sufficient for a simple logo animation; adding 40kB+ for one animation is wasteful
- **Don't compute tiers on every render** -- compute in server component and pass as prop
- **Don't use `useSelectedLayoutSegment()`** for active links -- `usePathname()` is simpler and more explicit for this use case
- **Don't store vanity domain in a separate table** -- add it as a column on `tenants` (single source of truth)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active link detection | Custom intersection observer | `usePathname()` from `next/navigation` | Built-in, SSR-safe, zero bundle cost |
| CSS animations | JS animation library | `@keyframes` in globals.css | No dependencies, GPU-accelerated, no hydration issues |
| Image optimization | Manual resizing/CDN | `next/image` with `remotePatterns` | Built-in optimization, lazy loading, AVIF/WebP |
| TLS for vanity domains | Manual cert management | Caddy on-demand TLS | Automatic provisioning, renewal, zero-downtime |

**Key insight:** Every requirement in this phase can be met with tools already in the stack. No new npm dependencies are needed.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch in NavLink
**What goes wrong:** `usePathname()` returns different values during SSR vs client, causing React hydration errors
**Why it happens:** Server doesn't know the pathname the same way the client does in some edge cases
**How to avoid:** Mark the NavLink as `"use client"` and ensure it's a leaf component. The parent layout (server component) renders it without conditional logic around the pathname.
**Warning signs:** Console errors about "Expected server HTML to match client"

### Pitfall 2: Tenant Logo Image Domains
**What goes wrong:** `next/image` blocks external URLs not in `remotePatterns`
**Why it happens:** Each tenant's logo URL could be from any domain
**How to avoid:** Either (a) require tenants to upload logos to R2 (single domain in remotePatterns), or (b) add a wildcard pattern or use `unoptimized` prop for external URLs, or (c) use `<img>` tag for tenant logos
**Warning signs:** Build/runtime errors about "Invalid src prop" or "hostname not configured"

### Pitfall 3: Active Link Prefix Matching on "/"
**What goes wrong:** Home link (`/`) is always "active" because every path starts with `/`
**Why it happens:** Using `pathname.startsWith(href)` for all links
**How to avoid:** Use exact match (`pathname === "/"`) for the Home link, prefix match for others
**Warning signs:** Home nav always has the active indicator

### Pitfall 4: Vanity Domain TLS Without Ask Endpoint
**What goes wrong:** Anyone can point DNS to your server and get a certificate, exhausting Let's Encrypt rate limits
**Why it happens:** Caddy on-demand TLS without the `ask` endpoint validation
**How to avoid:** Always configure `on_demand_tls { ask http://localhost:2000/api/check-domain }` in global options, and implement the check endpoint to validate against the tenants table
**Warning signs:** Certificate issuance for unknown domains, Let's Encrypt rate limit errors

### Pitfall 5: Middleware Not Handling Vanity Domains
**What goes wrong:** Vanity domain requests don't get the `x-tenant-slug` header, so tenant context is lost
**Why it happens:** Current `extractSubdomain()` only checks for subdomains of `everyskill.ai` and `localhost`
**How to avoid:** Add a fallback in middleware: if hostname doesn't match root domain patterns, look up tenant by vanity domain
**Warning signs:** 404 or default-tenant data shown on vanity domains

### Pitfall 6: Greeting Stats Computed Every Request
**What goes wrong:** Expensive SQL queries run on every page load because greeting is in the layout
**Why it happens:** Layout is a server component that runs on every navigation
**How to avoid:** Either (a) cache user stats with `unstable_cache` / Data Cache, or (b) accept the cost since it's a single query per page load (likely acceptable), or (c) move greeting to page-level with `generateMetadata`-style caching
**Warning signs:** Slow page loads, high DB query count in production

## Code Examples

### Example 1: Current Tenant Schema (Existing)
```typescript
// Source: packages/db/src/schema/tenants.ts (verified)
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),           // e.g., "company.com" for email-based matching
  logo: text("logo"),               // URL to tenant logo (ALREADY EXISTS)
  isActive: boolean("is_active").notNull().default(true),
  plan: text("plan").notNull().default("freemium"), // "freemium" | "paid" (ALREADY EXISTS)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Example 2: Schema Migration Needed
```sql
-- Migration: add vanity_domain to tenants
ALTER TABLE tenants ADD COLUMN vanity_domain TEXT UNIQUE;
-- Example: vanity_domain = "skills.acmecorp.com"
```

Only ONE new column needed. `logo` and `plan` already exist.

### Example 3: Drizzle Schema Addition
```typescript
// Add to packages/db/src/schema/tenants.ts
vanityDomain: text("vanity_domain").unique(), // e.g., "skills.acmecorp.com"
```

### Example 4: Middleware Vanity Domain Support
```typescript
// In middleware.ts, after existing extractSubdomain logic:
// If no subdomain extracted and host doesn't match root domain,
// treat as potential vanity domain
if (!subdomain && !host.includes(ROOT_DOMAIN) && !host.includes("localhost")) {
  // Set a header so the app can look up the tenant by vanity domain
  requestHeaders.set("x-vanity-domain", host.split(":")[0]);
}
```

### Example 5: Current User Stats (Already Available)
```typescript
// Source: apps/web/lib/user-stats.ts (verified)
export interface UserStats {
  skillsShared: number;  // Count of published skills
  totalUses: number;     // Sum of all uses across their skills
  avgRating: string | null; // Average rating formatted as "4.5"
  fteDaysSaved: number;  // Sum of (totalUses * hoursSaved) / 8
}
```
This is exactly what's needed for contributor tier computation.

### Example 6: Current HeaderStats to Remove
```typescript
// Source: apps/web/components/header-stats.tsx (verified)
// Shows "X.X years saved" with sparkline -- to be REMOVED per BRAND-06
// Currently imported in layout.tsx line 6, used on line 31
// Also remove: getTotalStats() import on line 7, call on line 19
```

### Example 7: Caddy On-Demand TLS for Vanity Domains
```
# Updated Caddyfile for vanity domain support
{
    on_demand_tls {
        ask http://web:2000/api/check-domain
    }
}

# Existing wildcard for *.everyskill.ai
*.everyskill.ai, everyskill.ai {
    tls {
        dns hetzner {env.HETZNER_DNS_API_TOKEN}
    }
    reverse_proxy web:2000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# Catch-all for vanity domains (on-demand TLS)
https:// {
    tls {
        on_demand
    }
    reverse_proxy web:2000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Example 8: Check-Domain API Endpoint
```typescript
// apps/web/app/api/check-domain/route.ts
// Caddy asks this before issuing a certificate
import { NextRequest, NextResponse } from "next/server";
import { getTenantByVanityDomain } from "@everyskill/db/services/tenant";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({}, { status: 400 });

  const tenant = await getTenantByVanityDomain(domain);
  if (!tenant) return NextResponse.json({}, { status: 404 }); // Reject: no cert

  return NextResponse.json({ ok: true }, { status: 200 }); // Allow cert issuance
}
```

## Existing Data Inventory

### What Already Exists (No Changes Needed)
| Item | Location | Status |
|------|----------|--------|
| `tenants.logo` column | `packages/db/src/schema/tenants.ts` | EXISTS (nullable text) |
| `tenants.plan` column | `packages/db/src/schema/tenants.ts` | EXISTS (default "freemium") |
| `tenants.slug` column | `packages/db/src/schema/tenants.ts` | EXISTS (unique) |
| `tenants.domain` column | `packages/db/src/schema/tenants.ts` | EXISTS (email domain matching) |
| `getUserStats()` | `apps/web/lib/user-stats.ts` | EXISTS (skillsShared, totalUses, avgRating, fteDaysSaved) |
| `getTenantBySlug()` | `packages/db/src/services/tenant.ts` | EXISTS |
| `getTenantByDomain()` | `packages/db/src/services/tenant.ts` | EXISTS |
| Subdomain extraction | `apps/web/middleware.ts` | EXISTS (extractSubdomain) |
| `x-tenant-slug` header | `apps/web/middleware.ts` | EXISTS |
| Caddy wildcard TLS | `docker/Caddyfile` | EXISTS (*.everyskill.ai) |
| Custom Caddy build | `docker/Dockerfile.caddy` | EXISTS (with hetzner DNS plugin) |
| `/skills` page | `apps/web/app/(protected)/skills/page.tsx` | EXISTS |

### What Must Be Added
| Item | Location | Why |
|------|----------|-----|
| `tenants.vanity_domain` column | Schema + migration | BRAND-03: vanity URL support |
| `getTenantByVanityDomain()` | `packages/db/src/services/tenant.ts` | Middleware + check-domain lookup |
| `NavLink` component | `apps/web/components/nav-link.tsx` | BRAND-04: active indicator |
| `AnimatedLogo` component | `apps/web/components/animated-logo.tsx` | BRAND-01: animated logo |
| `TenantBranding` component | `apps/web/components/tenant-branding.tsx` | BRAND-02: white-label |
| `GreetingArea` component | `apps/web/components/greeting-area.tsx` | BRAND-07: name + days + tier |
| `getContributorTier()` | `apps/web/lib/contributor-tier.ts` | BRAND-08: tier computation |
| CSS keyframe animations | `apps/web/app/globals.css` | BRAND-01: logo animation |
| `/api/check-domain` endpoint | `apps/web/app/api/check-domain/route.ts` | BRAND-03: Caddy domain validation |
| Caddy on-demand TLS config | `docker/Caddyfile` | BRAND-03: vanity TLS |
| Middleware vanity domain handling | `apps/web/middleware.ts` | BRAND-03: tenant resolution |

### What Must Be Modified
| File | Change |
|------|--------|
| `apps/web/app/(protected)/layout.tsx` | Replace logo, remove HeaderStats, add Skills nav, use NavLink, add GreetingArea |
| `apps/web/middleware.ts` | Add vanity domain detection fallback |
| `docker/Caddyfile` | Add on-demand TLS block + ask endpoint |
| `apps/web/next.config.ts` | Add remotePatterns for tenant logo domains (or R2) |
| `apps/web/middleware.ts` | Add `/api/check-domain` to exempt paths |

### What Must Be Removed
| File | What | Why |
|------|------|-----|
| `apps/web/components/header-stats.tsx` | Component | BRAND-06: remove "2.7Y saved" from nav |
| Layout import of HeaderStats | Import + JSX | BRAND-06 |
| Layout import of getTotalStats | Import + call | BRAND-06 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSelectedLayoutSegment()` | `usePathname()` | Next.js 13+ App Router | Simpler, more explicit |
| framer-motion for simple animations | CSS `@keyframes` | Tailwind v4 / modern CSS | Zero bundle cost |
| Manual TLS with certbot | Caddy on-demand TLS | Caddy v2 | Automatic cert management |
| `headers()` sync | `headers()` async (awaitable) | Next.js 15+ | Must `await headers()` |

## Suggested Plan Breakdown

| Plan | Requirements | Scope | Dependencies |
|------|-------------|-------|-------------|
| 30-01 | BRAND-01 | Animated SVG logo component + CSS keyframes in globals.css | None |
| 30-02 | BRAND-04, BRAND-05, BRAND-06 | NavLink component + Skills link + remove HeaderStats | None |
| 30-03 | BRAND-08, BRAND-07 | Contributor tier computation + GreetingArea component | None |
| 30-04 | BRAND-02 | Tenant-aware branding in header (TenantBranding component) | 30-01 |
| 30-05 | BRAND-02 (integration) | Update layout.tsx to wire all new components | 30-01, 30-02, 30-03, 30-04 |
| 30-06 | BRAND-03 (schema) | Add `vanity_domain` column + migration + service function | None |
| 30-07 | BRAND-03 (infra) | Middleware vanity domain support + check-domain API + Caddyfile | 30-06 |

**Wave structure:**
- Wave 1 (parallel): Plans 01, 02, 03, 06 (no shared files)
- Wave 2 (parallel): Plans 04, 07 (depend on wave 1, no shared files)
- Wave 3: Plan 05 (integration, depends on all above)

## Open Questions

1. **Logo SVG Design**
   - What we know: Requirement says "baton pass concept" and "animated relay logo"
   - What's unclear: Exact SVG design -- the placeholder in code examples is conceptual
   - Recommendation: Start with a simple two-circle relay animation; iterate on design after functional implementation works

2. **Tenant Logo Storage**
   - What we know: `tenants.logo` column exists (nullable text URL)
   - What's unclear: Will logos be uploaded to R2 (controlled domain) or linked from arbitrary URLs?
   - Recommendation: For Phase 30, accept arbitrary URLs and use `<img>` tag (not next/image) to avoid remotePatterns issues. Future phase can add R2 upload.

3. **Tier Thresholds**
   - What we know: Four tiers (Platinum/Gold/Silver/Bronze), four input metrics
   - What's unclear: Exact point thresholds that feel fair for the current user base
   - Recommendation: Start with the suggested thresholds (75/50/25/0) and make them configurable constants. Tune after observing real data.

4. **Greeting Area Data Freshness**
   - What we know: `getUserStats()` runs a DB query each call
   - What's unclear: Performance impact of running this on every page load via layout
   - Recommendation: Accept the single query cost initially. Add `unstable_cache` with 60s revalidation if performance becomes an issue.

## Sources

### Primary (HIGH confidence)
- `apps/web/app/(protected)/layout.tsx` -- Current navigation structure, imports, layout
- `packages/db/src/schema/tenants.ts` -- Tenant schema with logo, plan, slug, domain columns
- `packages/db/src/services/tenant.ts` -- getTenantBySlug, getTenantByDomain functions
- `apps/web/middleware.ts` -- extractSubdomain, x-tenant-slug header injection
- `apps/web/lib/user-stats.ts` -- getUserStats with skillsShared, totalUses, avgRating, fteDaysSaved
- `apps/web/components/header-stats.tsx` -- Current "years saved" display (to be removed)
- `docker/Caddyfile` -- Current wildcard TLS configuration
- `docker/Dockerfile.caddy` -- Custom Caddy build with hetzner DNS plugin

### Secondary (MEDIUM confidence)
- [Next.js Active Links docs](https://nextjs.org/learn/dashboard-app/navigating-between-pages) -- usePathname pattern
- [Caddy On-Demand TLS docs](https://caddyserver.com/on-demand-tls) -- ask endpoint, Caddyfile syntax
- [Caddy TLS directive docs](https://caddyserver.com/docs/caddyfile/directives/tls) -- on_demand subdirective
- [SVG Animation with CSS guide (2026)](https://www.svggenie.com/blog/svg-animations-complete-guide) -- @keyframes for SVG elements
- [LogRocket SVG animation tutorial](https://blog.logrocket.com/how-to-animate-svg-css-tutorial-examples/) -- stroke-dasharray techniques

### Tertiary (LOW confidence)
- [Caddy vanity subdomains for SaaS](https://logsnag.com/blog/setting-up-vanity-subdomains-for-your-saas-using-caddy) -- Community implementation pattern
- [Honeybadger custom domains with Caddy](https://www.honeybadger.io/blog/secure-custom-domains-caddy/) -- Production deployment guide

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed, no new deps needed
- Architecture: HIGH -- Direct codebase analysis, all files verified
- Navigation patterns: HIGH -- usePathname() is the official Next.js pattern, well-documented
- Tenant branding: HIGH -- Schema columns already exist (logo, plan), just need UI components
- Contributor tiers: MEDIUM -- Algorithm is straightforward but thresholds need real-data tuning
- Vanity domains: MEDIUM -- Caddy on-demand TLS is well-documented but needs integration testing
- Logo animation: MEDIUM -- CSS approach is solid but exact SVG design is creative, not technical

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stable tech, no fast-moving dependencies)
