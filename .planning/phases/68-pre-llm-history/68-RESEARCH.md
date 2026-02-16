# Phase 68: Pre-LLM History - Research

**Researched:** 2026-02-16
**Domain:** File upload, metadata management, timeline integration, AI-powered skill suggestion
**Confidence:** HIGH

## Summary

Phase 68 adds the ability for users to upload historical work artifacts (documents, emails, templates, scripts) to their portfolio page, store them with metadata in a new `work_artifacts` table, display them on the impact timeline with a "Pre-platform" badge, and analyze their content to suggest relevant skills from the catalog.

The existing codebase provides strong foundations: the `@everyskill/storage` package with R2/S3 presigned URL support already exists (though R2 is not yet configured in any environment), the portfolio page and impact timeline are fully built (Phase 65-67), and the AI skill recommendation engine (`lib/skill-recommendations.ts`) already has the pattern for matching text to the skill catalog via Claude Haiku. The migration system, schema patterns, and server action patterns are all well-established.

**Primary recommendation:** Store artifact file content in the database as text (like skills do), not in R2, since R2 is not configured and the artifacts are primarily text-based documents. Use a client-side file parser (like the existing `skill-file-parser.ts`) to extract text content from uploaded files, then store metadata + extracted text in the `work_artifacts` table. The AI analysis can then operate on the extracted text content without needing object storage.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App framework, server actions, API routes | Already in use |
| Drizzle ORM | 0.42.0 | Schema definition, migrations, queries | Already in use |
| Zod | 3.25.x | Server action form validation | Already in use for all actions |
| Anthropic SDK | 0.72.1 | AI analysis of artifact content | Already in use for recommendations |
| Recharts | 3.7.0 | Timeline chart (ComposedChart) | Already rendering impact timeline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jszip | 3.10.1 | ZIP file extraction | Already available, needed if supporting ZIP uploads |
| crypto (Node built-in) | - | UUID generation for artifact IDs | Standard pattern across codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB text storage | R2 object storage | R2 is not configured in any env; text storage is simpler and matches current skill content pattern |
| Server action file upload | API route with multipart | Server actions support FormData with File objects in Next.js 16, but current codebase always parses files client-side and sends text data. Client-side parsing is simpler and avoids server-side file handling |
| Real-time AI analysis | Background job queue | No job queue exists in codebase; fire-and-forget async with Claude Haiku is the established pattern |

**No new packages needed.** All dependencies are already present.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
├── schema/work-artifacts.ts        # New table definition
├── migrations/0037_add_work_artifacts.sql  # Migration

