# Phase 64: IP Valuation & Export - Research

**Researched:** 2026-02-16
**Domain:** IP replacement cost estimation, PDF/CSV report generation, Next.js client-side exports
**Confidence:** HIGH

## Summary

Phase 64 adds two capabilities to the existing IP dashboard: (1) estimated replacement cost per skill and a total IP value hero stat, and (2) export functionality for both PDF and CSV formats. This is an additive layer on top of existing Phase 62/63 infrastructure -- no new database schema is needed, all calculations are SQL aggregations on existing columns, and the export logic follows the established pattern from the analytics CSV export.

The replacement cost formula must combine usage volume, hours saved, complexity (instruction content length since there is no "training examples count" column in the schema), and quality score. Because there is no explicit `training_examples` column, the `content` field length serves as the primary complexity proxy (longer skill instructions = more domain knowledge captured = higher replacement cost). The denormalized `average_rating` (stored as rating * 100) on the skills table provides the quality signal.

For PDF generation, jsPDF with jspdf-autotable is the recommended client-side approach. The project already uses the exact blob-download pattern (create Blob, createObjectURL, click link) in the existing `CsvExportButton` component. The PDF report is generated entirely on the client after fetching data via a server action, matching the existing architecture.

**Primary recommendation:** Add a new SQL query returning per-skill valuation data, a new server action to fetch it, compute replacement costs in TypeScript on the client, and reuse the existing blob-download pattern for both PDF (jsPDF) and CSV exports.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jspdf | ^4.1.0 | Client-side PDF document creation | Most popular JS PDF library, 485+ downstream packages, no server dependency |
| jspdf-autotable | ^5.0.7 | PDF table rendering plugin for jsPDF | Standard companion for tabular PDF reports, handles pagination/wrapping |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | ^3.7.0 (already installed) | Quality trend chart data | Already powering the dashboard charts |
| drizzle-orm | ^0.42.0 (already installed) | SQL query layer | Existing query pattern in ip-dashboard-queries.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF (client) | @react-pdf/renderer | React-pdf has SSR issues with Next.js 14+, requires dynamic imports with SSR disabled; jsPDF is simpler for structured reports |
| jsPDF (client) | Puppeteer (server) | Puppeteer requires headless Chrome on server, adds 300MB+ dependency; IP report is structured data, not rich HTML layout |
| jsPDF (client) | API route returning PDF stream | More complex, requires server-side jsPDF; client-side matches existing CSV export pattern |

**Installation:**
```bash
cd apps/web && pnpm add jspdf jspdf-autotable
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  lib/
    ip-dashboard-queries.ts     # ADD: getSkillValuationData() query
    ip-valuation.ts             # NEW: replacement cost formula + types
  app/
    actions/
      export-ip-report.ts      # NEW: server action fetching all export data
    (protected)/leverage/ip-dashboard/
      page.tsx                  # MODIFY: add valuation data to props
  components/
    ip-dashboard-view.tsx       # MODIFY: add total IP value hero stat + export buttons
    ip-valuation-table.tsx      # NEW: skill valuation table with replacement costs
    ip-export-buttons.tsx       # NEW: PDF + CSV export button pair
```

### Pattern 1: Replacement Cost Formula
**What:** A deterministic formula that estimates what it would cost to recreate a skill from scratch
**When to use:** For each skill row in the valuation table and for the total IP value hero stat

The formula combines four signals available in the existing schema:

```typescript
// Source: Codebase analysis of skills table columns
interface SkillValuationInput {
  totalUses: number;           // skills.total_uses
  hoursSaved: number;          // skills.hours_saved (per use, default 1)
  contentLength: number;       // LENGTH(skills.content) — proxy for instruction complexity
  qualityScore: number;        // skills.average_rating / 100 normalized to 0-1 (rating * 100 stored)
}

// Replacement cost formula:
// Base value = hours_saved * total_uses * HOURLY_RATE
// Complexity multiplier = 1 + log10(contentLength / 1000) capped at [1.0, 2.0]
// Quality multiplier = 0.5 + (qualityScore * 0.5) — range [0.5, 1.0]
// Replacement cost = base_value * complexity_multiplier * quality_multiplier

const HOURLY_RATE = 150; // $/hr — reasonable knowledge worker rate, configurable

function calculateReplacementCost(input: SkillValuationInput): number {
  const baseValue = input.hoursSaved * input.totalUses * HOURLY_RATE;

  // Complexity: longer content = more domain knowledge captured
  const complexityRaw = 1 + Math.log10(Math.max(input.contentLength, 1000) / 1000);
  const complexityMultiplier = Math.min(Math.max(complexityRaw, 1.0), 2.0);

  // Quality: higher-rated skills are more valuable
  const qualityMultiplier = 0.5 + (input.qualityScore * 0.5);

  return baseValue * complexityMultiplier * qualityMultiplier;
}
```

