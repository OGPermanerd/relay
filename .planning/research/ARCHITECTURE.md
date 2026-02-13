# Architecture Patterns

**Domain:** v3.0 AI Discovery & Workflow Intelligence -- integrating Google Workspace diagnostics, intent search, visibility scoping, Loom video, preferences, and homepage redesign into existing EverySkill monorepo
**Researched:** 2026-02-13
**Confidence:** HIGH for existing system analysis, MEDIUM for new integration patterns

## Existing System Overview

Before defining new components, here is the verified state of what exists (confirmed via direct codebase analysis).

### Current Stack
- **Monorepo:** `packages/db` (Drizzle ORM 0.42.0, PostgreSQL 15 + pgvector) + `apps/web` (Next.js 16.1.6) + `apps/mcp` (MCP server)
- **Auth:** Auth.js v5 with JWT strategy, Google SSO, 8h session, domain-scoped cookies, domain-to-tenant mapping
- **Multi-tenancy:** All tables have `tenant_id` NOT NULL FK, RLS policies via `app.current_tenant_id`, subdomain routing
- **Search:** Dual-mode -- full-text (`tsvector` + `websearch_to_tsquery`) and semantic (Voyage AI / Ollama embeddings -> pgvector `cosineDistance`)
- **AI:** Anthropic Claude for skill reviews/improvements, Voyage AI for embeddings, Ollama for local embeddings
- **Deployment:** PM2 + Caddy, ports 2000/2001/2002

### Current Schema Tables (17 total)
`tenants`, `users`, `accounts`, `sessions`, `verificationTokens`, `skills`, `skillVersions`, `skillEmbeddings`, `ratings`, `usageEvents`, `apiKeys`, `siteSettings`, `auditLogs`, `skillMessages`, `notifications`, `notificationPreferences`, `reviewDecisions`

### Key Architectural Decisions Already Made
1. JWT strategy (not database sessions) -- tokens carry `tenantId` and `role`
2. `accounts` table stores Google OAuth `access_token`, `refresh_token`, `scope`, `expires_at`
3. `DEFAULT_TENANT_ID` hardcoded in 18+ files (not yet dynamic)
4. Embedding generation is fire-and-forget (non-blocking, errors swallowed)
5. RLS is ENABLED but not FORCED -- table owner bypasses RLS during single-tenant phase
6. Skills have 7-status lifecycle: draft -> pending_review -> ai_reviewed -> approved/rejected/changes_requested -> published

---

## Recommended Architecture for v3.0

### Component Map

```
                     +-------------------+
                     |   Next.js App     |
                     |  (apps/web)       |
                     +---------+---------+
                               |
          +--------------------+--------------------+
          |                    |                    |
  +-------v--------+  +-------v--------+  +-------v---------+
  | Intent Search   |  | Workspace      |  | Visibility      |
  | Engine          |  | Integration    |  | Scoping         |
  | (new)           |  | (new)          |  | (modify skills) |
  +-------+--------+  +-------+--------+  +-------+---------+
          |                    |                    |
  +-------v--------+  +-------v--------+  +-------v---------+
  | Hybrid Search   |  | Google OAuth   |  | Skills Schema   |
  | Service (RRF)   |  | Token Store    |  | + Query Filters |
  | (new)           |  | (new table)    |  | (modify)        |
  +-------+--------+  +-------+--------+  +-------+---------+
          |                    |                    |
  +-------v----------------------------------------------v----+
  |               packages/db (Drizzle + pgvector)            |
  |  New tables: workspace_tokens, workspace_profiles,        |
  |              user_preferences, search_history              |
  |  Modified: skills (visibility, loom_url columns)           |
  +-----------------------------------------------------------+
```

---

## 1. Google Workspace OAuth: Incremental Scope Architecture

### The Problem

EverySkill already uses Google OAuth for SSO login with default scopes (`openid email profile`). Workspace diagnostics needs additional Google API scopes (`directory.readonly` at minimum) to read organizational data. This must work alongside existing SSO without breaking the current auth flow.

### Critical Finding: Auth.js v5 Does NOT Support Incremental Authorization

Auth.js v5 has no built-in support for incremental scope expansion. GitHub Discussion #10261 confirms that using `include_granted_scopes=true` does not correctly update stored tokens or track newly granted scopes. The stored `access_token` in the `accounts` table becomes invalid for the new scope set, and the `scope` column does not get updated.

**Confidence:** HIGH -- confirmed via official Auth.js GitHub discussions and documentation review.

### Recommended Approach: Separate OAuth Flow for Workspace Scopes

Implement a dedicated Workspace connection flow as a completely separate OAuth dance, independent of Auth.js.

```
User clicks "Connect Workspace" in Settings ->
  Custom API route (/api/workspace/connect) initiates OAuth2 ->
  Google consent screen (directory.readonly scope) ->
  Callback stores tokens (/api/workspace/callback) ->
  workspace_tokens table stores encrypted access/refresh tokens
```

### Why Separate Routes Instead of Auth.js Provider

Auth.js is designed for **authentication** (who you are), not **authorization** (what APIs you can access). Mixing workspace API scopes into the auth provider creates coupling between login flow and feature availability. A user who declines workspace scopes should not be blocked from signing in. Separating these concerns also means:

- Workspace tokens can be revoked independently without logging the user out
- Different team members can connect/disconnect workspace without affecting others' sessions
- Token refresh for workspace APIs operates on its own schedule (not tied to session refresh)
- Future integrations (Slack, Jira, etc.) follow the same pattern: separate OAuth + separate token table

### Data Flow

