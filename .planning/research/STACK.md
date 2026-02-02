# Technology Stack: v1.3 AI Review, Semantic Similarity, Cross-Platform Install

**Project:** Relay v1.3 - AI-Driven Quality & Discovery
**Researched:** 2026-02-02
**Scope:** Stack additions for AI skill review, semantic duplicate detection, fork-based versioning, cross-platform MCP install
**Confidence:** HIGH (verified via official docs, npm packages, and Context7)

---

## Executive Summary

For v1.3 AI-driven features, the recommendations are:

### AI Skill Review
**Use `@anthropic-ai/sdk` ^0.71.x** for Claude API calls to review uploaded skills. The SDK provides streaming, tool use, and native MCP integration. Review prompts evaluate functionality, security patterns, and quality.

### Semantic Similarity / Duplicate Detection
**Use `pgvector` ^0.8.x + `voyage-code-3` embeddings** for semantic skill matching. pgvector integrates natively with the existing PostgreSQL/Drizzle stack. Voyage's code-specialized embeddings outperform general-purpose models for Claude skills (which contain code, prompts, and technical content).

### Fork-Based Versioning
**No new dependencies needed.** The existing `skillVersions` table plus new `forkedFromId` foreign key handles fork relationships. Add UI components from shadcn/ui.

### Cross-Platform Install
**Upgrade `@modelcontextprotocol/sdk` to v1.25+ with Streamable HTTP support** for remote MCP server capability. This enables Claude.ai web, Claude Desktop, VS Code, and Claude Code to all connect to Relay as a skill source.

---

## Stack Additions

### Required New Dependencies

| Library | Version | Purpose | Bundle/Runtime | Why |
|---------|---------|---------|----------------|-----|
| **@anthropic-ai/sdk** | ^0.71.2 | Claude API for AI review | Server-side only | Official TypeScript SDK with streaming, tool use, MCP helpers. Supports `claude-sonnet-4-5-20250929` model. |
| **voyageai** | ^0.1.0 | Generate skill embeddings | Server-side only | Anthropic's recommended embedding provider. `voyage-code-3` model optimized for code/technical content. 1024 dimensions, $0.18/1M tokens. |
| **pgvector** | ^0.2.0 | Node.js pgvector types | Server-side only | TypeScript types and SQL helpers for pgvector queries with Drizzle. |

### Required Database Changes

| Change | Purpose | Migration |
|--------|---------|-----------|
| **pgvector extension** | Enable vector storage/search | `CREATE EXTENSION IF NOT EXISTS vector;` |
| **embedding column** | Store skill content embeddings | `ALTER TABLE skills ADD COLUMN embedding vector(1024);` |
| **HNSW index** | Fast approximate nearest neighbor | `CREATE INDEX skills_embedding_idx ON skills USING hnsw (embedding vector_cosine_ops);` |
| **forkedFromId column** | Track fork relationships | `ALTER TABLE skills ADD COLUMN forked_from_id TEXT REFERENCES skills(id);` |
| **aiReviewStatus column** | Track review state | `ALTER TABLE skills ADD COLUMN ai_review_status TEXT DEFAULT 'pending';` |
| **aiReviewResult column** | Store AI review output | `ALTER TABLE skills ADD COLUMN ai_review_result JSONB;` |

### Installation Commands

```bash
# In monorepo root
pnpm add -w @anthropic-ai/sdk voyageai pgvector

# Or in apps/web specifically
cd apps/web && pnpm add @anthropic-ai/sdk voyageai pgvector
```

### Environment Variables

```bash
# .env.local additions
ANTHROPIC_API_KEY=sk-ant-...           # For AI review
VOYAGEAI_API_KEY=pa-...                # For embeddings
```

---

## Feature-Specific Stack Recommendations

### 1. AI Skill Review

**Approach:** Server-side Claude API calls via `@anthropic-ai/sdk`

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| SDK | `@anthropic-ai/sdk` ^0.71.2 | Official TypeScript SDK, native streaming, tool use support |
| Model | `claude-sonnet-4-5-20250929` | Fast, capable enough for code review. Cheaper than Opus for batch reviews. |
| Invocation | Server Action or API Route | Keep API key server-side, avoid client exposure |
| Review types | Functionality, Security, Quality | Three structured prompts, run in sequence or parallel |
| Output format | Structured JSON via system prompt | Consistent schema for UI rendering |