**Design rationale:**
- `hours_saved * total_uses * hourly_rate` = total economic value delivered
- Content length as complexity proxy: a 5KB skill captured more domain knowledge than a 500B one
- Log scale prevents content-padding from gaming the score
- Quality score rewards well-rated skills (more likely to be correct/useful)
- Skills with no rating (null average_rating) default to quality multiplier 0.75 (middle-ground)

### Pattern 2: Server Action for Export Data
**What:** A single server action that returns all data needed for both PDF and CSV exports
**When to use:** Called from client-side export buttons

```typescript
// Source: Existing pattern from apps/web/app/actions/export-analytics.ts
"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export async function fetchIpReportData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isAdmin(session)) throw new Error("Forbidden");

  const tenantId = session.user.tenantId;
  if (!tenantId) throw new Error("Unauthorized");

  // Fetch all data needed for the report
  const [stats, skills, riskEmployees, riskAlerts, trends] = await Promise.all([
    getIpDashboardStats(tenantId),
    getSkillValuationData(tenantId),   // NEW query
    getIpRiskEmployees(tenantId),
    getAtRiskSkillAlerts(tenantId),
    getQualityTrends(tenantId, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
  ]);

  return { stats, skills, riskEmployees, riskAlerts, trends };
}
```

### Pattern 3: Client-Side Blob Download (Existing Pattern)
**What:** Generate file in browser, trigger download via temporary link
**When to use:** For both PDF and CSV exports

```typescript
// Source: Existing pattern from apps/web/components/csv-export-button.tsx
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### Pattern 4: jsPDF Report Structure
**What:** Structured PDF with sections for executive summary, hero stats, tables, and risk assessment
**When to use:** For the PDF IP Report export

```typescript
// Source: jsPDF docs + jspdf-autotable docs
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function generateIpReport(data: IpReportData): Blob {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text("IP Report", 14, 20);

  // Executive summary section
  doc.setFontSize(12);
  doc.text(`Total IP Value: $${formatCurrency(data.totalValue)}`, 14, 35);
  doc.text(`Skills Captured: ${data.stats.totalSkillsCaptured}`, 14, 42);

  // Skills table with autoTable
  autoTable(doc, {
    startY: 55,
    head: [["Skill", "Author", "Uses", "Hours Saved", "Replacement Cost", "Risk"]],
    body: data.skills.map(s => [
      s.name, s.authorName, s.totalUses, s.hoursSaved,
      `$${formatCurrency(s.replacementCost)}`, s.riskLevel || "—"
    ]),
  });

  return doc.output("blob");
}
```

### Anti-Patterns to Avoid
- **Server-side PDF generation via API route:** Adds complexity; the existing export pattern is client-side blob download. Keep consistency.
- **Computing replacement cost in SQL:** The formula involves Math.log10 and clamping which are cleaner in TypeScript. SQL should return raw ingredients; TypeScript computes the cost.
- **Including chart images in PDF:** Attempting to render Recharts charts into the PDF adds enormous complexity (html2canvas, canvas-to-image). Use tabular data representation instead. The PDF is for "board presentations" — tables with numbers are clearer than small embedded charts.
- **Importing `ip-dashboard-queries.ts` constants into "use client" components:** This file is server-only. Inline any needed constants (as done in `ip-risk-section.tsx` already).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF table layout | Custom PDF table renderer | jspdf-autotable | Handles pagination, word wrap, column sizing, page breaks |
| PDF document creation | Canvas/SVG to PDF conversion | jsPDF | Mature, well-tested, handles fonts and layout |
| CSV escaping | Regex-based CSV builder | Reuse existing `escapeCSV()` from csv-export-button.tsx | Already handles commas, quotes, newlines correctly |
| Currency formatting | toLocaleString (hydration mismatch) | Manual formatter with commas and 2 decimal places | Avoids server/client Intl difference causing hydration errors |

**Key insight:** The existing CSV export button in the codebase provides the exact download-blob pattern, server-action-for-data pattern, and CSV escaping function. The PDF export is just a different serialization of the same data flow.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Currency Formatting
**What goes wrong:** Using `toLocaleString()` or `Intl.NumberFormat` for currency produces different output on Node.js vs browser, causing React hydration errors
**Why it happens:** Node.js and browser ICU data differ; this is a known issue documented in project MEMORY.md
**How to avoid:** Use manual formatting: `value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")` — same pattern as `formatNumber()` in ip-dashboard-view.tsx
**Warning signs:** React console warning about hydration mismatch on stat card values