```
1. User already authenticated via Auth.js (Google SSO)
2. Admin navigates to Settings > Workspace Integration
3. UI shows "Connect Google Workspace" button (admin-only)
4. Click initiates OAuth2 Authorization Code flow:
   - client_id: same Google Cloud project as SSO
   - redirect_uri: /api/workspace/callback
   - scope: https://www.googleapis.com/auth/directory.readonly
   - access_type: offline (to receive refresh_token)
   - prompt: consent (force consent screen to ensure refresh_token)
   - login_hint: user's email (skip account chooser)
   - state: HMAC-signed JSON { userId, tenantId, csrf }
5. Google redirects to callback with authorization code
6. Callback verifies state HMAC, exchanges code for tokens
7. Tokens encrypted and stored in workspace_tokens table
8. Immediate trigger: first directory sync (fire-and-forget)
9. UI shows "Connected" status with last sync time
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/workspace/connect` | GET | Initiates Google OAuth flow, admin-only |
| `/api/workspace/callback` | GET | OAuth callback, stores tokens |
| `/api/workspace/disconnect` | POST | Revokes tokens, deletes workspace data |
| `/api/workspace/sync` | POST | Manual re-sync trigger, admin-only |
| `/api/workspace/status` | GET | Connection status + last sync time |

### Token Storage Schema

```typescript
// packages/db/src/schema/workspace-tokens.ts
export const workspaceTokens = pgTable("workspace_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),  // future-proof for Slack, etc.
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  scope: text("scope").notNull(),  // space-separated scopes granted
  expiresAt: timestamp("expires_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status").default("pending"),  // pending | syncing | synced | error
  syncError: text("sync_error"),
}, (table) => [
  index("workspace_tokens_tenant_id_idx").on(table.tenantId),
  uniqueIndex("workspace_tokens_tenant_provider_unique").on(table.tenantId, table.provider),
  pgPolicy("tenant_isolation", {
    as: "restrictive",
    for: "all",
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  }),
]);
```

**Design decision: One token per tenant per provider, not per user.** Workspace integration is a tenant-level feature. Having one admin connect it serves the whole organization. The `userId` tracks WHO connected it (for audit), not who can use the data.

### Token Encryption

Access and refresh tokens MUST be encrypted at rest using AES-256-GCM. This is a SOC2 requirement and a security best practice.

```typescript
// apps/web/lib/token-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.WORKSPACE_TOKEN_ENCRYPTION_KEY!, "hex");
// WORKSPACE_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encrypted] = ciphertext.split(":");
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

### Google API Scopes Strategy

| Feature | Scope Required | Admin Setup Required? |
|---------|---------------|----------------------|
| Read org directory (employee list, departments, titles) | `https://www.googleapis.com/auth/directory.readonly` | Yes -- admin must enable "Contact sharing" in Google Admin Console |
| Read domain contacts | `https://www.googleapis.com/auth/contacts.other.readonly` | No |
| Read user profiles | Already have via SSO (`openid profile email`) | No |

**Recommendation:** Request `directory.readonly` only. This is the People API "directory" scope, NOT the Admin SDK scope -- it does not require domain-wide delegation. However, the Google Workspace admin must have enabled "Directory: Sharing settings" to allow external apps to read domain profiles.

**The app should detect and handle the case where directory sharing is not enabled** -- the Google API will return a 403 error. Display a clear "Ask your Google Workspace admin to enable directory sharing" message with a link to the relevant Google Admin Console page.

### New Files

| File | Purpose |
|------|---------|
| `apps/web/app/api/workspace/connect/route.ts` | Initiate OAuth flow |
| `apps/web/app/api/workspace/callback/route.ts` | Handle OAuth callback, store tokens |
| `apps/web/app/api/workspace/disconnect/route.ts` | Revoke + delete |
| `apps/web/app/api/workspace/sync/route.ts` | Manual sync trigger |
| `apps/web/app/api/workspace/status/route.ts` | Connection status |
| `apps/web/lib/token-encryption.ts` | AES-256-GCM encrypt/decrypt |
| `apps/web/lib/google-workspace-client.ts` | Google API client wrapper |
| `packages/db/src/schema/workspace-tokens.ts` | Token storage schema |
| `packages/db/src/services/workspace-tokens.ts` | Token CRUD + refresh |

---

## 2. Workspace Diagnostics: Data Model and Sync Architecture

### What is "Workspace Diagnostics"?

Cross-reference Google Workspace organizational data (departments, titles, reporting structure) with EverySkill usage patterns. Answers questions like: "Which departments are using AI skills?", "What is the adoption rate per team?", "Who are the power users in Engineering?"

### Directory Data Storage

**Do NOT sync full Google directory into our database.** Cache only the minimal organizational metadata needed for analytics cross-referencing. This reduces privacy surface, storage, and GDPR/SOC2 exposure.

```typescript
// packages/db/src/schema/workspace-profiles.ts
export const workspaceProfiles = pgTable("workspace_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").references(() => users.id),  // nullable until matched
  externalId: text("external_id").notNull(),  // Google directory user ID
  email: text("email").notNull(),
  name: text("name"),
  department: text("department"),
  title: text("title"),
  orgUnitPath: text("org_unit_path"),  // e.g., "/Engineering/Frontend"
  managerId: text("manager_id"),  // references externalId (not our user ID)
  thumbnailUrl: text("thumbnail_url"),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workspace_profiles_tenant_external_unique").on(table.tenantId, table.externalId),
  index("workspace_profiles_tenant_id_idx").on(table.tenantId),
  index("workspace_profiles_tenant_email_idx").on(table.tenantId, table.email),
  index("workspace_profiles_tenant_department_idx").on(table.tenantId, table.department),
  pgPolicy("tenant_isolation", {
    as: "restrictive",
    for: "all",
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  }),
]);
```

### Sync Strategy

```
Admin connects workspace ->
  workspace_tokens row created ->
  Immediate: fire-and-forget first sync (server action) ->
    Fetch People API directory contacts (paginated, max 500/request) ->
    Upsert workspace_profiles rows ->
    Match email to existing users table (set userId FK) ->
    Update workspace_tokens.lastSyncAt = now(), syncStatus = 'synced'

Daily cron: /api/cron/workspace-sync ->
  For each tenant with active workspace_tokens where syncStatus != 'error':
    Re-fetch and upsert profiles
    Remove profiles not in latest sync (employee left org)
```