**SDK Usage Pattern:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ReviewResult {
  functionality: { score: number; issues: string[]; suggestions: string[] };
  security: { score: number; risks: string[]; recommendations: string[] };
  quality: { score: number; feedback: string[]; improvements: string[] };
  overall: { tier: 'gold' | 'silver' | 'bronze' | 'needs-work'; summary: string };
}

async function reviewSkill(skillContent: string): Promise<ReviewResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Review this Claude skill for functionality, security, and quality:\n\n${skillContent}`
    }],
    system: `You are a skill reviewer for a Claude skill marketplace.
    Analyze the skill and return ONLY valid JSON matching this schema:
    { functionality: {...}, security: {...}, quality: {...}, overall: {...} }`
  });

  return JSON.parse(message.content[0].text);
}
```

**Security Scanning Approach:**

Do NOT add heavy SAST tools (Semgrep, SonarQube). Instead:
1. Use Claude to analyze skill content for common patterns:
   - Prompt injection vectors
   - Unsafe tool configurations
   - Credential exposure patterns
   - Overly permissive file access
2. Check for known bad patterns with regex (cheap, fast pre-filter)
3. Claude provides contextual security review (understands intent)

**Why Claude over SAST tools:**
- Skills are prompt/config files, not executable code
- Traditional SAST tools don't understand Claude skill semantics
- Claude can evaluate prompt injection risk, which SAST cannot
- No additional infrastructure (Semgrep server, etc.)

### 2. Semantic Similarity / Duplicate Detection

**Approach:** pgvector with Voyage embeddings, Drizzle ORM integration

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Vector DB | pgvector ^0.8.1 | Stays in existing PostgreSQL, no new infrastructure. Supports HNSW for fast search. |
| Embedding model | `voyage-code-3` | Optimized for code/technical content. 1024 dimensions. $0.18/1M tokens with 200M free tier. |
| Dimensions | 1024 | voyage-code-3 default. Good balance of quality vs storage. |
| Index type | HNSW | Better query performance than IVFFlat, can build without data |
| Distance metric | Cosine | Standard for text embeddings, normalized vectors |
| Threshold | 0.85+ similarity | Advisory "similar skill exists" without blocking |

**Why voyage-code-3 over alternatives:**
- Anthropic recommends Voyage AI for Claude ecosystem
- `voyage-code-3` specifically trained for code retrieval
- Skills contain code, prompts, and technical content
- Outperforms general models like OpenAI's `text-embedding-3-small` for this domain
- 200M token free tier covers initial deployment

**Drizzle Schema Addition:**
```typescript
import { pgTable, text, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom vector type for pgvector
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value.slice(1, -1).split(",").map(Number);
    }
    return value as number[];
  },
});

// In skills table
export const skills = pgTable(
  "skills",
  {
    // ... existing columns
    embedding: vector("embedding"), // 1024-dim voyage-code-3 embedding
  },
  (table) => [
    // HNSW index for cosine similarity search
    index("skills_embedding_idx").using("hnsw", sql`${table.embedding} vector_cosine_ops`),
  ]
);
```

**Similarity Search Query:**
```typescript
import { cosineDistance, desc, sql } from "drizzle-orm";

async function findSimilarSkills(embedding: number[], limit = 5) {
  const similarity = sql<number>`1 - (${cosineDistance(skills.embedding, embedding)})`;

  return db.select({
    id: skills.id,
    name: skills.name,
    similarity,
  })
  .from(skills)
  .where(sql`${skills.embedding} IS NOT NULL`)
  .orderBy(desc(similarity))
  .limit(limit);
}
```

**Embedding Generation:**
```typescript
import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGEAI_API_KEY });

async function generateEmbedding(skillContent: string): Promise<number[]> {
  const result = await voyage.embed({
    input: [skillContent],
    model: "voyage-code-3",
    inputType: "document", // Use "query" for search queries
  });

  return result.data[0].embedding;
}
```

### 3. Fork-Based Versioning

**Approach:** Database schema changes only, no new libraries

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Fork tracking | `forkedFromId` FK column | Simple parent reference, enables fork trees |
| Version numbering | Sequential per skill | Already exists in `skillVersions.version` |
| Diff display | No library needed | Skills are markdown/JSON - show side-by-side in UI |
| Fork UI | shadcn Dialog + Card | Already in stack |

**No new dependencies needed.** The fork model is a data structure change:

```typescript
// Schema addition
export const skills = pgTable("skills", {
  // ... existing columns
  forkedFromId: text("forked_from_id").references(() => skills.id),
  forkCount: integer("fork_count").notNull().default(0), // Denormalized for display
});
```

