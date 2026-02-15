# Phase 55: Schema Foundation & Data Sanitization - Research

**Researched:** 2026-02-15
**Domain:** Database schema design (Drizzle ORM + PostgreSQL), multi-tenant RLS, payload sanitization
**Confidence:** HIGH

## Summary

Phase 55 is a pure infrastructure phase that creates 4 new database tables, adds denormalized aggregate columns to the existing `skills` table, and builds a payload sanitization utility. Every pattern required already exists in the codebase and has been verified through direct file analysis. The new tables (`skill_feedback`, `token_measurements`, `benchmark_runs`, `benchmark_results`) follow the exact same Drizzle ORM schema definition pattern used by the existing 17+ tables. Multi-tenancy follows the established `tenant_id NOT NULL` + RLS policy pattern from Phase 25. The sanitization utility is the only genuinely new code -- a pure function with regex-based secret detection that has no external dependencies.

This phase has zero npm dependency additions, zero API integrations, and zero UI work. It is entirely schema files, SQL migrations, relation definitions, type exports, and one utility module with unit tests.

**Primary recommendation:** Follow the existing codebase patterns exactly. Every schema file, migration, relation definition, and service export has a direct template in the existing code. The planner should create one task per table (schema + migration + relations + exports), one task for the skills table aggregate columns, and one task for the sanitization utility with tests.

## Standard Stack

### Core (No Changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema definitions, pgPolicy, relations | Already installed, supports all needed features including `pgPolicy()` |
| postgres | 3.4.0 | PostgreSQL driver | Already installed, used by custom migration runner |
| zod | 3.25+ | Validation for sanitization utility | Already installed |

### Supporting (No Changes)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.19+ | Run migration scripts | Already installed as devDep in @everyskill/db |
| vitest | 3.2.4 | Unit tests for sanitization utility | Already installed in apps/web; can run sanitization tests there or add to packages/db |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex-based sanitization | npm `detect-secrets` or `trufflehog` | Adds external dependency for a ~50-line utility; regex patterns are well-known and sufficient |
| Hand-written SQL migrations | `drizzle-kit generate` | Project uses custom migration runner (`packages/db/src/migrate.ts`), not drizzle-kit migrations; hand-written SQL is the established pattern |
| JSONB for token data | Typed integer columns | Pitfall 9 in PITFALLS.md: JSONB aggregation is slow and unindexable; use dedicated typed columns |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended File Structure

```
packages/db/src/
├── schema/
│   ├── skill-feedback.ts           # NEW: skill_feedback table
│   ├── token-measurements.ts       # NEW: token_measurements table
│   ├── benchmark-runs.ts           # NEW: benchmark_runs + benchmark_results tables
│   ├── index.ts                    # MODIFY: add 3 new exports
│   └── skills.ts                   # MODIFY: add aggregate columns
├── relations/
│   └── index.ts                    # MODIFY: add relations for 4 new tables
├── migrations/
│   ├── 0030_create_skill_feedback.sql
│   ├── 0031_create_token_measurements.sql
│   ├── 0032_create_benchmark_tables.sql
│   └── 0033_add_feedback_aggregates_to_skills.sql
└── services/
    └── index.ts                    # No service changes in this phase (services come in later phases)

apps/web/lib/
└── sanitize-payload.ts             # NEW: secret detection utility
apps/web/lib/__tests__/
└── sanitize-payload.test.ts        # NEW: unit tests for sanitization
```

### Pattern 1: Schema Definition (Verified from Codebase)

**What:** Every table follows the same Drizzle ORM pattern: `pgTable()` with text ID primary key, `tenant_id` NOT NULL FK to `tenants`, column definitions, and a table config function returning indexes and RLS policy.

**When to use:** Every new table in this phase.

**Example (from `packages/db/src/schema/ratings.ts`):**
```typescript
import { pgTable, text, timestamp, integer, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";

export const ratings = pgTable(
  "ratings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("ratings_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
```