**Key constraint:** Only tenant admins can connect Workspace. The `/api/workspace/connect` route must verify `session.user.role === "admin"` before initiating.

### Diagnostic Queries

New service file: `packages/db/src/services/workspace-diagnostics.ts`

```typescript
export interface DepartmentStats {
  department: string;
  totalEmployees: number;
  activeUsers: number;        // matched to EverySkill users
  skillsCreated: number;
  skillsUsed: number;
  adoptionPercent: number;    // activeUsers / totalEmployees * 100
}

export async function getDepartmentAdoption(tenantId: string): Promise<DepartmentStats[]>;
export async function getTopDepartments(tenantId: string, limit?: number): Promise<DepartmentStats[]>;
export async function getUnmatchedEmployees(tenantId: string): Promise<WorkspaceProfile[]>;
```

Example SQL for department adoption:

```sql
SELECT
  wp.department,
  COUNT(DISTINCT wp.id) as total_employees,
  COUNT(DISTINCT u.id) as active_users,
  COUNT(DISTINCT s.id) as skills_created,
  COUNT(DISTINCT ue.id) as skills_used,
  ROUND(
    COUNT(DISTINCT u.id)::numeric /
    NULLIF(COUNT(DISTINCT wp.id), 0) * 100, 1
  ) as adoption_pct
FROM workspace_profiles wp
LEFT JOIN users u ON u.email = wp.email AND u.tenant_id = wp.tenant_id
LEFT JOIN skills s ON s.author_id = u.id AND s.tenant_id = wp.tenant_id
LEFT JOIN usage_events ue ON ue.user_id = u.id AND ue.tenant_id = wp.tenant_id
WHERE wp.tenant_id = $1
GROUP BY wp.department
ORDER BY adoption_pct DESC;
```

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/workspace-profiles.ts` | Directory profile cache |
| `packages/db/src/services/workspace-profiles.ts` | CRUD, sync operations |
| `packages/db/src/services/workspace-diagnostics.ts` | Analytics queries |
| `apps/web/lib/workspace-sync.ts` | Google API fetch + sync orchestration |
| `apps/web/app/actions/workspace.ts` | Server actions for connect/disconnect/sync |
| `apps/web/app/api/cron/workspace-sync/route.ts` | Daily sync cron endpoint |
| `apps/web/app/(protected)/admin/workspace/page.tsx` | Admin workspace settings page |
| `apps/web/components/workspace-connect-button.tsx` | Connect/disconnect UI |
| `apps/web/components/workspace-diagnostics-dashboard.tsx` | Department stats dashboard |

---

## 3. Skill Visibility Scoping

### Adding Visibility to Skills

```typescript
// Add to skills table in packages/db/src/schema/skills.ts:
visibility: text("visibility").notNull().default("tenant"),
// Three levels:
// 'global'   - visible across all tenants (curated marketplace content)
// 'tenant'   - visible to everyone in same tenant (current default behavior)
// 'personal' - visible only to the author
```

### Migration

```sql
-- 0019_add_skill_visibility.sql
ALTER TABLE skills ADD COLUMN visibility text NOT NULL DEFAULT 'tenant';
CREATE INDEX skills_visibility_idx ON skills (visibility);
```

**Default `'tenant'`** ensures all existing skills retain current behavior. No data backfill needed.

### RLS Complication and Solution

The current RLS policy is: `tenant_id = current_setting('app.current_tenant_id', true)`. This blocks ALL cross-tenant reads, including `visibility = 'global'` skills from other tenants.

**Two options:**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| A: Materialized view | Separate `global_skills_mv` view outside RLS | Keeps RLS strict; simple read path | Requires refresh on publish; adds view maintenance |
| B: Modified RLS policy | `OR visibility = 'global'` in RLS USING clause | No extra infrastructure | Weakens RLS guarantee; every query now checks visibility |

**Recommendation: Defer global visibility to a later phase.** For v3.0, implement `tenant` and `personal` only. These do not require RLS changes:

- `tenant` visibility: already handled by RLS (same tenant can see)
- `personal` visibility: add `AND (visibility != 'personal' OR author_id = $userId)` to queries

`global` visibility is a marketplace feature that requires careful design (content curation, cross-tenant embedding search, etc.) and should be a separate phase.

### Visibility Query Filter

```typescript
// packages/db/src/services/visibility.ts
import { sql, eq, or, and } from "drizzle-orm";
import { skills } from "../schema/skills";

/**
 * Build a WHERE condition that respects visibility rules.
 * Must be combined with existing status='published' filter.
 */
export function visibilityFilter(userId: string | null) {
  if (!userId) {
    // Unauthenticated: only tenant-visible (RLS handles tenant scoping)
    return eq(skills.visibility, "tenant");
  }

  // Authenticated: tenant-visible OR (personal AND authored by this user)
  return or(
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
  );
}
```

### Files Modified

| File | Change |
|------|--------|
| `packages/db/src/schema/skills.ts` | Add `visibility` column |
| `packages/db/src/services/search-skills.ts` | Add visibility filter to WHERE clause |
| `packages/db/src/services/semantic-search.ts` | Add visibility filter to WHERE clause |
| `apps/web/lib/search-skills.ts` | Pass userId for visibility, add filter |
| `apps/web/app/actions/search.ts` | Pass session userId to search |
| `apps/web/app/actions/skills.ts` | Accept visibility on create/edit |
| `apps/web/app/(protected)/skills/new/page.tsx` | Visibility selector in form |

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/services/visibility.ts` | Visibility condition builder |
| `apps/web/components/visibility-selector.tsx` | UI dropdown for visibility choice |
| Migration `0019_add_skill_visibility.sql` | Column addition |

---

## 4. Intent Search Architecture

### Current Search Limitations

The existing search has two modes that operate independently:
1. **Full-text:** `websearch_to_tsquery` + ILIKE fallback -- keyword matching, field-weighted scoring
2. **Semantic:** pgvector `cosineDistance` on Voyage AI / Ollama embeddings -- meaning matching