### Pitfall 2: Importing Server-Only Module in Client Component
**What goes wrong:** Importing `ip-dashboard-queries.ts` in a "use client" component causes a bundler error because it transitively imports `@everyskill/db`
**Why it happens:** The queries module uses `db` from the database package which is server-only
**How to avoid:** Types can be imported (TypeScript-only, erased at runtime). Constants must be inlined in client components. The `ip-risk-section.tsx` already demonstrates this pattern with `HIGH_USAGE_THRESHOLD` and `CRITICAL_USAGE_THRESHOLD`.
**Warning signs:** "Module not found: Can't resolve '@everyskill/db'" in build output

### Pitfall 3: jsPDF Bundle Size in Next.js
**What goes wrong:** jsPDF (~400KB minified) gets included in the main page bundle, slowing initial page load
**Why it happens:** Static import at module scope includes jsPDF in the page chunk even if export is never clicked
**How to avoid:** Use `dynamic import` — `const { default: jsPDF } = await import("jspdf")` inside the click handler. Same for autotable.
**Warning signs:** Next.js build output shows ip-dashboard page bundle > 300KB

### Pitfall 4: Skills with NULL average_rating
**What goes wrong:** The quality multiplier becomes NaN, making replacement cost NaN
**Why it happens:** Many skills have never been rated; `average_rating` is nullable in the schema
**How to avoid:** Default null rating to a middle-ground value: `const qualityScore = (averageRating ?? 300) / 500` (300/500 = 0.6, reasonable default)
**Warning signs:** "$NaN" appearing in the valuation table or total

### Pitfall 5: Content Length Query on Large Tables
**What goes wrong:** Computing `LENGTH(content)` for all skills in SQL might be slow if content is large
**Why it happens:** The `content` column stores full markdown skill content, which can be multiple KB
**How to avoid:** This is fine for the expected scale (<10K skills per tenant). `LENGTH()` on text columns in PostgreSQL is O(1) — it reads the length from the varlena header, not the full content. No performance concern.
**Warning signs:** None expected at current scale

### Pitfall 6: PDF File Size with Many Skills
**What goes wrong:** A tenant with hundreds of skills produces a very large PDF
**Why it happens:** autoTable creates one row per skill; hundreds of rows = many pages
**How to avoid:** Show "Top 20 Skills by Value" in the PDF summary section. Include all skills in the CSV export (which handles large datasets better). The PDF is for board presentations — executives want highlights, not raw data.
**Warning signs:** PDF > 5MB or > 20 pages

## Code Examples