apps/web/
├── app/actions/work-artifacts.ts   # Server actions (CRUD + AI analysis)
├── lib/artifact-parser.ts          # Client-side file content extraction
├── lib/portfolio-queries.ts        # Extended with artifact timeline query
├── components/portfolio-view.tsx   # Extended with artifact section + upload
├── components/artifact-upload-form.tsx  # New upload form component
├── components/artifact-list.tsx    # Display artifacts in portfolio
├── tests/e2e/portfolio.spec.ts     # Extended E2E tests
```

### Pattern 1: work_artifacts Schema Design
**What:** New table following established patterns (tenant_id, pgPolicy, text PK with UUID, timestamps)
**When to use:** This is the only new schema addition for Phase 68
**Example:**
```typescript
// Follow resume_shares, benchmark_runs pattern
export const workArtifacts = pgTable(
  "work_artifacts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(), // "document" | "email" | "template" | "script" | "other"
    artifactDate: timestamp("artifact_date").notNull(), // When the work was originally done
    fileType: text("file_type"), // Original file extension/MIME hint
    fileName: text("file_name"), // Original file name for display
    extractedText: text("extracted_text"), // Parsed text content for AI analysis
    suggestedSkillIds: text("suggested_skill_ids").array().default([]), // AI-suggested matching skills
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("work_artifacts_user_id_idx").on(table.userId),
    index("work_artifacts_tenant_id_idx").on(table.tenantId),
    index("work_artifacts_artifact_date_idx").on(table.artifactDate),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 2: Client-Side File Parsing (Established Pattern)
**What:** Parse files in the browser, send extracted text to server action via FormData
**When to use:** For all file uploads -- avoids server-side file handling complexity
**Example:**
```typescript
// Follow skill-file-drop-zone.tsx + skill-file-parser.ts pattern
// 1. User drops/selects file(s)
// 2. Client-side parser extracts text content
// 3. Text + metadata sent to server action via FormData
// 4. Server action validates with Zod and inserts into DB

// Supported file types: .txt, .md, .doc, .pdf (text extraction), .eml, .json
// For non-text files: store file name + metadata, extractedText = null
```

### Pattern 3: Timeline Integration with UNION ALL
**What:** Extend the existing getImpactTimeline query to include work_artifacts
**When to use:** To show historical artifacts alongside platform events
**Example:**
```sql
-- Add a 4th UNION ALL block to the existing timeline CTE:
UNION ALL

SELECT
  artifact_date AS event_date,
  'artifact' AS event_type,
  title AS skill_name,
  0::double precision AS hours_impact
FROM work_artifacts
WHERE user_id = $userId
```

### Pattern 4: Fire-and-Forget AI Analysis
**What:** After inserting artifact, analyze extracted text against skill catalog using Claude Haiku
**When to use:** Immediately after artifact creation, same pattern as autoGenerateReview
**Example:**
```typescript
// Follow the established fire-and-forget pattern from skills.ts
analyzeArtifactForSkills(artifactId, extractedText, tenantId).catch(() => {});

// Inside: use the same skill catalog fetch + Haiku call pattern
// as skill-recommendations.ts, but with artifact text instead of work context
```

### Anti-Patterns to Avoid
- **Server-side file upload handling:** The codebase has no precedent for receiving File objects in server actions. Keep files client-side, send extracted text.
- **R2 storage dependency:** R2 is not configured in any environment. Don't require it for this phase. Store extracted text in the DB column.
- **Complex file format parsing on server:** Don't try to parse .docx or .pdf on the server. Keep parsing client-side where libraries like the existing jszip already work. For formats that can't be parsed client-side (binary .doc files), accept metadata-only entries with null extractedText.
- **Blocking AI analysis:** Never block the upload response on AI analysis. Fire-and-forget pattern.
- **Mixing artifact data into the skills table:** Work artifacts are fundamentally different from skills (user-owned historical records vs. shared organizational tools). They need their own table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID scheme | crypto.randomUUID() | Standard across all tables |
| File text extraction | Server-side parser | Client-side parser (browser File API + jszip) | Established pattern in skill-file-parser.ts |
| AI matching to skills | Custom matching algorithm | Claude Haiku structured output + Zod validation | Established in skill-recommendations.ts |
| Form validation | Manual field checking | Zod schemas with safeParse | Every server action uses this |
| Date formatting | toLocaleDateString() | Manual UTC formatting with MONTHS array | Hydration mismatch prevention (established rule) |

**Key insight:** Every infrastructure pattern needed already exists in the codebase. The work is adapting existing patterns to the new work_artifacts domain, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Server Action File Size Limits
**What goes wrong:** Next.js server actions have a default 1MB body size limit for FormData
**Why it happens:** If sending file content as text through server action FormData, large files will be rejected
**How to avoid:** Set `serverActions.bodySizeLimit` in next.config.ts if needed, OR (better) limit artifact text content to a reasonable size (e.g., first 50KB of extracted text) since AI analysis doesn't need the full document
**Warning signs:** 413 errors or silent failures on larger uploads

### Pitfall 2: Hydration Mismatches with Dates
**What goes wrong:** Using toLocaleDateString() or toLocaleString() causes hydration errors
**Why it happens:** Node.js and browser Intl APIs return different strings
**How to avoid:** Use the established UTC manual formatting pattern: `MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear()`
**Warning signs:** React hydration mismatch warnings in console

### Pitfall 3: Timeline Query Performance with Large Artifact Counts
**What goes wrong:** UNION ALL with window function gets slow if user uploads hundreds of artifacts
**Why it happens:** Each UNION branch is scanned; window function runs over the entire combined result
**How to avoid:** Index on `work_artifacts(user_id, artifact_date)` and consider LIMIT on artifacts or only include recent N artifacts in timeline view
**Warning signs:** Slow portfolio page load times

### Pitfall 4: Re-exporting Types from "use server" Files
**What goes wrong:** Runtime bundler errors when importing types from server action files
**Why it happens:** "use server" files have special bundling rules in Next.js
**How to avoid:** Define shared types in a separate lib file, not in the action file. Import types using `import type` syntax
**Warning signs:** Build errors about unexpected server references

### Pitfall 5: AI Rate Limits on Batch Uploads
**What goes wrong:** User uploads 10 artifacts at once, all trigger Haiku calls, hitting rate limits
**Why it happens:** Fire-and-forget pattern doesn't coordinate concurrent requests
**How to avoid:** Process AI analysis sequentially or with a small concurrency limit. Add retry with backoff (existing pattern in skill-recommendations.ts)
**Warning signs:** 429 errors from Anthropic API

### Pitfall 6: Missing Tenant Scoping
**What goes wrong:** Artifacts visible across tenants
**Why it happens:** Forgetting tenant_id in queries or RLS policy
**How to avoid:** Follow established pattern: tenantId NOT NULL FK, pgPolicy for tenant_isolation. Every query includes tenant scope via app.current_tenant_id
**Warning signs:** Data leaking in multi-tenant test scenarios

## Code Examples

### Migration SQL (based on resume_shares pattern)
```sql
-- 0037_add_work_artifacts.sql
CREATE TABLE IF NOT EXISTS work_artifacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  artifact_date TIMESTAMP NOT NULL,
  file_type TEXT,
  file_name TEXT,
  extracted_text TEXT,
  suggested_skill_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX work_artifacts_user_id_idx ON work_artifacts(user_id);
CREATE INDEX work_artifacts_tenant_id_idx ON work_artifacts(tenant_id);
CREATE INDEX work_artifacts_artifact_date_idx ON work_artifacts(artifact_date);
```

### Server Action Pattern (based on resume-share.ts)
```typescript
"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const createArtifactSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["document", "email", "template", "script", "other"]),
  artifactDate: z.string().datetime(), // ISO date string
  fileName: z.string().max(500).optional(),
  fileType: z.string().max(100).optional(),
  extractedText: z.string().max(100000).optional(), // ~100KB text limit
});

export async function createWorkArtifact(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  const tenantId = session.user.tenantId;
  if (!tenantId) return { error: "Tenant not resolved" };
  if (!db) return { error: "Database not available" };

  const parsed = createArtifactSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    artifactDate: formData.get("artifactDate"),
    fileName: formData.get("fileName"),
    fileType: formData.get("fileType"),
    extractedText: formData.get("extractedText"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO work_artifacts (id, tenant_id, user_id, title, description, category, artifact_date, file_name, file_type, extracted_text)
    VALUES (${id}, ${tenantId}, ${session.user.id}, ${parsed.data.title}, ${parsed.data.description || null}, ${parsed.data.category}, ${parsed.data.artifactDate}, ${parsed.data.fileName || null}, ${parsed.data.fileType || null}, ${parsed.data.extractedText || null})
  `);

  // Fire-and-forget: AI analysis
  if (parsed.data.extractedText) {
    analyzeArtifactForSkills(id, parsed.data.extractedText, tenantId).catch(() => {});
  }

  return { success: true, id };
}
```

### Timeline Integration Query
```sql
-- Add to the existing getImpactTimeline UNION ALL CTE
UNION ALL