Neither mode understands user intent. "I need to summarize meeting notes" should find workflow skills about meeting summarization, not just skills with "meeting" in the title. The full-text search misses conceptual matches; the semantic search misses exact keyword matches.

### Recommended Architecture: Hybrid Search with Optional Intent Classification

**Do NOT build conversational multi-turn search.** Research (arxiv 2602.09552) confirms that for single-domain QA, the complexity of multi-turn RAG yields marginal improvement over well-tuned single-query approaches. For a skill marketplace with <10K skills per tenant, single-query hybrid search is the right tradeoff.

**Architecture:**

```
User Query: "help me write better emails"
    |
    +---> [Parallel, no dependency between branches]
    |
    |     +---> Intent Classifier (Claude Haiku, <500ms, optional)
    |     |     Output: { category: "prompt", semanticQuery: "email writing improvement" }
    |     |
    |     +---> Full-Text Search (existing searchSkills, ~50ms)
    |     |     Uses: websearch_to_tsquery + ILIKE + field-weighted scoring
    |     |
    |     +---> Semantic Search (existing semanticSearchSkills, ~100ms)
    |           Uses: Voyage AI / Ollama embedding -> pgvector cosine distance
    |
    v
Reciprocal Rank Fusion (RRF, k=60)
    |
    v
Optional: Preference Boost (if user_preferences exist)
    |
    v
Visibility Filter (tenant + personal)
    |
    v
Ranked Results (top 10)
```

### Reciprocal Rank Fusion (RRF)

RRF is the standard method for combining two ranked lists without tuning weights. Each result gets `1 / (k + rank)` from each retrieval method; scores are summed.

```typescript
// packages/db/src/services/hybrid-search.ts

export interface HybridSearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  ftsRank?: number;    // position in full-text results (1-indexed)
  semRank?: number;    // position in semantic results (1-indexed)
  rrfScore: number;    // combined RRF score
}

export function reciprocalRankFusion(
  ftsResults: { id: string }[],
  semanticResults: { id: string }[],
  k: number = 60
): Map<string, { ftsRank?: number; semRank?: number; rrfScore: number }> {
  const scores = new Map<string, { ftsRank?: number; semRank?: number; rrfScore: number }>();

  ftsResults.forEach((r, i) => {
    const rank = i + 1;
    const existing = scores.get(r.id) || { rrfScore: 0 };
    existing.ftsRank = rank;
    existing.rrfScore += 1 / (k + rank);
    scores.set(r.id, existing);
  });

  semanticResults.forEach((r, i) => {
    const rank = i + 1;
    const existing = scores.get(r.id) || { rrfScore: 0 };
    existing.semRank = rank;
    existing.rrfScore += 1 / (k + rank);
    scores.set(r.id, existing);
  });

  return scores;
}
```

### Intent Classifier (Optional Enhancement)

Use Claude Haiku for fast, cheap query intent extraction. This runs in PARALLEL with search -- it does not add latency if it finishes before results come back. If it times out (>500ms), fall back to pure RRF.

```typescript
// apps/web/lib/intent-classifier.ts
import Anthropic from "@anthropic-ai/sdk";

interface SearchIntent {
  category?: "prompt" | "workflow" | "agent" | "mcp";
  taskType?: string;        // "summarize", "generate", "analyze", etc.
  keywords: string[];       // extracted key terms for FTS boost
  semanticQuery: string;    // rephrased query for better embedding
}

export async function classifyIntent(query: string): Promise<SearchIntent | null> {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await Promise.race([
      client.messages.create({
        model: "claude-haiku-4-20250414",
        max_tokens: 256,
        system: "Extract search intent from user queries for an AI skill marketplace. Return JSON only.",
        messages: [{ role: "user", content: `Classify this search query: "${query}"` }],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ]);

    if (!response) return null;  // timeout
    // parse and return
  } catch {
    return null;  // graceful degradation
  }
}
```

**Cost analysis:** Claude Haiku at ~$0.25/M input tokens and ~$1.25/M output tokens. A typical search query is ~50 tokens input + ~100 tokens output = ~$0.00014 per search. At 1000 searches/day = $0.14/day. Negligible.

### Preference Boost

Applied AFTER RRF, not during retrieval. Keeps search deterministic and debuggable.

```typescript
// Small additive boost, not multiplicative (prevents preferences from dominating)
function applyPreferenceBoost(
  rrfScores: Map<string, { rrfScore: number; category?: string }>,
  preferences: { preferredCategories: string[] }
): Map<string, { rrfScore: number }> {
  const CATEGORY_BOOST = 0.002;  // ~equivalent to moving up 1 rank in a 60-item list

  for (const [id, score] of rrfScores) {
    if (score.category && preferences.preferredCategories.includes(score.category)) {
      score.rrfScore += CATEGORY_BOOST;
    }
  }

  return rrfScores;
}
```

### Modified Search Flow

The existing `quickSearch` server action in `apps/web/app/actions/search.ts` currently calls `searchSkills()` (FTS only). Modify it to use hybrid search:

```typescript
// apps/web/app/actions/search.ts (modified)
export async function quickSearch(query: string): Promise<QuickSearchResult[]> {
  if (!query?.trim()) return [];

  const session = await auth();
  const userId = session?.user?.id;

  // Run FTS, semantic, and intent classification in parallel
  const [ftsResults, semanticResults, intent] = await Promise.all([
    searchSkills({ query: query.trim() }),
    trySemanticSearch(query.trim()),  // returns [] if embeddings not configured
    classifyIntent(query.trim()),     // returns null on timeout/error
  ]);

  // Merge with RRF
  const rrfScores = reciprocalRankFusion(ftsResults, semanticResults);

  // Apply preference boost if user has preferences
  if (userId) {
    const prefs = await getUserPreferences(userId);
    if (prefs) applyPreferenceBoost(rrfScores, prefs);
  }

  // Sort by RRF score, take top 10
  // ... (merge back full result data from ftsResults + semanticResults)
}
```

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/services/hybrid-search.ts` | RRF merge logic |
| `apps/web/lib/intent-classifier.ts` | Claude Haiku intent extraction |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/app/actions/search.ts` | Use hybrid search |
| `apps/web/lib/search-skills.ts` | Accept visibility filter param |
| `apps/web/components/search-with-dropdown.tsx` | Show search mode indicator (optional) |