**Key observations verified from codebase:**
- Primary key: `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` -- NOT uuid, TEXT type with crypto.randomUUID
- Exception: `usage_events` uses `uuid("id").primaryKey().defaultRandom()` -- this is the only table using uuid type
- Tenant FK: `.references(() => tenants.id)` -- no cascade on tenant delete
- Skill FK: `.references(() => skills.id, { onDelete: "cascade" })` -- cascade deletes when skill is deleted
- User FK: `.references(() => users.id)` or `.references(() => users.id, { onDelete: "cascade" })` -- varies by table
- Timestamp: `timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow()` for most tables
- RLS policy: always named `"tenant_isolation"`, always `as: "restrictive"`, always `for: "all"`, always uses `current_setting('app.current_tenant_id', true)`
- Index: always `index("tablename_tenant_id_idx").on(table.tenantId)`
- Type exports: `typeof table.$inferSelect` and `typeof table.$inferInsert`

### Pattern 2: SQL Migration (Verified from Codebase)

**What:** Hand-written SQL files numbered sequentially in `packages/db/src/migrations/`. Run via custom runner `packages/db/src/migrate.ts`.

**When to use:** Every new table or column addition.

**Example (from `0029_add_email_diagnostics.sql`):**
```sql
-- Migration: Add email_diagnostics table
-- Date: 2026-02-14
-- Description: ...

CREATE TABLE IF NOT EXISTS email_diagnostics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS email_diagnostics_tenant_id_idx ON email_diagnostics(tenant_id);

-- Enable RLS
ALTER TABLE email_diagnostics ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation ON email_diagnostics
  AS RESTRICTIVE
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

**Key observations:**
- Migration numbering: next is `0030` (latest is `0029_add_email_diagnostics.sql`)
- File naming: `NNNN_descriptive_name.sql`
- Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency
- Uses `TIMESTAMPTZ` (not `TIMESTAMP`) and `TIMESTAMPTZ(3)` for precision-3 timestamps
- RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` followed by `CREATE POLICY tenant_isolation ON ...`
- Some migrations wrap policy creation in `DO $$ BEGIN IF NOT EXISTS ... END $$;` for idempotency (see `0015_create_review_decisions.sql`)
- Custom runner tracks in `_applied_migrations` table, NOT drizzle's journal
- Run via: `pnpm db:migrate` (which runs `tsx src/migrate.ts`)

### Pattern 3: Relations Definition (Verified from Codebase)

**What:** All Drizzle relations defined in `packages/db/src/relations/index.ts`. Each table gets a `*Relations` export using `relations()` function.

**When to use:** Every new table that has foreign keys.

**Example:**
```typescript
import { relations } from "drizzle-orm";
import { skillFeedback, tokenMeasurements, benchmarkRuns, benchmarkResults } from "../schema";

export const skillFeedbackRelations = relations(skillFeedback, ({ one }) => ({
  tenant: one(tenants, { fields: [skillFeedback.tenantId], references: [tenants.id] }),
  skill: one(skills, { fields: [skillFeedback.skillId], references: [skills.id] }),
  user: one(users, { fields: [skillFeedback.userId], references: [users.id] }),
}));
```

**Key observations:**
- All relations in a single file (`index.ts`), not co-located with schema files
- Relations imports from `../schema` (the barrel export)
- Both `one()` and `many()` used as needed
- Existing `skillsRelations` needs `many(skillFeedback)`, `many(tokenMeasurements)`, `many(benchmarkRuns)` added

### Pattern 4: Schema Barrel Export (Verified from Codebase)

**What:** `packages/db/src/schema/index.ts` re-exports all schema files with `export * from "./filename"`.

**Example:**
```typescript
export * from "./skill-feedback";
export * from "./token-measurements";
export * from "./benchmark-runs";
```

### Pattern 5: Denormalized Aggregate Columns (Verified from Codebase)

**What:** Add columns to existing `skills` table for O(1) dashboard reads, following the pattern of `totalUses` and `averageRating`.

