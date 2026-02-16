# Phase 67: Skills Resume - Research

**Researched:** 2026-02-16
**Domain:** Public shareable resume page + PDF export, Next.js App Router
**Confidence:** HIGH

## Summary

Phase 67 requires building a shareable "Skills Resume" that summarizes a user's portable skills, quantified impact, and quality achievements for professional use. The feature involves three parts: (1) a resume generation/preview page behind auth at `/portfolio/resume`, (2) a public read-only page at `/r/[token]` accessible without authentication, and (3) PDF download using the existing jsPDF + jspdf-autotable stack already in the codebase.

The codebase already has all the data queries needed -- `getPortfolioStats`, `getPortfolioSkills`, `getImpactCalculatorStats` in `portfolio-queries.ts` provide skills authored, hours saved, and visibility breakdown. The `getSkillsCreatedStats` in `my-leverage.ts` provides unique users (people helped) via `COUNT(DISTINCT ue.user_id)`. Quality badges are computed client-side via `calculateQualityScore` in `quality-score.ts` -- there is no `quality_badge` column in the DB; badges are derived from totalUses, averageRating, totalRatings, and documentation completeness. The only new schema needed is a `resume_shares` table (or similar) to store share tokens for public URLs.

**Primary recommendation:** Create a new `resume_shares` table with a random token for public URLs, add a middleware exemption for `/r/[token]`, reuse existing portfolio queries with a visibility filter, and follow the jsPDF dynamic import pattern from `ip-export-buttons.tsx` for PDF generation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, server components, API routes | Already in use, RSC for data fetching |
| jsPDF | 4.1.0 | Client-side PDF generation | Already installed, used in IP export |
| jspdf-autotable | 5.0.7 | Table formatting in PDFs | Already installed, used in IP export |
| Drizzle ORM | 0.42.0 | Database queries and schema | Already in use throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.0 | Styling the resume page | Already in use for all components |
| Recharts | 3.7.0 | Optional timeline chart on public page | Already installed, used in portfolio |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF (client-side) | Puppeteer/server-side PDF | Server-side gives pixel-perfect PDF but requires headless browser; jsPDF is already working |
| Random token URL | Slug-based URL (e.g., /r/john-doe) | Slugs are guessable; tokens provide security-through-obscurity |
| New resume_shares table | Hash of user ID as token | Hash is deterministic (always same URL) but revocation requires changing the hash algorithm |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  app/
    (protected)/portfolio/
      resume/
        page.tsx              # Resume preview + share controls (auth required)
    r/
      [token]/
        page.tsx              # Public read-only resume view (no auth)
  components/
    resume-view.tsx           # Shared resume rendering component (used by both pages)
    resume-pdf-button.tsx     # PDF download button with jsPDF logic
    resume-share-controls.tsx # Generate/copy/revoke share link
  lib/
    resume-queries.ts         # Resume-specific data fetching (aggregates existing queries)
  app/actions/
    resume-share.ts           # Server actions: create/revoke share tokens
packages/db/
  src/schema/
    resume-shares.ts          # New table for share tokens
  src/migrations/
    0036_add_resume_shares.sql
```

### Pattern 1: Public Route via Middleware Exemption
**What:** Add `/r/` paths to the middleware exempt list so they bypass auth checks.
**When to use:** Any time a route needs to be accessible without login.
**Example:**
```typescript
// In apps/web/middleware.ts, add to the exempt paths:
if (
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/r/") ||           // <-- Public resume routes
  // ... other exemptions
) {
  return NextResponse.next();
}
```

### Pattern 2: Token-Based Public Access
**What:** Generate a cryptographically random token stored in `resume_shares` table. The public URL is `/r/[token]`. The page looks up the token, finds the owner, and renders their resume data.
**When to use:** Shareable content that should not be guessable.
**Example:**
```typescript
// Schema: resume_shares table
export const resumeShares = pgTable("resume_shares", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  includeCompanySkills: boolean("include_company_skills").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // null = never expires
  revokedAt: timestamp("revoked_at"), // null = active
});
```

### Pattern 3: Reusing jsPDF Dynamic Import
**What:** Follow the exact pattern from `ip-export-buttons.tsx` -- dynamic import of jsPDF and jspdf-autotable to avoid bloating the initial bundle.
**When to use:** All client-side PDF generation.
**Example:**
```typescript
// Source: apps/web/components/ip-export-buttons.tsx (existing pattern)
const handlePdfExport = async () => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  // ... build PDF
  doc.save(`skills-resume-${today}.pdf`);
};
```

### Pattern 4: Shared Resume View Component
**What:** A single `resume-view.tsx` component renders the resume layout. It receives data as props and is used by both the authenticated preview page and the public page. This avoids duplicating the layout.
**When to use:** Any content that appears both behind and outside auth.

### Pattern 5: RLS Bypass for Public Queries
**What:** The public `/r/[token]` page cannot rely on session-based tenant context. Since the DB connection defaults to `DEFAULT_TENANT_ID` (set in `client.ts` connection config), and the current deployment is single-tenant, queries will work without explicit tenant scoping. For multi-tenant safety, the resume query should explicitly join through `resume_shares.tenant_id` and use `withTenant()`.
**When to use:** Any public-facing data query.
**Example:**
```typescript
// For single-tenant phase: queries work with default RLS context
// For multi-tenant safety: use withTenant
import { withTenant } from "@everyskill/db/tenant-context";