---

## 5. Personal Preferences Storage

### Schema

```typescript
// packages/db/src/schema/user-preferences.ts
export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Search preferences
  preferredCategories: text("preferred_categories").array().default([]),
  savedSearches: jsonb("saved_searches").$type<SavedSearch[]>().default([]),

  // Display preferences
  defaultView: text("default_view").default("grid"),   // "grid" | "list"
  homepageTab: text("homepage_tab").default("browse"),  // "browse" | "leverage"

  // Notification preferences already live in notification_preferences table
  // DO NOT duplicate them here

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_preferences_tenant_user_unique").on(table.tenantId, table.userId),
  index("user_preferences_tenant_id_idx").on(table.tenantId),
  pgPolicy("tenant_isolation", {
    as: "restrictive",
    for: "all",
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  }),
]);

interface SavedSearch {
  name: string;
  query: string;
  filters: Record<string, string>;
  createdAt: string;  // ISO string
}
```

### Sync Mechanism

Preferences are **server-authoritative** (not localStorage). Client reads on page load via server component, writes on change via server action. No real-time sync needed -- preferences change infrequently.

```typescript
// apps/web/app/actions/preferences.ts
"use server";

export async function getPreferences(): Promise<UserPreferences | null>;
export async function updatePreferences(updates: Partial<UpdateablePreferences>): Promise<void>;
export async function addSavedSearch(search: SavedSearch): Promise<void>;
export async function removeSavedSearch(name: string): Promise<void>;
```

**Why NOT localStorage:** Preferences must be available server-side for search ranking (preference boost). localStorage is not accessible in server components/actions. Server-authoritative storage also gives multi-device sync for free.

### Search History (For Preference Learning)

```typescript
// packages/db/src/schema/search-history.ts
export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  resultCount: integer("result_count"),
  clickedSkillId: text("clicked_skill_id"),  // which result they clicked (nullable)
  searchMode: text("search_mode"),  // "fts" | "semantic" | "hybrid"
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("search_history_tenant_id_idx").on(table.tenantId),
  index("search_history_user_created_idx").on(table.userId, table.createdAt),
  pgPolicy("tenant_isolation", {
    as: "restrictive",
    for: "all",
    using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  }),
]);
```

**Retention:** Delete entries older than 90 days via `/api/cron/cleanup` (add to existing cron infrastructure). Search history is fire-and-forget (write errors silently ignored).

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/user-preferences.ts` | Preferences schema |
| `packages/db/src/schema/search-history.ts` | Search history schema |
| `packages/db/src/services/user-preferences.ts` | CRUD operations |
| `packages/db/src/services/search-history.ts` | Write + query operations |
| `apps/web/app/actions/preferences.ts` | Server actions |
| `apps/web/components/saved-searches.tsx` | Saved searches UI |
| `apps/web/app/(protected)/settings/preferences/page.tsx` | Preferences page |

---

## 6. Loom Video Integration

### Approach: URL-Only Storage + Client-Side iframe Embed

**Do NOT use the Loom SDK.** Loom does not have an open API. Their SDK (`@loomhq/loom-embed`, ~45KB) is client-side only and primarily useful for recording workflows (which EverySkill does not need). Simple iframe embed provides identical viewing experience with zero bundle cost.

### Schema Change

```typescript
// Add to skills table in packages/db/src/schema/skills.ts:
loomUrl: text("loom_url"),  // nullable, e.g. "https://www.loom.com/share/abc123def456"
```

Single column addition on existing table. No separate table needed.

### Migration

```sql
-- 0020_add_loom_url.sql
ALTER TABLE skills ADD COLUMN loom_url text;
```

### URL Validation

```typescript
// apps/web/lib/loom.ts
const LOOM_URL_PATTERN = /^https:\/\/(www\.)?loom\.com\/share\/[a-zA-Z0-9]+(\?.*)?$/;

export function isValidLoomUrl(url: string): boolean {
  return LOOM_URL_PATTERN.test(url);
}

export function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export function getLoomEmbedUrl(shareUrl: string): string | null {
  const id = extractLoomId(shareUrl);
  return id ? `https://www.loom.com/embed/${id}` : null;
}
```

### Client-Side Embed Component

```typescript
// apps/web/components/loom-embed.tsx
"use client";

import { extractLoomId } from "@/lib/loom";

interface LoomEmbedProps {
  url: string;
}