SELECT
  artifact_date AS event_date,
  'artifact' AS event_type,
  title AS skill_name,
  0::double precision AS hours_impact
FROM work_artifacts
WHERE user_id = ${userId}
```

### AI Artifact Analysis (based on skill-recommendations.ts pattern)
```typescript
async function analyzeArtifactForSkills(
  artifactId: string,
  extractedText: string,
  tenantId: string
): Promise<void> {
  // 1. Fetch all published skills (same as generateSkillRecommendations)
  // 2. Build prompt: "Given this historical work artifact, which skills match?"
  // 3. Call Claude Haiku with structured output
  // 4. Update work_artifacts.suggested_skill_ids with results
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side file processing | Client-side parsing + text extraction | Always (in this codebase) | Simpler, no server file handling |
| Direct DB file storage (BYTEA) | Extracted text in TEXT column | N/A (design decision) | Avoids binary storage, enables text search |
| Synchronous AI analysis | Fire-and-forget async | Established in v2.0+ | Non-blocking upload flow |

**Key design note:** The REQUIREMENTS.md explicitly states "Pre-LLM history auto-import from all sources" is deferred to v7.0. This phase covers manual upload only, which significantly simplifies the scope.

## Open Questions

1. **File size and count limits per user**
   - What we know: Existing skill file parser has 10MB limit. Skill content is stored as text in DB.
   - What's unclear: How many artifacts should a user be allowed to upload? What's the max text content size per artifact?
   - Recommendation: Start with 50 artifacts per user, 100KB extracted text per artifact. These can be adjusted later. The UI should enforce limits.

2. **Should artifacts have estimated hours_impact?**
   - What we know: The timeline currently tracks hours_impact per event. Artifacts use 0.
   - What's unclear: Should users be able to self-report estimated hours for pre-platform work?
   - Recommendation: Include an optional `estimated_hours_saved` field on work_artifacts. Default to 0 for timeline calculations but allow users to estimate. This enriches the portfolio without inflating platform metrics (since these are clearly "Pre-platform" badged).

3. **Supported file formats for text extraction**
   - What we know: Existing parser supports .md, .json, .zip. Browser-side text extraction from .pdf or .docx requires additional libraries.
   - What's unclear: How far to go with client-side file parsing? .txt and .md are trivial. .pdf and .docx require libraries.
   - Recommendation: Support .txt, .md, .json, and .eml (plain text email) for text extraction. For other formats (.pdf, .docx), accept the file metadata but set extractedText = null. AI analysis only runs when extractedText is available. This avoids adding heavy client-side PDF/DOCX parsing libraries. The user can paste text content manually for unsupported formats.

4. **Delete/edit functionality**
   - What we know: Users should be able to manage their artifacts.
   - What's unclear: How complex should the edit flow be?
   - Recommendation: Include delete action (simple) and basic edit (title, description, date, category). No re-upload of file content -- if they want different content, delete and re-upload.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/db/src/schema/resume-shares.ts` - Schema pattern with tenant_id, pgPolicy, UUID PK
- Codebase inspection: `packages/db/src/schema/benchmark-runs.ts` - Complex schema with multiple FK references and indexes
- Codebase inspection: `apps/web/app/actions/resume-share.ts` - Server action CRUD pattern
- Codebase inspection: `apps/web/app/actions/skills.ts` - File upload + AI analysis fire-and-forget pattern
- Codebase inspection: `apps/web/lib/skill-recommendations.ts` - AI matching against skill catalog
- Codebase inspection: `apps/web/lib/portfolio-queries.ts` - Timeline UNION ALL + window function pattern
- Codebase inspection: `apps/web/components/skill-file-drop-zone.tsx` - Client-side drag/drop file handling
- Codebase inspection: `apps/web/lib/skill-file-parser.ts` - Client-side file text extraction

### Secondary (MEDIUM confidence)
- Codebase inspection: `.env.staging`, `.env.production` - R2 env vars are empty (not configured)
- Codebase inspection: `packages/storage/` - R2 client exists but barely used (1 import in skills.ts)

### Tertiary (LOW confidence)
- Next.js 16 server actions body size limit: Default is 1MB. Needs verification if sending large text content through FormData. Configuration via `serverActions.bodySizeLimit` in next.config.ts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Every pattern has a direct codebase precedent
- Pitfalls: HIGH - Based on documented project rules and prior issues (hydration, rate limits, type re-exports)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- all patterns are internal codebase patterns, not external library APIs)
