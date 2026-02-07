# Phase 15: Embeddings Foundation - Research

**Researched:** 2026-02-02
**Domain:** Vector embeddings with pgvector and Voyage AI
**Confidence:** HIGH

## Summary

This phase implements vector embedding infrastructure for semantic skill search and similarity matching. The established stack is Voyage AI's voyage-code-3 model for embedding generation combined with PostgreSQL's pgvector extension for storage and similarity queries, accessed via Drizzle ORM's native vector support.

The research confirms all locked decisions from CONTEXT.md are well-supported: voyage-code-3 offers 32K token context (sufficient for full skill content), Drizzle ORM has native vector column support, and pgvector's HNSW indexing provides efficient similarity search. The recommended architecture uses a separate `skill_embeddings` table to support model versioning (a locked decision), with automatic embedding generation in the skill creation server action.

**Primary recommendation:** Use Drizzle ORM's native `vector()` type with 1024 dimensions (voyage-code-3's default), HNSW indexing with cosine distance, and the official `voyageai` TypeScript SDK.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgvector | 0.8+ | PostgreSQL vector extension | Industry standard for vector storage in Postgres; supports HNSW/IVFFlat indexes |
| voyageai | 0.1.0 | Voyage AI TypeScript SDK | Official SDK with retry handling, TypeScript types, batch support |
| drizzle-orm | 0.38+ | Database ORM | Native `vector()` type support, distance function helpers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector (npm) | latest | Vector conversion utilities | Converting arrays to SQL vector format |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| voyage-code-3 | OpenAI text-embedding-3 | voyage-code-3 outperforms by 13.8% on code retrieval; locked decision |
| pgvector | Pinecone/Weaviate | pgvector stays within PostgreSQL (no new infra); locked decision |
| Separate table | Column on skills | Separate table better for model versioning; aligns with locked decision |

**Installation:**
```bash
# In packages/db
pnpm add pgvector

# In apps/web (or new packages/embeddings)
pnpm add voyageai
```

## Architecture Patterns

### Recommended Project Structure
```
packages/
├── db/
│   └── src/
│       ├── schema/
│       │   └── skill-embeddings.ts    # New embedding table schema
│       └── services/
│           └── skill-embeddings.ts    # Embedding service functions
apps/
└── web/
    └── lib/
        └── embeddings.ts              # Voyage AI client wrapper
```

### Pattern 1: Separate Embeddings Table with Model Versioning
**What:** Store embeddings in a dedicated table referencing skills, with model name/version tracking per row
**When to use:** When embeddings may be regenerated with different models over time (locked decision)
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { pgTable, text, timestamp, index, vector } from "drizzle-orm/pg-core";
import { skills } from "./skills";

export const skillEmbeddings = pgTable(
  "skill_embeddings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" })
      .unique(), // One embedding per skill
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    modelName: text("model_name").notNull(), // e.g., "voyage-code-3"
    modelVersion: text("model_version").notNull(), // e.g., "1.0"
    inputHash: text("input_hash").notNull(), // Hash of embedded content for change detection
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);
```

### Pattern 2: Embedding Generation in Server Action
**What:** Generate embedding synchronously during skill creation, fail the action if embedding fails
**When to use:** When embedding is critical for functionality and volume is low (<100 skills)
**Example:**
```typescript
// In apps/web/app/actions/skills.ts
import { generateEmbedding } from "@/lib/embeddings";
import { createSkillEmbedding } from "@everyskill/db/services/skill-embeddings";

// After skill insert succeeds
const embeddingInput = `${name} ${description} ${content} ${tags.join(" ")}`;
const embedding = await generateEmbedding(embeddingInput);
await createSkillEmbedding(newSkill.id, embedding, "voyage-code-3", "1.0", embeddingInput);
```

### Pattern 3: Similarity Query with Cosine Distance
**What:** Query similar skills using Drizzle's cosineDistance helper
**When to use:** Finding semantically similar content
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { skillEmbeddings, skills } from "@everyskill/db/schema";

async function findSimilarSkills(queryEmbedding: number[], threshold = 0.7, limit = 10) {
  const similarity = sql<number>`1 - (${cosineDistance(skillEmbeddings.embedding, queryEmbedding)})`;

  return await db
    .select({
      skillId: skillEmbeddings.skillId,
      name: skills.name,
      similarity,
    })
    .from(skillEmbeddings)
    .innerJoin(skills, eq(skills.id, skillEmbeddings.skillId))
    .where(gt(similarity, threshold))
    .orderBy(desc(similarity))
    .limit(limit);
}
```