export function LoomEmbed({ url }: LoomEmbedProps) {
  const loomId = extractLoomId(url);
  if (!loomId) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={`https://www.loom.com/embed/${loomId}`}
        className="absolute inset-0 h-full w-full"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
```

### Integration Points

| File | Change |
|------|--------|
| `packages/db/src/schema/skills.ts` | Add `loomUrl` column |
| `apps/web/app/actions/skills.ts` | Validate + save loomUrl on create/edit |
| `apps/web/components/skill-detail.tsx` | Render `<LoomEmbed>` when loomUrl present |
| `apps/web/app/(protected)/skills/new/page.tsx` | Loom URL input field in form |

### New Files

| File | Purpose |
|------|---------|
| `apps/web/components/loom-embed.tsx` | Responsive iframe embed |
| `apps/web/lib/loom.ts` | URL validation + ID extraction |
| Migration `0020_add_loom_url.sql` | Column addition |

---

## 7. Homepage Redesign: New Data Requirements

### Current Homepage Data Flow

The existing homepage (`apps/web/app/(protected)/page.tsx`) fetches 8 parallel queries:
1. `getPlatformStats()` -- FTE years saved, total uses, total downloads, avg rating
2. `getPlatformStatTrends()` -- sparkline data for stat cards
3. `getTrendingSkills(6)` -- top 6 trending skills
4. `getLeaderboard(5)` -- top 5 contributors
5-8. My Leverage data (skills used/created + stats for each)

### New Data for v3.0 Homepage

| Data Need | Source | Status |
|-----------|--------|--------|
| Personalized skill recommendations | Hybrid search with empty query + user preferences + usage history | New |
| "Continue where you left off" (recently used) | `usageEvents` for current user, last 5 | New query |
| Saved searches | `userPreferences.savedSearches` | New (requires preferences) |
| Department leaderboard | `workspaceProfiles` + `usageEvents` cross-ref | New (requires workspace) |
| Loom video highlights | Skills with `loomUrl`, sorted by trending | New query filter |
| Quick actions based on role | `session.user.role` + user preferences | Existing data, new UI |

### Personalized Feed Service

```typescript
// apps/web/lib/personalized-feed.ts

export interface PersonalizedFeed {
  recommendations: SkillSummary[];    // based on usage patterns + preferences
  recentlyUsed: SkillSummary[];       // last 5 skills used by this user
  savedSearches: SavedSearch[];       // from user_preferences
  departmentTrending?: SkillSummary[]; // trending in user's department (requires workspace)
}

export async function getPersonalizedFeed(
  userId: string,
  tenantId: string
): Promise<PersonalizedFeed> {
  const [prefs, recentUsage, departmentSkills] = await Promise.all([
    getUserPreferences(userId, tenantId),
    getRecentlyUsedSkills(userId, 5),
    getWorkspaceDepartmentSkills(userId, tenantId).catch(() => undefined),
  ]);

  // Generate recommendations based on:
  // 1. Categories the user hasn't explored (from preferences)
  // 2. Skills popular in their department (from workspace)
  // 3. Skills similar to ones they've used (from usage history + embeddings)
  const recommendations = await generateRecommendations(userId, tenantId, prefs, recentUsage);

  return {
    recommendations,
    recentlyUsed: recentUsage,
    savedSearches: prefs?.savedSearches ?? [],
    departmentTrending: departmentSkills,
  };
}
```

### Homepage Component Architecture

```
HomePage (server component)
  |
  +-- WelcomeSection (personalized greeting + quick actions)
  |     - First name from session
  |     - "Create a Skill" + "Browse Skills" CTAs (existing)
  |     - Quick access to saved searches (new)
  |
  +-- SearchBar (enhanced intent search)
  |     - SearchWithDropdown with hybrid backend (modified)
  |
  +-- HomeTabs (existing component, new tab added)
       |
       +-- BrowseTab
       |    +-- PersonalizedRecommendations (new, replaces plain trending for logged-in users)
       |    +-- TrendingSection (existing, kept as fallback / anonymous view)
       |    +-- LeaderboardTable (existing)
       |    +-- DepartmentHighlights (new, only if workspace connected)
       |
       +-- LeverageTab (existing MyLeverageView, unchanged)
       |
       +-- SavedTab (new, saved searches with one-click re-run)
```

### Graceful Degradation

The homepage MUST work without any v3.0 features enabled:
- No workspace connected? Skip department highlights, show trending instead
- No preferences saved? Show default trending skills
- No embeddings? Recommendations based on usage history only (no semantic similarity)
- No search history? Show popular skills across tenant

This is achieved by having each data function return sensible empty defaults and using conditional rendering.

---

## Complete New Tables Summary

| Table | Purpose | Columns (key) | Tenant-scoped | RLS |
|-------|---------|---------------|--------------|-----|
| `workspace_tokens` | Encrypted Google API tokens | tenantId, userId, accessTokenEncrypted, refreshTokenEncrypted, scope, syncStatus | Yes | Yes |
| `workspace_profiles` | Cached directory data | tenantId, userId (FK, nullable), externalId, email, department, title, orgUnitPath | Yes | Yes |
| `user_preferences` | Search/display prefs | tenantId, userId, preferredCategories, savedSearches, defaultView, homepageTab | Yes | Yes |
| `search_history` | Query analytics | tenantId, userId, query, resultCount, clickedSkillId, searchMode | Yes | Yes |

### Modified Tables

| Table | Column Added | Type | Default | Migration |
|-------|-------------|------|---------|-----------|
| `skills` | `visibility` | `text NOT NULL` | `'tenant'` | 0019 |
| `skills` | `loom_url` | `text` (nullable) | `NULL` | 0020 |

### Migration Sequence

```
0019_add_skill_visibility.sql       -- skills.visibility column
0020_add_loom_url.sql               -- skills.loom_url column
0021_create_workspace_tokens.sql    -- new table
0022_create_workspace_profiles.sql  -- new table
0023_create_user_preferences.sql    -- new table
0024_create_search_history.sql      -- new table
```

---

## Complete New File Inventory

### Schema Files (`packages/db/src/schema/`)
| File | Status | Purpose |
|------|--------|---------|
| `workspace-tokens.ts` | NEW | Token storage schema |
| `workspace-profiles.ts` | NEW | Directory profile cache |
| `user-preferences.ts` | NEW | User preferences schema |
| `search-history.ts` | NEW | Search analytics schema |
| `skills.ts` | MODIFIED | Add visibility, loomUrl columns |
| `index.ts` | MODIFIED | Export new schemas |

### Service Files (`packages/db/src/services/`)
| File | Status | Purpose |
|------|--------|---------|
| `workspace-tokens.ts` | NEW | Token CRUD + refresh |
| `workspace-profiles.ts` | NEW | Profile CRUD + sync |
| `workspace-diagnostics.ts` | NEW | Analytics queries |
| `hybrid-search.ts` | NEW | RRF merge logic |
| `visibility.ts` | NEW | Visibility condition builder |
| `user-preferences.ts` | NEW | Preferences CRUD |
| `search-history.ts` | NEW | History write + query |
| `semantic-search.ts` | MODIFIED | Add visibility filter |
| `search-skills.ts` | MODIFIED | Add visibility filter |

### Relations (`packages/db/src/relations/`)
| File | Status | Change |
|------|--------|--------|
| `index.ts` | MODIFIED | Add relations for 4 new tables |

### API Routes (`apps/web/app/api/`)
| File | Status | Purpose |
|------|--------|---------|
| `workspace/connect/route.ts` | NEW | Initiate OAuth |
| `workspace/callback/route.ts` | NEW | OAuth callback |
| `workspace/disconnect/route.ts` | NEW | Revoke tokens |
| `workspace/sync/route.ts` | NEW | Manual sync trigger |
| `workspace/status/route.ts` | NEW | Connection status |
| `cron/workspace-sync/route.ts` | NEW | Daily sync cron |

### Server Actions (`apps/web/app/actions/`)
| File | Status | Purpose |
|------|--------|---------|
| `workspace.ts` | NEW | Workspace management |
| `preferences.ts` | NEW | User preferences |
| `search.ts` | MODIFIED | Hybrid search integration |

### Lib Files (`apps/web/lib/`)
| File | Status | Purpose |
|------|--------|---------|
| `token-encryption.ts` | NEW | AES-256-GCM token encrypt/decrypt |
| `google-workspace-client.ts` | NEW | Google API wrapper |
| `workspace-sync.ts` | NEW | Sync orchestration |
| `intent-classifier.ts` | NEW | Claude Haiku intent extraction |
| `loom.ts` | NEW | URL validation + ID extraction |
| `personalized-feed.ts` | NEW | Homepage data aggregation |
| `search-skills.ts` | MODIFIED | Visibility + hybrid support |

### Components (`apps/web/components/`)
| File | Status | Purpose |
|------|--------|---------|
| `loom-embed.tsx` | NEW | Responsive iframe embed |
| `workspace-connect-button.tsx` | NEW | Connect/disconnect UI |
| `workspace-diagnostics-dashboard.tsx` | NEW | Department stats |
| `visibility-selector.tsx` | NEW | Visibility dropdown |
| `saved-searches.tsx` | NEW | Saved search list + re-run |
| `personalized-feed.tsx` | NEW | Recommendation cards |
| `search-with-dropdown.tsx` | MODIFIED | Enhanced with hybrid backend |
| `skill-detail.tsx` | MODIFIED | Loom embed rendering |

### Pages (`apps/web/app/(protected)/`)
| File | Status | Purpose |
|------|--------|---------|
| `admin/workspace/page.tsx` | NEW | Workspace settings |
| `settings/preferences/page.tsx` | NEW | User preferences |
| `page.tsx` | MODIFIED | Homepage redesign |

---

## Patterns to Follow

### Pattern 1: Fire-and-Forget for Non-Critical Side Effects
**What:** Embedding generation, search history logging, workspace sync triggers use `.catch(() => {})`.
**When:** Side effects that should not block the primary operation.
**Already used:** `generateSkillEmbedding` in `apps/web/lib/embedding-generator.ts` swallows all errors.
**Apply to:** `logSearchQuery()`, `triggerWorkspaceSync()`, `classifyIntent()` timeout fallback.

### Pattern 2: Parallel Data Fetching with Promise.all
**What:** Independent queries run in parallel.
**When:** Homepage data (currently 8 queries), search (FTS + semantic + intent).
**Already used:** Homepage and skill detail page.
**Apply to:** `getPersonalizedFeed()`, hybrid search pipeline.

### Pattern 3: Graceful Degradation
**What:** Features work without optional integrations.
**When:** Workspace not connected, embeddings not configured, intent classifier down.
**Implementation:** Every new service returns sensible defaults when its dependency is unavailable. Never throw from an optional feature -- return empty/default and let the UI handle it.

### Pattern 4: Schema Conventions (Mandatory for All New Tables)
Every new table MUST have:
```typescript
id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
tenantId: text("tenant_id").notNull().references(() => tenants.id),
// In table config:
index("TABLE_NAME_tenant_id_idx").on(table.tenantId),
pgPolicy("tenant_isolation", {
  as: "restrictive",
  for: "all",
  using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
}),
```
Plus type exports and relation definitions.

### Pattern 5: Admin Guards
**What:** Admin-only features check `session.user.role === "admin"` at both page and action level.
**When:** Workspace connection, diagnostic dashboard, any tenant-level settings.
**Already used:** Admin review pages, admin skills management.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Auth.js Scope Expansion
**What:** Adding workspace scopes to the existing Google SSO provider in `auth.config.ts`.
**Why bad:** Auth.js v5 does not support incremental authorization. The stored token becomes invalid, scope tracking breaks, and users who decline extra scopes may get locked out of regular SSO.
**Instead:** Separate OAuth flow via custom API routes.

### Anti-Pattern 2: Full Directory Sync
**What:** Syncing all Google Workspace user data (photos, phone numbers, addresses, group memberships, etc.).
**Why bad:** Privacy concerns, storage bloat, GDPR/SOC2 implications, stale data problems. Directory data can be hundreds of MB for large organizations.
**Instead:** Cache only 7 fields needed for analytics (email, name, department, title, orgUnitPath, managerId, thumbnailUrl). Delete all data on workspace disconnect.

### Anti-Pattern 3: Multi-Turn Conversational Search
**What:** Building a chatbot-style search with session memory and follow-up questions.
**Why bad:** For a skill marketplace with <10K items per tenant, conversational search adds enormous complexity (session management, context window, per-request cost, conversation cleanup) with marginal improvement over intent-enhanced single query. Research confirms this (arxiv 2602.09552: "effective conversational RAG depends less on method complexity than on alignment between the retrieval strategy and the dataset structure").
**Instead:** Single-query hybrid search with RRF. If multi-turn is later needed, it layers on top without rearchitecting.

### Anti-Pattern 4: Loom SDK Server-Side Usage
**What:** Importing `@loomhq/loom-embed` in server components or using undocumented Loom API endpoints.
**Why bad:** Loom has no open API. The SDK is client-only (45KB bundle). Server-side usage will fail.
**Instead:** Store URL string, validate format client-side, render via responsive iframe.

### Anti-Pattern 5: Storing Preferences in localStorage
**What:** Using browser storage for user preferences.
**Why bad:** Not accessible server-side (can't use for search ranking), lost on device switch, no multi-device sync, not auditable.
**Instead:** Server-authoritative `user_preferences` table, read via server component on page load.

### Anti-Pattern 6: Modifying RLS for Global Visibility
**What:** Adding `OR visibility = 'global'` to the RLS policy to allow cross-tenant reads.
**Why bad:** Weakens the tenant isolation guarantee. Every query now implicitly can read other tenants' data if visibility is misconfigured. One bug = data leak.
**Instead:** For v3.0, implement only `tenant` and `personal` visibility (both work within existing RLS). Defer `global` to a later phase with a dedicated solution (materialized view or separate API).

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|-------------|-------------|-------------|
| Hybrid search latency | <300ms (FTS + semantic + intent parallel) | <500ms (HNSW index tuning) | Dedicated search service needed |
| Workspace sync | Inline in request (~2s for 100 employees) | Background job, paginated | Queue-based with Google API rate limiting |
| Preference reads | Direct DB query (~5ms) | Cache in JWT claims (add preferredCategories) | Redis cache layer |
| Search history writes | Fire-and-forget INSERT (~2ms) | Partition by month | TimescaleDB or archive to cold storage |
| Intent classification | Per-query Claude Haiku (~$0.0002) | Cache common queries (LRU, 1h TTL) | Pre-computed intent categories per skill |
| Loom embeds | Direct iframe load from Loom CDN | Same (Loom handles CDN) | Same |

---

## Build Order (Dependency-Driven)

```
Phase 1: Foundation (no dependencies)
  +-- Visibility scoping (schema + service + query mods)
  +-- Loom URL integration (schema + component)
  +-- User preferences table + service

Phase 2: Search Enhancement (depends on Phase 1 visibility + preferences)
  +-- Hybrid search service (RRF merge)
  +-- Intent classifier (optional, graceful degradation)
  +-- Search history tracking
  +-- Modified search components

Phase 3: Workspace Integration (independent of Phase 2)
  +-- Token encryption library
  +-- Workspace OAuth routes
  +-- workspace_tokens + workspace_profiles tables
  +-- Google API client + sync service
  +-- Diagnostic queries
  +-- Admin workspace settings page

Phase 4: Homepage Redesign (depends on Phases 1-3)
  +-- Personalized feed service
  +-- New homepage components
  +-- Saved searches UI
  +-- Department highlights (requires Phase 3)
  +-- Integration of all v3.0 features into unified experience
```

**Phase ordering rationale:**
- Phase 1 has zero dependencies and modifies the skills table that everything else reads. Do it first.
- Phase 2 depends on visibility (search must respect it) and preferences (boost uses them). Both from Phase 1.
- Phase 3 is independent of search -- workspace integration is a self-contained feature. Can parallel with Phase 2.
- Phase 4 ties everything together. It needs personalized data (Phase 2), workspace data (Phase 3), and visibility (Phase 1).

---

## Sources

- [Auth.js Incremental Authorization Discussion #10261](https://github.com/nextauthjs/next-auth/discussions/10261) -- HIGH confidence: confirms Auth.js v5 does not support incremental scope expansion
- [Auth.js Configuring OAuth Providers](https://authjs.dev/guides/configuring-oauth-providers) -- MEDIUM confidence: shows scope override pattern
- [Google Incremental Authorization](https://developers.google.com/identity/sign-in/web/incremental-auth) -- HIGH confidence: official docs on how incremental auth works at the OAuth2 level
- [Google Admin SDK Directory API Overview](https://developers.google.com/workspace/admin/directory/v1/guides) -- HIGH confidence: official docs
- [Google People API Directory Contacts](https://developers.google.com/people/v1/directory) -- HIGH confidence: scope requirements for directory access
- [Domain-Wide Delegation Best Practices](https://support.google.com/a/answer/14437356) -- HIGH confidence: why to avoid DWD when possible
- [Loom Embed SDK API](https://dev.loom.com/docs/embed-sdk/api) -- MEDIUM confidence: confirms client-only SDK, oEmbed metadata fields
- [Loom Embed Documentation](https://support.atlassian.com/loom/docs/embed-your-video-into-a-webpage/) -- MEDIUM confidence: iframe embed pattern
- [Hybrid Search in PostgreSQL (ParadeDB)](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual) -- MEDIUM confidence: RRF and hybrid search patterns
- [Hybrid Search with pgvector (Jonathan Katz)](https://jkatz05.com/post/postgres/hybrid-search-postgres-pgvector/) -- MEDIUM confidence: PostgreSQL-specific hybrid search
- [RAG Methods Comparison (arxiv 2602.09552)](https://arxiv.org/abs/2602.09552) -- MEDIUM confidence: single-query vs multi-turn RAG effectiveness
- Direct codebase analysis of all referenced files (HIGH confidence):
  - `packages/db/src/schema/*.ts` (all 17 schema files)
  - `packages/db/src/services/*.ts` (all 21 service files)
  - `packages/db/src/client.ts`, `packages/db/src/tenant-context.ts`
  - `packages/db/src/relations/index.ts`
  - `apps/web/auth.ts`, `apps/web/auth.config.ts`, `apps/web/middleware.ts`
  - `apps/web/app/actions/search.ts`, `apps/web/lib/search-skills.ts`
  - `apps/web/lib/ai-review.ts`, `apps/web/lib/embedding-generator.ts`
  - `apps/web/components/search-with-dropdown.tsx`
  - `apps/web/app/(protected)/page.tsx` (homepage)
  - `apps/web/app/(protected)/skills/[slug]/page.tsx` (skill detail)