**Example update pattern (from `packages/db/src/services/skill-metrics.ts`):**
```typescript
export async function incrementSkillUses(skillId: string): Promise<void> {
  await db
    .update(skills)
    .set({
      totalUses: sql`COALESCE(${skills.totalUses}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, skillId));
}
```

**Existing aggregates on skills table:**
- `totalUses: integer("total_uses").notNull().default(0)` -- incremented by `incrementSkillUses()`
- `averageRating: integer("average_rating")` -- recalculated by `updateSkillRating()`

**New aggregates to add (following same pattern):**
- `totalFeedback: integer("total_feedback").notNull().default(0)`
- `positiveFeedbackPct: integer("positive_feedback_pct")` -- 0-100, nullable like averageRating
- `avgTokenCostMicrocents: integer("avg_token_cost_microcents")` -- nullable

### Anti-Patterns to Avoid

- **JSONB for structured queryable data:** Do not store token counts, costs, or scores in JSONB columns. Use typed integer columns. (Pitfall 9 in PITFALLS.md)
- **UUID type for primary keys:** The codebase uses `text("id")` with `crypto.randomUUID()`, NOT `uuid()`. Only `usage_events` uses uuid; all other tables use text. New tables should use text.
- **drizzle-kit generate for migrations:** The project uses a custom migration runner. Do not use `drizzle-kit generate` or `drizzle-kit push` for new tables.
- **Separate tables per feedback type:** Use single `skill_feedback` table with `feedbackType` discriminator, not separate `skill_suggestions`, `skill_bug_reports`, `skill_training_examples` tables.
- **Missing RLS policy in migration:** Every new table MUST have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and a `CREATE POLICY tenant_isolation` in the migration SQL.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom UUID function | `crypto.randomUUID()` via `$defaultFn` | Built into Node.js 22+, already used by all tables |
| Secret detection patterns | Custom pattern discovery | Well-known regex patterns from detect-secrets | Secret patterns (AWS keys, API tokens, passwords) are standardized |
| Migration tracking | Drizzle-kit journal | Existing custom `migrate.ts` runner | Project already has a custom runner; don't mix two tracking systems |
| RLS policy syntax | Manual SQL experiments | Copy exact syntax from any existing migration | Same policy on every table, verified working |

**Key insight:** This phase is 95% copying established patterns. The only genuinely new code is the sanitization utility (~50 lines of regex).

## Common Pitfalls

### Pitfall 1: RLS Policy Name Conflicts

**What goes wrong:** PostgreSQL requires policy names to be unique per table. If you accidentally create a policy that already exists (e.g., from a drizzle-kit push that created the table earlier), the migration fails.

**Why it happens:** The `pgPolicy()` in the Drizzle schema definition creates the policy when using `drizzle-kit push`, but the custom migration runner also creates it in SQL. If someone ran `push` before `migrate`, the policy exists.

**How to avoid:** Use the `DO $$ BEGIN IF NOT EXISTS ... END $$;` wrapper around `CREATE POLICY` in the migration SQL, as seen in `0015_create_review_decisions.sql`. Or use `CREATE POLICY IF NOT EXISTS` (PostgreSQL 15+ supports this).

**Warning signs:** Migration fails with `ERROR: policy "tenant_isolation" for table "..." already exists`.

### Pitfall 2: Missing Schema Import in Relations File

**What goes wrong:** Adding new tables to `packages/db/src/schema/index.ts` but forgetting to import them in `packages/db/src/relations/index.ts`. Drizzle queries that use `with:` (relation queries) fail silently or throw runtime errors.

**Why it happens:** The schema barrel export and relations file are separate files that must stay in sync.

**How to avoid:** After adding a new schema file: (1) add `export * from "./new-file"` to `schema/index.ts`, (2) import the table in `relations/index.ts`, (3) define relations, (4) update existing tables' relations (e.g., add `many(skillFeedback)` to `skillsRelations`).

**Warning signs:** TypeScript compiles fine, but runtime query with `with: { skillFeedback: true }` returns undefined.

### Pitfall 3: Forgetting to Add tenant_id Index

**What goes wrong:** New tables have `tenant_id NOT NULL` and RLS policies, but no index on `tenant_id`. Every RLS check becomes a sequential scan on tenant_id.

**Why it happens:** The RLS policy references `tenant_id` but PostgreSQL doesn't automatically create an index for it.

**How to avoid:** Every new table must have `CREATE INDEX IF NOT EXISTS tablename_tenant_id_idx ON tablename(tenant_id)` in the migration.

### Pitfall 4: Timestamp Precision Mismatch

**What goes wrong:** Some tables use `TIMESTAMPTZ` (precision 6) and others use `TIMESTAMPTZ(3)` (precision 3). The Drizzle schema uses `{ withTimezone: true, precision: 3 }` for most tables.

**Why it happens:** The `defaultNow()` without precision specification vs with precision specification creates different column types. Early migrations used `DEFAULT NOW()` and later ones used `DEFAULT NOW()` with `TIMESTAMPTZ(3)`.

**How to avoid:** Use `TIMESTAMPTZ(3)` in migration SQL and `timestamp(..., { withTimezone: true, precision: 3 })` in Drizzle schema consistently for all new tables. This matches the majority of existing tables (ratings, skill_versions, review_decisions, etc.).

### Pitfall 5: Sanitization Regex Too Aggressive or Too Lenient

**What goes wrong:** Overly aggressive regex strips legitimate content (e.g., "my password policy document" gets "[REDACTED] policy document"). Too lenient regex misses real secrets.

**Why it happens:** Secret patterns overlap with legitimate text. A regex for "password=..." might match markdown documentation.

**How to avoid:** Pattern matching should require assignment context: `key=value`, `"key": "value"`, or known prefixes (`sk-`, `AKIA`, `ghp_`, `Bearer `). Test with both positive cases (real secrets) and negative cases (legitimate text containing "password" or "token" as words). Keep the 1000-char snippet limit from the existing `/api/track` endpoint -- this already limits exposure.

**Warning signs:** Unit tests passing with too few test cases. Need both true positive and true negative tests.

## Code Examples

### Example 1: Complete Schema File for skill_feedback

Adapted from the ARCHITECTURE.md specification and verified against existing codebase patterns:

```typescript
// packages/db/src/schema/skill-feedback.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { users } from "./users";
import { tenants } from "./tenants";
import { skillVersions } from "./skill-versions";