async function getResumeByToken(token: string) {
  // First, look up the share record (no tenant scope needed on resume_shares lookup)
  const share = await db.execute(sql`
    SELECT user_id, tenant_id, include_company_skills
    FROM resume_shares
    WHERE token = ${token}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  `);
  if (!share[0]) return null;

  // Then fetch user's resume data within their tenant context
  const { user_id, tenant_id, include_company_skills } = share[0];
  return withTenant(tenant_id, async (tx) => {
    // Run portfolio queries scoped to this tenant
  });
}
```

### Anti-Patterns to Avoid
- **Rendering the resume as HTML then converting to PDF:** Results in poor quality. Use jsPDF's native text/table APIs for clean PDFs.
- **Storing resume content in the DB:** The resume is a dynamic view of live data, not a snapshot. Always query fresh data when viewing.
- **Using predictable share URLs:** Don't use `/resume/[userId]` -- user IDs can be enumerated. Use random tokens.
- **Including company skills by default:** The success criteria explicitly states "Only portable/personal-scoped skills are included by default."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas/SVG-to-PDF | jsPDF + jspdf-autotable | Already working pattern in codebase |
| Quality badge calculation | Inline badge logic | `calculateQualityScore()` from `lib/quality-score.ts` | Tested, weighted algorithm with proper tier thresholds |
| "People helped" metric | Custom user counting | `COUNT(DISTINCT ue.user_id)` pattern from `my-leverage.ts` | Already proven SQL pattern |
| Share token generation | UUID substring or base64 | `crypto.randomUUID()` | Cryptographically secure, no collision risk |
| Currency/number formatting | `toLocaleString()` | Manual regex from `ip-valuation.ts` formatCurrency | Prevents hydration mismatches per project rules |

**Key insight:** Nearly all the data computation is already built -- the resume is a read-only formatted view of existing portfolio + impact data.

## Common Pitfalls

### Pitfall 1: Hydration Mismatches on Date/Number Formatting
**What goes wrong:** Using `toLocaleDateString()` or `toLocaleString()` causes SSR/client mismatch.
**Why it happens:** Node.js and browser have different Intl implementations.
**How to avoid:** Use manual UTC formatting per MEMORY.md: `MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear()`.
**Warning signs:** React hydration error in console.

### Pitfall 2: RLS Blocking Public Resume Queries
**What goes wrong:** Public page queries return empty results because RLS restricts to `app.current_tenant_id`.
**Why it happens:** The public page has no session, so no tenant context is set explicitly. The default connection sets `DEFAULT_TENANT_ID` which works in single-tenant but not multi-tenant.
**How to avoid:** Look up the tenant_id from the resume_shares record first, then use `withTenant()` to scope the data queries.
**Warning signs:** Resume page shows 0 skills, empty stats.

### Pitfall 3: Middleware Not Exempting Public Route
**What goes wrong:** Visiting `/r/[token]` redirects to login.
**Why it happens:** The middleware redirects unauthenticated users to `/login` for all paths not in the exempt list.
**How to avoid:** Add `pathname.startsWith("/r/")` to the exempt conditions in `middleware.ts`.
**Warning signs:** 302 redirect loop to /login.

### Pitfall 4: Including Company Skills by Default Violates IP Rules
**What goes wrong:** Company-owned skills appear on the public resume.
**Why it happens:** Queries don't filter by `visibility = 'personal'` by default.
**How to avoid:** Default the filter to `visibility = 'personal'` (portable only). Store `include_company_skills` boolean on the share record and only include tenant-visibility skills when explicitly toggled.
**Warning signs:** Skills with "Company" badge appear on public resume.

### Pitfall 5: PDF Bundle Size Bloat
**What goes wrong:** jsPDF (~400KB gzipped) loads on page load, slowing Time to Interactive.
**Why it happens:** Static import at top of file.
**How to avoid:** Dynamic import (`await import("jspdf")`) inside the click handler, exactly as done in `ip-export-buttons.tsx`.
**Warning signs:** Large chunk in Next.js build output.

### Pitfall 6: quality_badge Column Doesn't Exist
**What goes wrong:** Planner assumes a `quality_badge` column exists on the skills table.
**Why it happens:** The success criteria mentions "Gold/Silver badges earned" but the codebase computes badges dynamically.
**How to avoid:** Use `calculateQualityScore()` from `lib/quality-score.ts` on each skill's data (totalUses, averageRating, totalRatings, description, category). The badge is derived, not stored.
**Warning signs:** SQL error on non-existent column.

## Code Examples

### Resume Data Aggregation Query
```typescript
// Builds on existing patterns from portfolio-queries.ts and my-leverage.ts
// Returns all data needed for the resume in one function
export async function getResumeData(
  userId: string,
  includeCompanySkills: boolean = false
): Promise<ResumeData> {
  const visibilityFilter = includeCompanySkills
    ? sql``
    : sql`AND s.visibility = 'personal'`;

  const [stats, skills, peopleHelped] = await Promise.all([
    // Aggregate stats (reuse pattern from getPortfolioStats)
    db.execute(sql`
      SELECT
        COUNT(*)::integer AS skills_authored,
        COALESCE(SUM(total_uses), 0)::integer AS total_uses,
        COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)), 0)::double precision AS total_hours_saved
      FROM skills s
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityFilter}
    `),
    // Skill list with quality data
    db.execute(sql`
      SELECT
        s.id, s.name, s.category, s.total_uses, s.hours_saved,
        (s.total_uses * COALESCE(s.hours_saved, 1))::double precision AS total_hours_saved,
        s.average_rating, s.description, s.visibility, s.created_at,
        (SELECT COUNT(*)::integer FROM ratings r WHERE r.skill_id = s.id) AS total_ratings
      FROM skills s
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityFilter}
      ORDER BY total_hours_saved DESC
    `),
    // People helped (distinct users across all skills)
    db.execute(sql`
      SELECT COUNT(DISTINCT ue.user_id)::integer AS people_helped
      FROM usage_events ue
      JOIN skills s ON s.id = ue.skill_id
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityFilter}
    `),
  ]);
  // ... map results
}
```

### Public Resume Page (App Router)
```typescript
// apps/web/app/r/[token]/page.tsx
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";
import { ResumeView } from "@/components/resume-view";
import { notFound } from "next/navigation";