### SQL Query: Skill Valuation Data
```sql
-- Source: Extension of existing ip-dashboard-queries.ts pattern
SELECT
  s.id AS skill_id,
  s.name,
  s.slug,
  s.category,
  s.total_uses,
  COALESCE(s.hours_saved, 1) AS hours_saved,
  LENGTH(s.content) AS content_length,
  s.average_rating,
  u.name AS author_name,
  u.email AS author_email,
  -- Risk level (reuse existing logic)
  CASE
    WHEN s.total_uses >= 50 AND NOT EXISTS (
      SELECT 1 FROM skills fork WHERE fork.forked_from_id = s.id AND fork.status = 'published' AND fork.tenant_id = s.tenant_id
    ) AND (SELECT COUNT(DISTINCT author_id) FROM skills WHERE id = s.id) = 1
    THEN 'critical'
    WHEN s.total_uses >= 10 AND NOT EXISTS (
      SELECT 1 FROM skills fork WHERE fork.forked_from_id = s.id AND fork.status = 'published' AND fork.tenant_id = s.tenant_id
    )
    THEN 'high'
    ELSE NULL
  END AS risk_level
FROM skills s
LEFT JOIN users u ON u.id = s.author_id
WHERE s.tenant_id = $1
  AND s.status = 'published'
ORDER BY s.total_uses DESC
```

### TypeScript: Replacement Cost Calculation
```typescript
// Source: Custom formula based on available schema fields
export const HOURLY_RATE = 150; // Knowledge worker hourly rate

export interface SkillValuation {
  skillId: string;
  name: string;
  slug: string;
  category: string;
  authorName: string | null;
  authorEmail: string;
  totalUses: number;
  hoursSaved: number;
  contentLength: number;
  averageRating: number | null; // rating * 100 stored value
  riskLevel: "critical" | "high" | null;
  replacementCost: number;  // computed client-side
}

export function calculateReplacementCost(
  totalUses: number,
  hoursSaved: number,
  contentLength: number,
  averageRating: number | null,
): number {
  // Base: total economic value delivered
  const baseValue = hoursSaved * totalUses * HOURLY_RATE;

  // Complexity: log-scale content length, clamped [1.0, 2.0]
  const rawComplexity = 1 + Math.log10(Math.max(contentLength, 1000) / 1000);
  const complexityMultiplier = Math.min(Math.max(rawComplexity, 1.0), 2.0);

  // Quality: normalized rating, default 0.6 for unrated
  const qualityNormalized = averageRating != null ? averageRating / 500 : 0.6;
  const qualityMultiplier = 0.5 + (Math.min(qualityNormalized, 1.0) * 0.5);

  return Math.round(baseValue * complexityMultiplier * qualityMultiplier);
}
```

### Client-Side PDF Generation with Dynamic Import
```typescript
// Source: jsPDF docs + existing blob download pattern
async function generatePdfReport(data: IpReportData): Promise<void> {
  // Dynamic import to avoid bundle bloat
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.text("IP Report — EverySkill", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(128);
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, 14, 27);
  doc.setTextColor(0);

  // Executive Summary
  doc.setFontSize(14);
  doc.text("Executive Summary", 14, 40);
  doc.setFontSize(11);
  doc.text(`Total Estimated IP Value: $${formatCurrency(data.totalValue)}`, 14, 48);
  doc.text(`Skills Captured: ${data.stats.totalSkillsCaptured}`, 14, 55);
  doc.text(`Total Uses: ${formatNumber(data.stats.totalUses)}`, 14, 62);
  doc.text(`Hours Saved: ${data.stats.totalHoursSaved.toFixed(1)}`, 14, 69);
  doc.text(`Active Contributors: ${data.stats.activeContributors}`, 14, 76);

  // Top Skills by Value table
  doc.setFontSize(14);
  doc.text("Top Skills by Estimated Value", 14, 90);

  autoTable(doc, {
    startY: 95,
    head: [["Skill", "Author", "Uses", "Hrs Saved", "Est. Value", "Risk"]],
    body: data.topSkills.map(s => [
      s.name,
      s.authorName ?? "Unknown",
      String(s.totalUses),
      String(s.hoursSaved * s.totalUses),
      `$${formatCurrency(s.replacementCost)}`,
      s.riskLevel ?? "—",
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [11, 22, 36] },
  });

  // Risk section, contributor highlights follow same pattern...

  const blob = doc.output("blob");
  downloadBlob(blob, `ip-report-${new Date().toISOString().split("T")[0]}.pdf`);
}
```