export const skillFeedback = pgTable(
  "skill_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    skillVersionId: text("skill_version_id").references(() => skillVersions.id),
    userId: text("user_id").references(() => users.id),
    usageEventId: text("usage_event_id"), // links to usage_events.id (no FK due to uuid vs text)

    feedbackType: text("feedback_type").notNull(),
    // "thumbs_up" | "thumbs_down" | "suggestion" | "training_example" | "bug_report"

    sentiment: integer("sentiment"), // -1, 0, 1
    comment: text("comment"),

    // Suggestion-specific
    suggestedContent: text("suggested_content"),
    suggestedDiff: text("suggested_diff"),

    // Training example
    exampleInput: text("example_input"),
    exampleOutput: text("example_output"),
    expectedOutput: text("expected_output"),

    qualityScore: integer("quality_score"), // 1-10

    // Moderation
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    source: text("source").notNull().default("web"), // "web" | "mcp" | "api"

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("skill_feedback_skill_id_idx").on(table.skillId),
    index("skill_feedback_user_id_idx").on(table.userId),
    index("skill_feedback_tenant_id_idx").on(table.tenantId),
    index("skill_feedback_type_idx").on(table.feedbackType),
    index("skill_feedback_status_idx").on(table.status),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillFeedback = typeof skillFeedback.$inferSelect;
export type NewSkillFeedback = typeof skillFeedback.$inferInsert;
```

### Example 2: Migration SQL for skill_feedback

```sql
-- Migration: Create skill_feedback table
-- Date: 2026-02-15
-- Description: Unified feedback table with feedbackType discriminator for votes, suggestions, training examples

CREATE TABLE IF NOT EXISTS skill_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  skill_version_id TEXT REFERENCES skill_versions(id),
  user_id TEXT REFERENCES users(id),
  usage_event_id TEXT,

  feedback_type TEXT NOT NULL,
  sentiment INTEGER,
  comment TEXT,

  suggested_content TEXT,
  suggested_diff TEXT,

  example_input TEXT,
  example_output TEXT,
  expected_output TEXT,

  quality_score INTEGER,

  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  source TEXT NOT NULL DEFAULT 'web',

  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS skill_feedback_skill_id_idx ON skill_feedback(skill_id);
CREATE INDEX IF NOT EXISTS skill_feedback_user_id_idx ON skill_feedback(user_id);
CREATE INDEX IF NOT EXISTS skill_feedback_tenant_id_idx ON skill_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS skill_feedback_type_idx ON skill_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS skill_feedback_status_idx ON skill_feedback(status);

-- Enable RLS
ALTER TABLE skill_feedback ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'skill_feedback' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON skill_feedback
      AS RESTRICTIVE
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END
$$;
```

### Example 3: Sanitization Utility

```typescript
// apps/web/lib/sanitize-payload.ts

/**
 * Secret patterns to detect and strip from feedback/tracking payloads.
 * Each pattern matches a known secret format in assignment context.
 */
const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  // AWS Access Keys (always start with AKIA)
  { name: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/g },
  // AWS Secret Keys (40 chars of base64-like)
  { name: "aws_secret_key", pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi },
  // GitHub tokens (classic and fine-grained)
  { name: "github_token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  // Anthropic API keys
  { name: "anthropic_key", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  // OpenAI API keys
  { name: "openai_key", pattern: /sk-[A-Za-z0-9]{20,}/g },
  // Generic Bearer tokens
  { name: "bearer_token", pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g },
  // Generic API key assignments (key=value or "key": "value")
  { name: "generic_api_key", pattern: /(?:api[_-]?key|apikey|api[_-]?secret|auth[_-]?token|access[_-]?token)\s*[=:]\s*["']?[A-Za-z0-9_\-.]{16,}["']?/gi },
  // Password assignments
  { name: "password_assignment", pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi },
  // Private keys (PEM format)
  { name: "private_key", pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g },
  // Connection strings with credentials
  { name: "connection_string", pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi },
  // Base64 strings longer than 100 chars (potential encoded secrets)
  { name: "long_base64", pattern: /[A-Za-z0-9+/]{100,}={0,2}/g },
];

export interface SanitizeResult {
  sanitized: string;
  secretsFound: string[]; // names of patterns matched
}

/**
 * Detect and strip secrets from a text payload.
 * Returns sanitized text and list of secret types found.
 */
export function sanitizePayload(input: string): SanitizeResult {
  const secretsFound: string[] = [];
  let sanitized = input;

  for (const { name, pattern } of SECRET_PATTERNS) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      secretsFound.push(name);
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
  }

  return { sanitized, secretsFound };
}

/**
 * Sanitize an object's string values recursively.
 * Useful for sanitizing entire metadata objects.
 */
export function sanitizeObject(
  obj: Record<string, unknown>
): { sanitized: Record<string, unknown>; secretsFound: string[] } {
  const allSecretsFound: string[] = [];

  function sanitizeValue(value: unknown): unknown {
    if (typeof value === "string") {
      const result = sanitizePayload(value);
      allSecretsFound.push(...result.secretsFound);
      return result.sanitized;
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        sanitized[k] = sanitizeValue(v);
      }
      return sanitized;
    }
    return value;
  }

  const sanitized = sanitizeValue(obj) as Record<string, unknown>;
  return { sanitized, secretsFound: [...new Set(allSecretsFound)] };
}
```

### Example 4: Denormalized Aggregate Column Migration

```sql
-- Migration: Add feedback and benchmark aggregate columns to skills
-- Date: 2026-02-15
-- Description: Denormalized aggregates for dashboard performance

ALTER TABLE skills ADD COLUMN IF NOT EXISTS total_feedback INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS positive_feedback_pct INTEGER;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS avg_token_cost_microcents INTEGER;
```

### Example 5: Relations Update

```typescript
// Add to existing skillsRelations in packages/db/src/relations/index.ts
export const skillsRelations = relations(skills, ({ one, many }) => ({
  // ... existing relations ...
  feedback: many(skillFeedback),
  tokenMeasurements: many(tokenMeasurements),
  benchmarkRuns: many(benchmarkRuns),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| drizzle-kit generate + push | Hand-written SQL + custom migrate.ts | Phase 25 (multi-tenancy) | Custom runner needed for RLS policy DDL that drizzle-kit couldn't express |
| Global unique constraints | Composite unique with tenant_id | Phase 25 (migration 0005) | All new unique constraints must include tenant_id |
| UUID primary keys | Text primary keys with crypto.randomUUID() | Phase 4 (data model) | Only usage_events uses uuid; all other tables use text |

**Deprecated/outdated:**
- `drizzle-kit push` for schema changes: Don't use for tables that need RLS policies. The custom migration runner is the authoritative path.
- JSONB for structured data: For new tables with known schemas, use typed columns. JSONB only for truly dynamic metadata.

## Open Questions

1. **usageEventId FK on skill_feedback: text vs uuid mismatch**
   - What we know: `skill_feedback.usageEventId` is `text("usage_event_id")` but `usage_events.id` is `uuid("id")`. These types are incompatible for a direct FK constraint in PostgreSQL.
   - What's unclear: Whether to add a FK constraint at all, or leave it as an application-level reference.
   - Recommendation: Leave as text without FK constraint, matching the pattern in ARCHITECTURE.md. PostgreSQL can compare uuid and text in queries with an explicit cast. A comment in the schema file is sufficient. This is a minor inconvenience that avoids a type system mismatch.

2. **benchmark_results.benchmarkRunId cascade vs benchmark_results.tenantId redundancy**
   - What we know: `benchmark_results` has both `tenantId` (for RLS) and `benchmarkRunId` FK with cascade delete. Since runs already have `tenantId`, results inherit tenant scope via the FK.
   - What's unclear: Is `tenantId` on results redundant?
   - Recommendation: Keep `tenantId` on results. RLS policies operate per-table and cannot follow FK chains. Every table needs its own `tenantId` for the policy to work. This is the established pattern.

3. **Sanitization utility location: packages/db vs apps/web**
   - What we know: The sanitization utility is a pure function with no database dependencies. It logically belongs wherever payload processing happens (apps/web for the API route, apps/mcp for MCP feedback).
   - What's unclear: Best location for sharing between apps.
   - Recommendation: Place in `apps/web/lib/sanitize-payload.ts` since that's where `/api/track` and `/api/feedback` routes live. Vitest is already configured in apps/web for unit tests. If apps/mcp needs it later, extract to a shared package.

## Detailed Table Specifications

### skill_feedback Table

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-------|-------|
| id | TEXT | NO | crypto.randomUUID() | PK | |
| tenant_id | TEXT | NO | - | tenants(id) | |
| skill_id | TEXT | NO | - | skills(id) CASCADE | |
| skill_version_id | TEXT | YES | - | skill_versions(id) | Pin feedback to specific version |
| user_id | TEXT | YES | - | users(id) | Nullable for anonymous MCP feedback |
| usage_event_id | TEXT | YES | - | (no FK, uuid/text mismatch) | Links to specific tool use |
| feedback_type | TEXT | NO | - | - | "thumbs_up" / "thumbs_down" / "suggestion" / "training_example" / "bug_report" |
| sentiment | INTEGER | YES | - | - | -1, 0, 1 |
| comment | TEXT | YES | - | - | Free text |
| suggested_content | TEXT | YES | - | - | For suggestions |
| suggested_diff | TEXT | YES | - | - | For suggestion review |
| example_input | TEXT | YES | - | - | Training example input |
| example_output | TEXT | YES | - | - | Training example actual output |
| expected_output | TEXT | YES | - | - | Training example desired output |
| quality_score | INTEGER | YES | - | - | 1-10 |
| status | TEXT | NO | 'pending' | - | "pending" / "approved" / "rejected" / "merged" |
| reviewed_by | TEXT | YES | - | users(id) | |
| reviewed_at | TIMESTAMPTZ | YES | - | - | |
| review_notes | TEXT | YES | - | - | |
| source | TEXT | NO | 'web' | - | "web" / "mcp" / "api" |
| created_at | TIMESTAMPTZ(3) | NO | NOW() | - | |

**Indexes:** skill_id, user_id, tenant_id, feedback_type, status

### token_measurements Table

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-------|-------|
| id | TEXT | NO | crypto.randomUUID() | PK | |
| tenant_id | TEXT | NO | - | tenants(id) | |
| skill_id | TEXT | NO | - | skills(id) CASCADE | |
| usage_event_id | TEXT | YES | - | (no FK) | |
| user_id | TEXT | YES | - | users(id) | |
| input_tokens | INTEGER | YES | - | - | |
| output_tokens | INTEGER | YES | - | - | |
| total_tokens | INTEGER | YES | - | - | |
| model_name | TEXT | NO | - | - | e.g., "claude-opus-4-6" |
| model_provider | TEXT | NO | 'anthropic' | - | "anthropic" / "openai" / "google" |
| estimated_cost_microcents | INTEGER | YES | - | - | $0.01 = 1000 microcents |
| latency_ms | INTEGER | YES | - | - | Round-trip in ms |
| source | TEXT | NO | 'hook' | - | "hook" / "benchmark" / "manual" |
| created_at | TIMESTAMPTZ(3) | NO | NOW() | - | |

**Indexes:** skill_id, model_name, tenant_id, created_at

### benchmark_runs Table

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-------|-------|
| id | TEXT | NO | crypto.randomUUID() | PK | |
| tenant_id | TEXT | NO | - | tenants(id) | |
| skill_id | TEXT | NO | - | skills(id) CASCADE | |
| skill_version_id | TEXT | YES | - | skill_versions(id) | |
| triggered_by | TEXT | NO | - | users(id) | |
| status | TEXT | NO | 'pending' | - | "pending" / "running" / "completed" / "failed" |
| models | TEXT[] | NO | - | - | Array of model names tested |
| best_model | TEXT | YES | - | - | Denormalized aggregate |
| best_quality_score | INTEGER | YES | - | - | 0-100 |
| cheapest_model | TEXT | YES | - | - | |
| cheapest_cost_microcents | INTEGER | YES | - | - | |
| started_at | TIMESTAMPTZ | YES | - | - | |
| completed_at | TIMESTAMPTZ | YES | - | - | |
| created_at | TIMESTAMPTZ(3) | NO | NOW() | - | |

**Indexes:** skill_id, tenant_id, status

### benchmark_results Table

| Column | Type | Nullable | Default | FK | Notes |
|--------|------|----------|---------|-------|-------|
| id | TEXT | NO | crypto.randomUUID() | PK | |
| tenant_id | TEXT | NO | - | tenants(id) | |
| benchmark_run_id | TEXT | NO | - | benchmark_runs(id) CASCADE | |
| model_name | TEXT | NO | - | - | |
| model_provider | TEXT | NO | - | - | |
| test_case_index | INTEGER | NO | - | - | 0-based |
| input_used | TEXT | YES | - | - | |
| output_produced | TEXT | YES | - | - | |
| expected_output | TEXT | YES | - | - | |
| input_tokens | INTEGER | YES | - | - | |
| output_tokens | INTEGER | YES | - | - | |
| total_tokens | INTEGER | YES | - | - | |
| latency_ms | INTEGER | YES | - | - | |
| estimated_cost_microcents | INTEGER | YES | - | - | |
| quality_score | INTEGER | YES | - | - | 0-100 |
| quality_notes | TEXT | YES | - | - | |
| matches_expected | BOOLEAN | YES | - | - | |
| error_message | TEXT | YES | - | - | |
| created_at | TIMESTAMPTZ(3) | NO | NOW() | - | |

**Indexes:** benchmark_run_id, model_name, tenant_id

## Implementation Checklist for Planner

Each task should verify:

1. **Schema file** created in `packages/db/src/schema/` with correct imports, column types, indexes, and `pgPolicy`
2. **Type exports** (`$inferSelect` and `$inferInsert`) at bottom of schema file
3. **Schema barrel export** updated in `packages/db/src/schema/index.ts`
4. **Relations** defined in `packages/db/src/relations/index.ts` (both new table's relations AND updates to existing tables' relations)
5. **Migration SQL file** in `packages/db/src/migrations/` with correct numbering, `CREATE TABLE IF NOT EXISTS`, all indexes, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`
6. **Migration runs successfully** via `pnpm db:migrate`
7. **TypeScript compiles** via `pnpm typecheck`

For the sanitization utility:
1. **Utility function** in `apps/web/lib/sanitize-payload.ts`
2. **Unit tests** in `apps/web/lib/__tests__/sanitize-payload.test.ts` covering:
   - Each secret pattern type (AWS, GitHub, Anthropic, OpenAI, Bearer, generic, password, PEM, connection string)
   - False positive tests (legitimate text not matching)
   - Object sanitization (nested objects with mixed secret/safe values)
   - Empty input, null-like values
3. **Tests pass** via `cd apps/web && npx vitest run`

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/ratings.ts` -- template for new table schema pattern
- `packages/db/src/schema/skills.ts` -- existing denormalized aggregate columns
- `packages/db/src/schema/review-decisions.ts` -- cascade delete + insert-only pattern
- `packages/db/src/schema/usage-events.ts` -- uuid vs text PK distinction
- `packages/db/src/schema/index.ts` -- barrel export pattern
- `packages/db/src/relations/index.ts` -- complete relations definitions
- `packages/db/src/services/skill-metrics.ts` -- aggregate update pattern
- `packages/db/src/services/usage-tracking.ts` -- fire-and-forget service pattern
- `packages/db/src/services/index.ts` -- service barrel exports
- `packages/db/src/client.ts` -- DEFAULT_TENANT_ID, connection setup
- `packages/db/src/migrate.ts` -- custom migration runner
- `packages/db/src/migrations/0029_add_email_diagnostics.sql` -- latest migration, template for new create-table migrations
- `packages/db/src/migrations/0015_create_review_decisions.sql` -- idempotent RLS policy creation pattern
- `packages/db/src/migrations/0005_enforce_tenant_id.sql` -- comprehensive RLS setup reference
- `.planning/research/ARCHITECTURE.md` -- full table specifications from v5.0 research
- `.planning/research/PITFALLS.md` -- Pitfall 1 (secret leakage) and Pitfall 9 (JSONB vs structured)
- `.planning/research/STACK.md` -- no new dependencies needed
- `apps/web/vitest.config.ts` -- unit test configuration
- `apps/web/lib/__tests__/quality-score.test.ts` -- existing unit test pattern

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` -- phase ordering and dependency analysis
- `.planning/REQUIREMENTS.md` -- SCHEMA-01 through SCHEMA-07 requirements

### Tertiary (LOW confidence)
- None -- all findings derived from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns verified from existing code
- Architecture: HIGH -- every table definition, migration, and relation follows established templates
- Pitfalls: HIGH -- all pitfalls identified from real codebase patterns (RLS naming, type mismatches, missing indexes)

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- stable domain, no external dependency changes)