export default async function PublicResumePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look up share record
  const result = await db.execute(sql`
    SELECT user_id, tenant_id, include_company_skills
    FROM resume_shares
    WHERE token = ${token}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);
  const share = (result as unknown as Record<string, unknown>[])[0];
  if (!share) notFound();

  // Fetch resume data
  const resumeData = await getResumeData(
    String(share.user_id),
    Boolean(share.include_company_skills)
  );

  return <ResumeView data={resumeData} isPublic />;
}
```

### PDF Generation (following existing pattern)
```typescript
// Source pattern: apps/web/components/ip-export-buttons.tsx
const handleDownloadPdf = async () => {
  setIsExporting(true);
  try {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(22);
    doc.text(userName, 14, y);
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("Skills Resume", 14, y);
    y += 14;

    // Impact Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Impact Summary", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Skills Authored: ${data.skillsAuthored}`, 14, y); y += 6;
    doc.text(`Hours Saved: ${data.totalHoursSaved.toFixed(0)}`, 14, y); y += 6;
    doc.text(`People Helped: ${data.peopleHelped}`, 14, y); y += 6;
    doc.text(`Estimated Value: $${formatCurrency(data.totalHoursSaved * 150)}`, 14, y);
    y += 12;

    // Skills Table
    autoTable(doc, {
      startY: y,
      head: [["Skill", "Category", "Uses", "Hours Saved", "Quality"]],
      body: data.skills.map(s => [
        s.name,
        s.category,
        String(s.totalUses),
        s.totalHoursSaved.toFixed(1),
        s.qualityTier,
      ]),
      headStyles: { fillColor: [11, 22, 36] }, // Match existing theme
      styles: { fontSize: 9 },
    });

    doc.save(`skills-resume-${today}.pdf`);
  } catch (error) {
    console.error("PDF export failed:", error);
    alert("PDF export failed. Please try again.");
  } finally {
    setIsExporting(false);
  }
};
```

### Server Action for Share Token Management
```typescript
// apps/web/app/actions/resume-share.ts
"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