### Anti-Patterns to Avoid
- **Embedding on column of skills table:** Makes model versioning difficult; use separate table per locked decision
- **Fire-and-forget async embedding:** For small volumes, synchronous is simpler and ensures consistency
- **Raw SQL for distance queries:** Use Drizzle's type-safe `cosineDistance()` helper
- **Storing embedding as JSON array:** Must use pgvector's `vector` type for indexing

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector storage | Float array column | pgvector extension | No index support, slow queries |
| Vector type in Drizzle | Custom type | `vector()` from drizzle-orm/pg-core | Native support since v0.31 |
| Embedding API client | Fetch wrapper | `voyageai` SDK | Handles retries, rate limits, types |
| Distance calculations | Manual math | Drizzle helpers (`cosineDistance`, etc.) | SQL-optimized, index-aware |
| Retry logic | Custom implementation | SDK's built-in retries | Handles 429, 5XX correctly |

**Key insight:** Drizzle ORM has native pgvector support as of v0.31. The old pattern of using `customType()` is no longer necessary and may cause migration issues with quoted type names.

## Common Pitfalls

### Pitfall 1: Missing pgvector Extension
**What goes wrong:** Table creation fails with "type 'vector' does not exist"
**Why it happens:** Drizzle doesn't auto-create PostgreSQL extensions
**How to avoid:** Create migration file with `CREATE EXTENSION IF NOT EXISTS vector;` BEFORE table migrations
**Warning signs:** Migration errors mentioning unknown type

### Pitfall 2: Dimension Mismatch
**What goes wrong:** Insert fails with "expected X dimensions, got Y"
**Why it happens:** Embedding model output dimensions don't match column definition
**How to avoid:** voyage-code-3 default is 1024; explicitly set `output_dimension: 1024` in API calls
**Warning signs:** Dimension errors on insert

### Pitfall 3: Rate Limit Exhaustion During Backfill
**What goes wrong:** 429 errors during migration, partial backfill
**Why it happens:** Voyage Tier 1 allows 2000 RPM / 3M TPM for voyage-code-3
**How to avoid:** Batch requests (max 1000 items), add delay between batches (100-200ms)
**Warning signs:** VoyageAIError with statusCode 429

### Pitfall 4: Index Not Used in Queries
**What goes wrong:** Slow similarity queries despite HNSW index
**Why it happens:** Complex query structure prevents index usage
**How to avoid:** Use EXPLAIN to verify; simplify query until index is used
**Warning signs:** Sequential scan in EXPLAIN output

### Pitfall 5: Content Exceeding Token Limit
**What goes wrong:** Unexpected truncation or API errors
**Why it happens:** voyage-code-3 has 32K token limit per input
**How to avoid:** Pre-validate content length; truncation is enabled by default (safe)
**Warning signs:** Very long skills producing lower-quality matches

### Pitfall 6: Migration Fails Partway Through
**What goes wrong:** Some skills have embeddings, others don't
**Why it happens:** API failure mid-backfill without transaction rollback
**How to avoid:** Per locked decision: fail deployment if any embedding fails; wrap in transaction
**Warning signs:** Partial embedding coverage

## Code Examples

Verified patterns from official sources:

### Enable pgvector Extension (Migration)
```sql
-- Source: https://github.com/pgvector/pgvector
-- Create as first migration or manually before schema push
CREATE EXTENSION IF NOT EXISTS vector;
```

### Voyage AI Client Setup
```typescript
// Source: https://github.com/voyage-ai/typescript-sdk
import { VoyageAIClient, VoyageAIError } from "voyageai";

const client = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY!,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await client.embed({
      input: [text],
      model: "voyage-code-3",
      inputType: "document", // Use "query" for search queries
      outputDimension: 1024, // Explicit dimension setting
    });

    return response.data[0].embedding;
  } catch (err) {
    if (err instanceof VoyageAIError) {
      console.error(`Voyage API error: ${err.statusCode} - ${err.message}`);
      throw new Error(`Embedding generation failed: ${err.message}`);
    }
    throw err;
  }
}
```

### Batch Embedding for Migration
```typescript
// Source: https://docs.voyageai.com/docs/embeddings
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs = 150
): Promise<number[][]> {
  const results: number[][] = [];
  const batchSize = 128; // Optimal batch size per Voyage docs

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await client.embed({
      input: batch,
      model: "voyage-code-3",
      inputType: "document",
      outputDimension: 1024,
    });

    results.push(...response.data.map(d => d.embedding));

    // Throttle between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
```

### Insert Embedding with Drizzle
```typescript
// Source: https://orm.drizzle.team/docs/guides/vector-similarity-search
import { skillEmbeddings } from "@everyskill/db/schema";
import { hashContent } from "@/lib/content-hash";

export async function createSkillEmbedding(
  skillId: string,
  embedding: number[],
  modelName: string,
  modelVersion: string,
  inputText: string
) {
  const inputHash = await hashContent(inputText);

  await db.insert(skillEmbeddings).values({
    skillId,
    embedding,
    modelName,
    modelVersion,
    inputHash,
  });
}
```