### CSV Export for IP Data
```typescript
// Source: Existing csv-export-button.tsx pattern
function generateIpCsv(skills: SkillValuation[]): string {
  const headers = [
    "Skill Name", "Author", "Category", "Total Uses",
    "Hours Saved/Use", "Total Hours Saved", "Replacement Cost",
    "Risk Level", "Average Rating",
  ];

  const rows = skills.map(s => [
    escapeCSV(s.name),
    escapeCSV(s.authorName ?? "Unknown"),
    escapeCSV(s.category),
    String(s.totalUses),
    String(s.hoursSaved),
    String(s.hoursSaved * s.totalUses),
    s.replacementCost.toFixed(2),
    s.riskLevel ?? "none",
    s.averageRating != null ? (s.averageRating / 100).toFixed(2) : "",
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF via Puppeteer | Client-side jsPDF with dynamic import | 2024-2025 | No server dependency, smaller footprint |
| @react-pdf/renderer SSR | jsPDF for structured reports | Next.js 13+ era | Avoids SSR/hydration issues with react-pdf |
| toLocaleString for currency | Manual regex formatter | React 19 / Next 16 | Prevents hydration mismatches |

**Deprecated/outdated:**
- jsPDF v3.x: Superseded by v4.x with security fixes (CVE-2025-68428). Use ^4.1.0.
- jspdf-autotable v3.x: Superseded by v5.x with named import support. Use ^5.0.7.

## Open Questions

1. **Hourly rate configurability**
   - What we know: The formula uses a constant `HOURLY_RATE = $150/hr` as a knowledge worker baseline
   - What's unclear: Should this be tenant-configurable (admin settings) or hardcoded?
   - Recommendation: Hardcode for Phase 64 as a named constant. Add admin-configurable hourly rate in a future phase if requested. The constant is easy to change later.

2. **"Training examples count" in success criteria**
   - What we know: The success criteria mentions "training examples count" as a complexity input, but there is NO `training_examples` column in the skills or skill_versions schema
   - What's unclear: Whether this was aspirational or refers to some other field
   - Recommendation: Use `LENGTH(content)` as the sole complexity proxy. Content length correlates with instruction detail, examples embedded in the markdown, and domain specificity. This satisfies the spirit of the requirement. The `metadata` JSONB column on skill_versions could theoretically hold example counts, but querying it for every skill is complex and unreliable.

3. **PDF chart inclusion**
   - What we know: The success criteria says "quality trends" in the PDF report
   - What's unclear: Whether this means embedded chart images or tabular trend data
   - Recommendation: Include trend data as a table (month | avg rating | sentiment | benchmark) rather than attempting to render Recharts to canvas to image to PDF. This is simpler, more reliable, and more professional for board presentations. If chart images are later required, html2canvas can be explored as a follow-up.

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/web/lib/ip-dashboard-queries.ts` — existing query patterns, type definitions, SQL style
- Codebase: `apps/web/components/csv-export-button.tsx` — established blob download + server action pattern
- Codebase: `apps/web/components/ip-dashboard-view.tsx` — existing dashboard component structure
- Codebase: `packages/db/src/schema/skills.ts` — skills table columns (content, hours_saved, average_rating, total_uses)
- Codebase: `packages/db/src/schema/ratings.ts` — ratings schema confirming quality score availability

### Secondary (MEDIUM confidence)
- [jspdf-autotable npm](https://www.npmjs.com/package/jspdf-autotable) — v5.0.7, API for table generation
- [jsPDF npm](https://www.npmjs.com/package/jspdf) — v4.1.0, client-side PDF creation API
- [jsPDF AutoTable GitHub](https://github.com/simonbengtsson/jsPDF-AutoTable) — usage examples, configuration options

### Tertiary (LOW confidence)
- Web search results on Next.js PDF generation approaches — consensus around client-side jsPDF for structured reports

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — jsPDF + autotable are mature, widely used, no alternative needed
- Architecture: HIGH — follows existing codebase patterns exactly (server action + client blob download)
- Replacement cost formula: MEDIUM — formula is reasonable but the hourly rate and multiplier weights are somewhat arbitrary; however, the requirements say "estimated" which sets expectations appropriately
- Pitfalls: HIGH — identified from direct codebase experience (hydration, server-only imports, bundle size)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, unlikely to change)