**Fork creation is a Server Action:**
```typescript
async function forkSkill(originalSkillId: string, userId: string) {
  const original = await db.query.skills.findFirst({ where: eq(skills.id, originalSkillId) });

  const [forked] = await db.insert(skills).values({
    name: `${original.name} (Fork)`,
    description: original.description,
    category: original.category,
    tags: original.tags,
    content: original.content,
    forkedFromId: originalSkillId,
    authorId: userId,
  }).returning();

  // Update fork count on original
  await db.update(skills)
    .set({ forkCount: sql`${skills.forkCount} + 1` })
    .where(eq(skills.id, originalSkillId));

  return forked;
}
```

### 4. Cross-Platform Install (Claude Code, Desktop, Web, VS Code)

**Approach:** Upgrade MCP SDK, add Streamable HTTP transport for remote server capability

| Platform | Connection Method | What Relay Provides |
|----------|-------------------|---------------------|
| **Claude Code** | `claude mcp add` CLI | MCP config JSON for stdio transport |
| **Claude Desktop** | Config file or Desktop Extension | MCP config JSON + optional .mcpb extension |
| **Claude.ai Web** | Remote MCP connector | Streamable HTTP endpoint |
| **VS Code (Claude)** | MCP settings | MCP config JSON |

**Current State:** Relay has an MCP server (`apps/mcp`) using `@modelcontextprotocol/sdk` ^1.25.0 with stdio transport.

**Required Changes:**

1. **Add Streamable HTTP transport** for web clients:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
const server = new McpServer({ name: "relay-skills", version: "1.0.0" });

// Register tools...

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.listen(3001);
```

2. **Generate platform-specific install configs:**
```typescript
// apps/web/lib/mcp-config.ts
export function generateInstallConfig(skillId: string, platform: Platform) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  switch (platform) {
    case "claude-code":
      return {
        command: "claude mcp add relay-skills --transport http",
        config: { url: `${baseUrl}/api/mcp` }
      };

    case "claude-desktop":
      return {
        config: {
          mcpServers: {
            "relay-skills": {
              command: "npx",
              args: ["-y", "@relay/mcp"]
            }
          }
        }
      };

    case "claude-web":
      return {
        connectorUrl: `${baseUrl}/api/mcp`,
        instructions: "Add as custom connector in Claude.ai settings"
      };

    case "vscode":
      return {
        config: {
          "claude.mcpServers": {
            "relay-skills": {
              command: "npx",
              args: ["-y", "@relay/mcp"]
            }
          }
        }
      };
  }
}
```

3. **Package MCP server for npm distribution:**
```json
// apps/mcp/package.json
{
  "name": "@relay/mcp",
  "version": "1.0.0",
  "bin": { "relay-mcp": "./dist/index.js" },
  "publishConfig": { "access": "public" }
}
```

**Streamable HTTP Benefits:**
- Stateless operation (no long-lived connections)
- Compatible with serverless (Vercel, Cloudflare)
- Works through standard HTTP proxies/load balancers
- Supports Claude.ai web custom connectors

---

## What NOT to Add

| Library | Why NOT |
|---------|---------|
| **Pinecone / Weaviate / Qdrant** | pgvector handles our scale (<10k skills). Adding a separate vector DB increases infrastructure complexity. |
| **OpenAI Embeddings** | Voyage is Anthropic-recommended, `voyage-code-3` outperforms `text-embedding-3-small` for code. |
| **Semgrep / SonarQube** | Skills are prompts/configs, not executable code. Claude does better contextual security review. |
| **LangChain** | Direct SDK usage is simpler for our review prompts. LangChain adds abstraction without benefit here. |
| **Redis for embedding cache** | PostgreSQL with pgvector is sufficient. Embeddings are generated once at upload time. |
| **Dedicated diff library** | Skills are small text files. Simple side-by-side UI suffices. |
| **@modelcontextprotocol/sdk v2** | v2 is pre-alpha. v1.25.x has Streamable HTTP and is production-ready. |

---

## Integration with Existing Stack

### PostgreSQL / Drizzle Integration

pgvector integrates cleanly:
1. Enable extension via migration (one-time)
2. Add `vector(1024)` column type via Drizzle custom type
3. Use Drizzle's `sql` template for distance functions
4. Drizzle's built-in `cosineDistance` function works with pgvector

**Migration file:**
```sql
-- 0003_add_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE skills ADD COLUMN embedding vector(1024);
CREATE INDEX skills_embedding_idx ON skills USING hnsw (embedding vector_cosine_ops);