### Upsert Pattern for Re-embedding
```typescript
// For updating embeddings when model changes
import { eq } from "drizzle-orm";

export async function upsertSkillEmbedding(
  skillId: string,
  embedding: number[],
  modelName: string,
  modelVersion: string,
  inputHash: string
) {
  const existing = await db
    .select({ id: skillEmbeddings.id })
    .from(skillEmbeddings)
    .where(eq(skillEmbeddings.skillId, skillId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(skillEmbeddings)
      .set({ embedding, modelName, modelVersion, inputHash, updatedAt: new Date() })
      .where(eq(skillEmbeddings.skillId, skillId));
  } else {
    await db.insert(skillEmbeddings).values({
      skillId,
      embedding,
      modelName,
      modelVersion,
      inputHash,
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle `customType()` for vector | Native `vector()` type | Drizzle v0.31 (2024) | Cleaner schema, proper migration support |
| OpenAI text-embedding-ada-002 | voyage-code-3 for code | Dec 2024 | 13.8% better retrieval for code content |
| IVFFlat indexes | HNSW indexes | pgvector 0.5+ | Better recall/speed tradeoff, no training data needed |

**Deprecated/outdated:**
- `customType()` for vectors: Use native `vector()` import
- Storing vectors as `float8[]`: No index support, use pgvector type
- Separate vector databases (Pinecone, etc.) for small-medium workloads: pgvector sufficient

## Open Questions

Things that couldn't be fully resolved:

1. **Exact throttle delay for migration**
   - What we know: 100-200ms between batches is safe for Tier 1 limits (2000 RPM)
   - What's unclear: Optimal value depends on batch size and concurrent usage
   - Recommendation: Start with 150ms, adjust if seeing 429 errors

2. **HNSW vs IVFFlat for small dataset**
   - What we know: HNSW better for queries, IVFFlat faster to build
   - What's unclear: With <100 skills, difference may be negligible
   - Recommendation: Use HNSW (per Claude's discretion) - better recall, no training data needed

## Sources

### Primary (HIGH confidence)
- Drizzle ORM docs: https://orm.drizzle.team/docs/guides/vector-similarity-search - Native vector support, distance functions
- Drizzle extensions docs: https://orm.drizzle.team/docs/extensions/pg - pgvector integration details
- pgvector GitHub: https://github.com/pgvector/pgvector - Extension setup, index types, tuning
- Voyage AI docs: https://docs.voyageai.com/docs/embeddings - API format, models, parameters
- Voyage AI TypeScript SDK: https://github.com/voyage-ai/typescript-sdk - Client usage, error handling

### Secondary (MEDIUM confidence)
- Voyage AI rate limits: https://docs.voyageai.com/docs/rate-limits - Tier limits, batch recommendations
- voyage-code-3 blog post: https://blog.voyageai.com/2024/12/04/voyage-code-3/ - Dimensions, benchmarks
- pgvector-node: https://github.com/pgvector/pgvector-node - ORM integrations

### Tertiary (LOW confidence)
- Community patterns for embedding storage architecture - Multiple sources agree on separate table for versioning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All official documentation verified
- Architecture: HIGH - Drizzle native support confirmed, patterns from official guides
- Pitfalls: HIGH - Common issues documented in official repos and community

**Research date:** 2026-02-02
**Valid until:** 30 days (stable technologies, Voyage model unlikely to change rapidly)

---

## Recommendations for Claude's Discretion Items

Based on research findings:

### Error Handling for Embedding API Failures
**Recommendation:** Throw and fail the skill creation server action. Rationale:
- Volume is low (<100 skills) - retries manageable
- Embedding is critical for downstream features (Phase 16, 17)
- SDK has built-in retry for transient errors (429, 5XX)
- User gets immediate feedback rather than broken state

### Throttle Delay Between API Calls
**Recommendation:** 150ms between batches of 128 items. Rationale:
- Tier 1 limit: 2000 RPM, 3M TPM
- 128 items at 150ms delay = ~400 batches/minute = safe margin
- Can process 100 skills in <1 minute

### Storage Format
**Recommendation:** Separate `skill_embeddings` table. Rationale:
- Aligns with locked decision on per-embedding model tracking
- Enables future model migrations without altering skills table
- Cleaner separation of concerns
- Makes re-embedding queries straightforward

### Index Type
**Recommendation:** HNSW with `vector_cosine_ops`. Rationale:
- No training data required (can create on empty table)
- Better recall than IVFFlat at query time
- For <100 skills, build time is negligible
- Cosine distance is standard for semantic similarity