export async function createResumeShare(includeCompanySkills: boolean = false) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const token = crypto.randomUUID();
  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  // Upsert: if a share already exists for this user, update it
  await db.execute(sql`
    INSERT INTO resume_shares (id, tenant_id, user_id, token, include_company_skills)
    VALUES (${crypto.randomUUID()}, ${tenantId}, ${userId}, ${token}, ${includeCompanySkills})
    ON CONFLICT (user_id) WHERE revoked_at IS NULL
    DO UPDATE SET
      token = ${token},
      include_company_skills = ${includeCompanySkills},
      created_at = NOW()
  `);

  return { token, url: `/r/${token}` };
}

export async function revokeResumeShare() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db.execute(sql`
    UPDATE resume_shares
    SET revoked_at = NOW()
    WHERE user_id = ${session.user.id}
      AND revoked_at IS NULL
  `);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate data fetching for each metric | Parallel Promise.all with portfolio-queries | Phase 65 (current) | Single pattern for all portfolio data |
| Static `quality_badge` column | Dynamic `calculateQualityScore()` | Already in codebase | No schema dependency for badge display |
| Server-side PDF (Puppeteer) | Client-side jsPDF | Phase 64 IP export | No headless browser needed, simpler deployment |

**Deprecated/outdated:**
- None relevant -- all tools are current.

## Open Questions

1. **Share URL structure: `/r/[token]` vs `/resume/[token]`**
   - What we know: `/r/` is shorter and cleaner for sharing
   - What's unclear: Whether the user prefers a more descriptive path
   - Recommendation: Use `/r/[token]` -- shorter URLs are better for sharing on resumes and LinkedIn

2. **Should the resume have an expiration?**
   - What we know: The schema supports an optional `expires_at` column
   - What's unclear: Whether the user wants auto-expiring links
   - Recommendation: Default to no expiration, but include the column for future use

3. **User name on public resume**
   - What we know: `users.name` exists and comes from Google OAuth profile
   - What's unclear: Whether users want to customize the displayed name
   - Recommendation: Use `users.name` for now; custom name can be added later

4. **Contribution timeline on public resume**
   - What we know: `getImpactTimeline` exists and returns event data with cumulative hours
   - What's unclear: Whether the public resume should show a timeline chart or just stats
   - Recommendation: Include a simplified version (month/year of first and latest contribution) rather than the full interactive chart, to keep the public page lightweight

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/web/lib/portfolio-queries.ts` -- all portfolio aggregate queries
- Codebase inspection: `apps/web/lib/quality-score.ts` -- quality badge calculation logic
- Codebase inspection: `apps/web/lib/my-leverage.ts` -- `COUNT(DISTINCT ue.user_id)` pattern for people helped
- Codebase inspection: `apps/web/components/ip-export-buttons.tsx` -- jsPDF dynamic import pattern
- Codebase inspection: `apps/web/middleware.ts` -- auth exemption pattern
- Codebase inspection: `packages/db/src/schema/skills.ts` -- skills table structure (no quality_badge column)
- Codebase inspection: `packages/db/src/schema/usage-events.ts` -- usage events with user_id for people helped
- Codebase inspection: `packages/db/src/client.ts` -- RLS default tenant context
- Codebase inspection: `packages/db/src/tenant-context.ts` -- withTenant() for multi-tenant queries

### Secondary (MEDIUM confidence)
- jsPDF v4.1.0 installed, verified via `node_modules/jspdf/package.json`
- jspdf-autotable v5.0.7 installed, verified via `node_modules/jspdf-autotable/package.json`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and patterns verified in codebase
- Architecture: HIGH - Follows established patterns (middleware exemption, server actions, dynamic imports)
- Pitfalls: HIGH - All pitfalls identified from actual codebase patterns and project rules (MEMORY.md)
- Data queries: HIGH - All needed queries already exist or closely mirror existing patterns

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependencies changing)