ALTER TABLE skills ADD COLUMN forked_from_id TEXT REFERENCES skills(id);
ALTER TABLE skills ADD COLUMN fork_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE skills ADD COLUMN ai_review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE skills ADD COLUMN ai_review_result JSONB;
```

### Existing MCP Server Integration

The existing `apps/mcp` package already uses `@modelcontextprotocol/sdk` ^1.25.0. Changes needed:
1. Add HTTP endpoint alongside stdio
2. Add tools for skill install/search that platforms can invoke
3. Keep stdio transport for local CLI usage

### Auth.js Integration

AI review and fork operations use existing auth:
```typescript
// Server Action with auth check
async function reviewSkill(skillId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Trigger AI review...
}
```

---

## Cost Estimates

| Service | Usage Estimate | Monthly Cost |
|---------|---------------|--------------|
| **Voyage AI (embeddings)** | 10k skills * 2k tokens avg = 20M tokens | $3.60 (or free tier) |
| **Anthropic API (reviews)** | 1k reviews * 3k tokens = 3M tokens | ~$9 (Sonnet pricing) |
| **pgvector** | Part of existing PostgreSQL | $0 |
| **Total** | | ~$12.60/month |

*Free tiers: Voyage offers 200M tokens free, Anthropic offers $5 API credit for new accounts.*

---

## Version Compatibility Matrix

| Package | Version | Requires | Notes |
|---------|---------|----------|-------|
| @anthropic-ai/sdk | ^0.71.2 | Node 18+ | Works with existing Node 22 |
| voyageai | ^0.1.0 | Node 18+ | TypeScript SDK with retries |
| pgvector | ^0.2.0 | PostgreSQL 13+, pgvector extension | Types only, no runtime |
| @modelcontextprotocol/sdk | ^1.25.0 | Node 18+ | Already installed, add HTTP transport |
| drizzle-orm | ^0.38.0 | Already installed | Custom vector type works |

---

## Bundle Impact Assessment

| Addition | Runtime | Notes |
|----------|---------|-------|
| @anthropic-ai/sdk | Server only | No client bundle impact |
| voyageai | Server only | No client bundle impact |
| pgvector | Server only | Types only, minimal |
| Streamable HTTP transport | Server only | Part of existing MCP SDK |
| **Client additions** | **0kb** | All AI/embedding work is server-side |

---

## Implementation Priority

| Feature | Dependencies | Priority | Complexity |
|---------|--------------|----------|------------|
| **AI Skill Review** | @anthropic-ai/sdk | HIGH | Medium - prompt engineering |
| **Semantic Similarity** | pgvector, voyageai | HIGH | Medium - migration + queries |
| **Fork Model** | Schema only | MEDIUM | Low - FK + Server Actions |
| **Cross-Platform Install** | MCP HTTP transport | MEDIUM | Medium - multiple configs |

**Recommended implementation order:**
1. Semantic similarity (foundation for "similar skills" feature)
2. AI skill review (uses similarity to avoid duplicate reviews)
3. Fork model (simple schema change)
4. Cross-platform install (can ship incrementally per platform)

---

## Sources

**HIGH Confidence (Official Documentation):**
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) - v0.71.x features, streaming, tool use
- [Voyage AI Embeddings Docs](https://docs.voyageai.com/docs/embeddings) - Model selection, pricing, input types
- [Voyage AI TypeScript SDK](https://www.npmjs.com/package/voyageai) - v0.1.0 usage patterns
- [pgvector GitHub](https://github.com/pgvector/pgvector) - v0.8.1, HNSW indexes, distance functions
- [Drizzle pgvector Guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) - Custom vector type, cosineDistance
- [MCP Streamable HTTP Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) - Transport protocol
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - v1.x for production
- [Claude.ai Custom Connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) - Remote MCP setup

**MEDIUM Confidence (Verified Patterns):**
- [Voyage AI Pricing](https://docs.voyageai.com/docs/pricing) - $0.18/1M for voyage-code-3
- [pgvector HNSW Performance](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector) - Index tuning
- [Claude Code MCP Setup](https://code.claude.com/docs/en/mcp) - CLI commands

---

*Stack research for: Relay v1.3 - AI Review, Semantic Similarity, Cross-Platform Install*
*Researched: 2026-02-02*
