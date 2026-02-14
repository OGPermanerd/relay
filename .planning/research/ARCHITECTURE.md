# Architecture Patterns: Gmail Workflow Diagnostic

**Domain:** Gmail-integrated workflow analysis for AI skill recommendation
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH (Auth.js integration patterns verified via official docs and codebase; Gmail API patterns verified via Google official docs; some Auth.js incremental scope handling is LOW confidence due to limited v5 documentation)

---

## Existing System Overview (Verified via Codebase)

### Current Architecture Summary

- **Monorepo:** `packages/db` (Drizzle ORM 0.42.0, PostgreSQL 15 + pgvector) + `apps/web` (Next.js 16.1.6) + `apps/mcp`
- **Auth:** Auth.js v5 with JWT strategy, Google SSO (`openid email profile` scopes), domain-scoped cookies, 8h session, domain-to-tenant mapping
- **Multi-tenancy:** All 17+ tables have `tenant_id` NOT NULL FK, RLS policies via `app.current_tenant_id`
- **AI:** Anthropic Claude for structured output (ai-review.ts pattern), Voyage AI / Ollama for embeddings
- **Search:** Hybrid search with pgvector + full-text + RRF in `packages/db/src/services/hybrid-search.ts`
- **Analytics:** Recharts 3.7.0, existing dashboard at `/analytics` with tabs, stat cards, time range selector

### Key Existing Accounts Schema

The `accounts` table (managed by Auth.js DrizzleAdapter) stores `access_token`, `refresh_token`, `scope`, `expires_at` for the Google identity provider. These are IDENTITY tokens used for SSO -- NOT API access tokens.

---

## Recommended Architecture

### High-Level Data Flow

```
User clicks "Analyze My Workflow"
        |
        v
[1] Incremental OAuth Consent
    (separate OAuth redirect with gmail.metadata scope)
        |
        v
[2] Callback stores access_token + refresh_token
    in `gmail_tokens` table (encrypted at rest, AES-256-GCM)
        |
        v
[3] Server action: fetchGmailMetadata()
    - Reads + decrypts access_token from gmail_tokens
    - Refreshes if expired (using refresh_token)
    - Calls Gmail API messages.list + messages.get(format: 'metadata')
    - Extracts: sender domains, frequency, subject patterns, labels
    - NEVER reads email bodies -- metadata headers only
        |
        v
[4] Server action: analyzeWorkflow()
    - Aggregates metadata into anonymous patterns (no PII sent to AI)
    - Passes patterns to Claude via Anthropic API
    - Returns structured JSON via output_config schema (same pattern as ai-review.ts)
        |
        v
[5] Persist diagnostic snapshot
    - Store results in `workflow_diagnostics` table (JSONB)
    - Match recommended skills via existing hybrid search
    - Store matches in `diagnostic_skill_matches` table
        |
        v
[6] Render dashboard
    - /workflow-diagnostic page with Recharts visualizations
    - Time breakdown pie chart, automation opportunity cards
    - Skill recommendation cards linking to existing /skills/[slug] pages
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| **Gmail OAuth Flow** | Incremental consent, token storage, refresh | `apps/web/lib/gmail-auth.ts` | Google OAuth, gmail_tokens table |
| **Gmail Metadata Fetcher** | Fetch email metadata, aggregate patterns | `apps/web/lib/gmail-fetcher.ts` | Gmail API (googleapis), gmail_tokens |
| **Workflow Analyzer** | AI analysis of email patterns | `apps/web/lib/workflow-analyzer.ts` | Anthropic API |
| **Skill Matcher** | Match analysis to existing skills | `apps/web/lib/gmail-skill-matcher.ts` | Existing hybrid search |
| **Diagnostic Storage** | Persist snapshots and matches | `packages/db/src/services/workflow-diagnostics.ts` | PostgreSQL |
| **Dashboard UI** | Charts, recommendations, history | `apps/web/app/(protected)/workflow-diagnostic/` | Server actions, Recharts |
| **Server Actions** | Orchestrate pipeline | `apps/web/app/actions/workflow-diagnostic.ts` | All above |

### Why This Boundary Structure

1. **Gmail auth is SEPARATE from the main Auth.js flow** because Auth.js v5 does not support incremental authorization. Adding Gmail scopes to the Google provider in `auth.config.ts` would force ALL users through Gmail consent on first login. A separate OAuth flow is triggered only when users explicitly request the diagnostic feature.

2. **Fetcher is separate from analyzer** because Gmail API interaction (network, retries, pagination, rate limits) has different failure modes than AI analysis (prompt engineering, token limits, structured output). They test independently.

3. **Skill matcher REUSES existing infrastructure** -- the `hybridSearchSkills()` function in `packages/db/src/services/hybrid-search.ts` already combines full-text + semantic search with RRF. The analyzer outputs natural language descriptions of automation opportunities, which feed directly into this search pipeline.

4. **Storage follows the established pattern** -- schema in `packages/db/src/schema/`, services in `packages/db/src/services/`, every table has `tenant_id`, RLS policy, and indexes.

---

## Detailed Data Flow

### Phase A: OAuth Consent and Token Acquisition

#### Architecture Decision: gmail.metadata vs gmail.readonly

| Scope | Access | Verification Level | Recommendation |
|-------|--------|-------------------|----------------|
| `gmail.metadata` | Headers + labels only (no body/attachments) | Restricted | **USE THIS** |
| `gmail.readonly` | Full message content including body | Restricted | Overkill for this feature |

Use `gmail.metadata` because:
- We ONLY need headers (From, To, Subject, Date, List-Unsubscribe) and labels
- Both scopes are "Restricted" and require Google security assessment, BUT `gmail.metadata` explicitly prevents body access, which simplifies the privacy story
- The `gmail.metadata` scope prevents format: 'full' and format: 'raw', enforcing our privacy design at the API level

**Confidence:** HIGH -- verified via [Google Gmail API Scopes documentation](https://developers.google.com/workspace/gmail/api/auth/scopes).

#### Architecture Decision: Separate gmail_tokens Table (NOT accounts table)

Use a **SEPARATE** `gmail_tokens` table. Do NOT modify the Auth.js `accounts` table.

Reasons:
- The `accounts` table is managed by `DrizzleAdapter`. Modifying its tokens risks breaking Auth.js session management and the `jwt` callback's lazy-migration logic
- Gmail tokens have a different lifecycle (user can revoke Gmail access without logging out)
- Scope is different (`accounts` stores identity scopes; `gmail_tokens` stores API scopes)
- Allows clean "Disconnect Gmail" without affecting authentication
- Avoids the Auth.js limitation where re-consent with `prompt: consent` resets ALL scopes
- Future-proof: if Calendar or Drive scopes are added later, same pattern works

**Confidence:** HIGH -- verified by examining `apps/web/auth.ts` and the `jwt` callback which reads from the `accounts` table.

#### OAuth Flow Implementation

```
User Action: Clicks "Connect Gmail" on /workflow-diagnostic page

Server Action (connectGmail):
  1. Verify session: auth() -> session.user.id
  2. Build Google OAuth URL with:
     - client_id: process.env.AUTH_GOOGLE_ID (same creds as SSO)
     - redirect_uri: /api/gmail/callback
     - scope: "https://www.googleapis.com/auth/gmail.metadata"
     - access_type: "offline"        (ensures refresh_token is returned)
     - prompt: "consent"             (forces consent for new scope)
     - include_granted_scopes: "true" (incremental authorization)
     - login_hint: session.user.email (skip Google account picker)
     - state: HMAC-signed JSON { userId, tenantId, returnUrl }
  3. redirect() to Google consent URL

Google Consent Screen:
  "EverySkill wants to view your email message metadata
   (headers, labels) but not the email body"
  User clicks "Allow"

Callback Route (/api/gmail/callback):
  1. Verify HMAC on state parameter
  2. Exchange authorization code for tokens via Google token endpoint
  3. Encrypt access_token and refresh_token with AES-256-GCM
  4. Upsert into gmail_tokens table (keyed by tenant_id + user_id)
  5. Redirect to /workflow-diagnostic?connected=true
```

#### Why Not Auth.js signIn() with Custom Scopes?

Auth.js v5's `signIn()` function does not support per-request scope overrides. The scope must be configured statically in the Google provider's `authorization.params.scope`. Multiple GitHub discussions (#4557, #11819, #2068) confirm this limitation. The recommended workaround is exactly what we propose: a separate OAuth flow.

**Confidence:** MEDIUM -- based on multiple Auth.js GitHub discussions; official docs are sparse on this topic.

### Phase B: Email Metadata Fetching

```
Server Action (runDiagnostic):
  1. auth() -> session.user.id, session.user.tenantId
  2. getGmailTokens(userId, tenantId) -> { encryptedAccessToken, encryptedRefreshToken, expiresAt }
  3. decryptToken(encryptedAccessToken) -> accessToken
  4. If Date.now() > expiresAt:
       refreshGmailToken(decryptedRefreshToken) -> new { accessToken, expiresAt }
       Update gmail_tokens row with re-encrypted new tokens
  5. Initialize Gmail API client:
       const { google } = require('googleapis');  // or import
       const oauth2Client = new google.auth.OAuth2(
         process.env.AUTH_GOOGLE_ID,
         process.env.AUTH_GOOGLE_SECRET
       );
       oauth2Client.setCredentials({ access_token: accessToken });
       const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  6. Fetch message IDs (last 30 days, max 500):
       const listResponse = await gmail.users.messages.list({
         userId: 'me',
         maxResults: 500,
         q: 'newer_than:30d',
       });
       // Handle pagination if > 500 messages

  7. Batch fetch metadata (50 concurrent, using Promise.all in chunks):
       for each chunk of 50 message IDs:
         const metadataPromises = chunk.map(msg =>
           gmail.users.messages.get({
             userId: 'me',
             id: msg.id,
             format: 'metadata',
             metadataHeaders: ['From', 'To', 'Subject', 'Date', 'List-Unsubscribe'],
           })
         );
         const results = await Promise.all(metadataPromises);

  8. Aggregate into WorkflowMetadata (in-memory only):
       interface WorkflowMetadata {
         totalMessages: number;
         dateRange: { start: string; end: string };
         senderDomainDistribution: { domain: string; count: number }[];
         topSenderDomains: { domain: string; count: number; isInternal: boolean }[];
         temporalDistribution: { hour: number; dayOfWeek: number; count: number }[];
         labelDistribution: { label: string; count: number }[];
         newsletterCount: number;       // detected via List-Unsubscribe header
         avgThreadDepth: number;
         subjectPatternClusters: {      // NOT raw subjects -- clustered patterns
           pattern: string;             // e.g., "meeting-related", "review-requests"
           count: number;
           exampleKeywords: string[];   // generic keywords, not full subjects
         }[];
       }

  9. DISCARD raw message data after aggregation
     Raw subjects, sender emails, etc. are NEVER persisted or sent to AI
     Only aggregated anonymous patterns proceed to analysis
```

**Privacy principle:** The aggregation step (8) is the privacy firewall. Raw email metadata enters the function; only anonymous statistical patterns exit. Subject lines are clustered by keyword patterns (e.g., "meeting-related: 45 messages"), not stored or forwarded individually. Sender addresses are reduced to domain distributions (e.g., "internal: 60%, external-vendor: 25%, newsletter: 15%").

**Gmail API quota:** The default per-user quota is 250 quota units/second. `messages.list` costs 5 units, `messages.get` costs 5 units. Fetching 500 messages = 5 + 2500 = 2505 units total, which at 250/sec completes in ~10 seconds. This is acceptable for a user-initiated diagnostic.

### Phase C: AI Analysis

```
Server Action (analyzeWorkflow) -- follows ai-review.ts pattern exactly:

  1. System prompt: describe the analysis task
     - Role: workflow efficiency analyst
     - Task: identify time allocation and automation opportunities
     - Context: this is for an AI skill marketplace
     - Constraint: suggest specific types of AI skills that could help

  2. User prompt: WorkflowMetadata as structured input
     - Emphasis: NO PII in this data, all patterns are aggregated
     - Request: time breakdown, automation opportunities, skill queries

  3. Anthropic API call with structured output:
     const response = await client.messages.create({
       model: REVIEW_MODEL,  // reuse from ai-review.ts
       max_tokens: 4096,
       system: WORKFLOW_ANALYSIS_SYSTEM_PROMPT,
       messages: [{ role: "user", content: buildAnalysisPrompt(metadata) }],
       output_config: {
         format: { type: "json_schema", schema: ANALYSIS_JSON_SCHEMA },
       },
     });

  4. Structured output schema:
     interface WorkflowAnalysis {
       timeBreakdown: {
         category: string;           // e.g., "Internal Communication"
         percentageOfTime: number;   // 0-100
         description: string;        // what this category involves
       }[];
       automationOpportunities: {
         area: string;               // e.g., "Meeting Prep"
         currentTimePerWeek: number; // estimated hours
         potentialTimeSaved: number; // estimated hours saveable
         description: string;        // how AI could help
         skillSearchQuery: string;   // query to search EverySkill catalog
       }[];
       overallAssessment: string;    // 2-3 sentence summary
       topRecommendation: string;    // single most impactful suggestion
     }

  5. Validate with Zod (same pattern as ReviewOutputSchema)
  6. Return structured analysis
```

**AI cost estimate:** ~2K input tokens (aggregated metadata) + ~1.5K output tokens (analysis). At Sonnet pricing: ~$0.015 per diagnostic. At Opus pricing: ~$0.08 per diagnostic. Use Sonnet by default (sufficient quality for pattern analysis).

### Phase D: Skill Matching

```
For each automationOpportunity.skillSearchQuery:
  1. Use existing generateEmbedding() from apps/web/lib/ollama.ts
     (or Voyage AI if configured) to create query embedding
  2. Call existing hybridSearchSkills() from packages/db/src/services/hybrid-search.ts
     with { query: skillSearchQuery, queryEmbedding, userId, limit: 3 }
  3. Collect top 3 results per opportunity
  4. Deduplicate across opportunities (same skill may match multiple)
  5. Return: { skillId, skillName, skillSlug, opportunityArea, rrfScore }[]
```

**No new search infrastructure needed.** The existing hybrid search with RRF is exactly the right tool for "find skills matching this natural language description." The AI-generated `skillSearchQuery` is already optimized for this use case.

### Phase E: Storage and Rendering

#### Persist

```typescript
// Insert workflow_diagnostics row
const diagnosticId = await saveDiagnostic({
  tenantId: session.user.tenantId,
  userId: session.user.id,
  timeBreakdown: analysis.timeBreakdown,          // JSONB
  automationOpportunities: analysis.automationOpportunities, // JSONB
  overallAssessment: analysis.overallAssessment,
  topRecommendation: analysis.topRecommendation,
  emailCount: metadata.totalMessages,
  dateRangeStart: new Date(metadata.dateRange.start),
  dateRangeEnd: new Date(metadata.dateRange.end),
  analysisModel: REVIEW_MODEL,
});

// Insert diagnostic_skill_matches rows
for (const match of skillMatches) {
  await saveSkillMatch({
    tenantId: session.user.tenantId,
    diagnosticId,
    skillId: match.skillId,
    opportunityArea: match.opportunityArea,
    relevanceScore: match.rrfScore,
  });
}
```

#### Render

```
/workflow-diagnostic page (server component)
  |
  +-- GmailConnectButton (client)
  |     - Shows "Connect Gmail" if no gmail_tokens for user
  |     - Shows "Connected (last analyzed: [date])" if tokens exist
  |     - Shows "Disconnect" option
  |
  +-- [If connected and has diagnostic results]:
  |
  +-- DiagnosticDashboard (server, fetches latest diagnostic)
       |
       +-- OverallAssessment (static text card)
       |     - overallAssessment text
       |     - topRecommendation highlighted
       |
       +-- WorkflowTimeChart (client, Recharts PieChart)
       |     - Donut chart of timeBreakdown categories
       |     - Click segment to see description
       |
       +-- AutomationOpportunities (client)
       |     - Bar chart: current time vs potential savings per area
       |     - Each bar links to matched skills below
       |
       +-- SkillRecommendations (server)
       |     - Cards for each matched skill (name, description, category)
       |     - Link to /skills/[slug] for full detail
       |     - Grouped by opportunity area
       |
       +-- DiagnosticHistory (server)
             - List of previous diagnostics with dates
             - Compare current vs previous (if available)
             - "Re-run Diagnostic" button
```

---

## New vs Modified Components

### New Files to Create

| File | Type | Purpose |
|------|------|---------|
| `apps/web/lib/gmail-auth.ts` | Library | OAuth URL builder, token encrypt/decrypt, token refresh |
| `apps/web/lib/gmail-fetcher.ts` | Library | Gmail API client, metadata fetch, aggregation |
| `apps/web/lib/workflow-analyzer.ts` | Library | Anthropic API analysis (follows ai-review.ts) |
| `apps/web/lib/gmail-skill-matcher.ts` | Library | Maps analysis to skills via hybrid search |
| `apps/web/app/actions/workflow-diagnostic.ts` | Server Action | Orchestrates connect, analyze, persist, disconnect |
| `apps/web/app/api/gmail/callback/route.ts` | API Route | OAuth callback for Gmail consent |
| `apps/web/app/(protected)/workflow-diagnostic/page.tsx` | Page | Dashboard for diagnostic results |
| `apps/web/components/gmail-connect-button.tsx` | Component | Connection status, connect/disconnect |
| `apps/web/components/workflow-time-chart.tsx` | Component | Recharts PieChart for time breakdown |
| `apps/web/components/automation-opportunities.tsx` | Component | Bar chart + skill cards per opportunity |
| `apps/web/components/diagnostic-history.tsx` | Component | Previous diagnostics list |
| `packages/db/src/schema/gmail-tokens.ts` | Schema | Encrypted Gmail OAuth token storage |
| `packages/db/src/schema/workflow-diagnostics.ts` | Schema | Diagnostic snapshots + skill matches |
| `packages/db/src/services/gmail-tokens.ts` | Service | Token CRUD with encryption |
| `packages/db/src/services/workflow-diagnostics.ts` | Service | Diagnostic CRUD + history queries |
| `packages/db/src/migrations/0026_add_gmail_tokens.sql` | Migration | gmail_tokens DDL |
| `packages/db/src/migrations/0027_add_workflow_diagnostics.sql` | Migration | workflow_diagnostics + diagnostic_skill_matches DDL |

### Existing Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `packages/db/src/schema/index.ts` | Add exports for `gmail-tokens.ts` and `workflow-diagnostics.ts` | Schema registration |
| `packages/db/src/relations/index.ts` | Add relations for 3 new tables | Drizzle relation definitions |
| `apps/web/middleware.ts` | Add `/api/gmail/callback` to exempt paths | OAuth callback must bypass auth check |
| `apps/web/app/(protected)/layout.tsx` | Add nav link for "Workflow Diagnostic" | Navigation entry |
| `apps/web/package.json` | Add `googleapis` dependency | Gmail API client |

### Existing Infrastructure Reused WITHOUT Modification

| File | What's Reused |
|------|--------------|
| `apps/web/lib/ai-review.ts` | Pattern template: `getClient()`, `REVIEW_MODEL`, `output_config` JSON schema, Zod validation |
| `packages/db/src/services/hybrid-search.ts` | `hybridSearchSkills()` called directly for skill matching |
| `apps/web/lib/embedding-generator.ts` | `generateSkillEmbedding()` pattern, `generateEmbedding()` from ollama.ts |
| `apps/web/lib/analytics-queries.ts` | Pattern template for query functions with tenantId scoping |
| `apps/web/auth.ts` + `auth.config.ts` | NOT modified -- Gmail uses entirely separate OAuth flow |
| `apps/web/components/overview-tab.tsx` | Pattern template for Recharts dashboard components |
| `apps/web/lib/api-key-crypto.ts` | Pattern reference for crypto operations (new encryption is AES-256-GCM, more robust) |

---

## Database Schema Design

### gmail_tokens Table

```sql
CREATE TABLE gmail_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  scope TEXT NOT NULL,  -- actual granted scope string
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX gmail_tokens_tenant_id_idx ON gmail_tokens(tenant_id);
-- RLS policy added via pgPolicy in Drizzle schema
```

**Design decision: One token per user per tenant.** Unlike workspace tokens (one per tenant for admin-initiated org integration), Gmail tokens are per-user because each user connects their own Gmail for personal workflow analysis.

### workflow_diagnostics Table

```sql
CREATE TABLE workflow_diagnostics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Analysis results (structured JSONB)
  time_breakdown JSONB NOT NULL,
  automation_opportunities JSONB NOT NULL,
  overall_assessment TEXT NOT NULL,
  top_recommendation TEXT NOT NULL,

  -- Metadata about the analysis run
  email_count INTEGER NOT NULL,
  date_range_start TIMESTAMP NOT NULL,
  date_range_end TIMESTAMP NOT NULL,
  analysis_model TEXT NOT NULL,  -- e.g., "claude-sonnet-4-5-20250929"

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX workflow_diagnostics_tenant_id_idx ON workflow_diagnostics(tenant_id);
CREATE INDEX workflow_diagnostics_user_created_idx ON workflow_diagnostics(user_id, created_at DESC);
-- RLS policy via pgPolicy
```

### diagnostic_skill_matches Table

```sql
CREATE TABLE diagnostic_skill_matches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  diagnostic_id TEXT NOT NULL REFERENCES workflow_diagnostics(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  opportunity_area TEXT NOT NULL,  -- which automation_opportunities entry this matches
  relevance_score DOUBLE PRECISION NOT NULL,  -- RRF score from hybrid search
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX diagnostic_skill_matches_tenant_id_idx ON diagnostic_skill_matches(tenant_id);
CREATE INDEX diagnostic_skill_matches_diagnostic_idx ON diagnostic_skill_matches(diagnostic_id);
-- RLS policy via pgPolicy
```

---

## Patterns to Follow

### Pattern 1: Structured AI Output (from ai-review.ts)

**What:** Use Anthropic's `output_config` with JSON schema for deterministic AI responses, validated by Zod.
**When:** All Anthropic API calls for data extraction.
**Why:** The existing `ai-review.ts` demonstrates this pattern. It prevents hallucinated fields, ensures type safety, and makes AI responses parseable.

```typescript
// workflow-analyzer.ts -- follows exact pattern from ai-review.ts
const ANALYSIS_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    timeBreakdown: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: { type: "string" as const },
          percentageOfTime: { type: "number" as const },
          description: { type: "string" as const },
        },
        required: ["category", "percentageOfTime", "description"],
        additionalProperties: false,
      },
    },
    automationOpportunities: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          area: { type: "string" as const },
          currentTimePerWeek: { type: "number" as const },
          potentialTimeSaved: { type: "number" as const },
          description: { type: "string" as const },
          skillSearchQuery: { type: "string" as const },
        },
        required: ["area", "currentTimePerWeek", "potentialTimeSaved", "description", "skillSearchQuery"],
        additionalProperties: false,
      },
    },
    overallAssessment: { type: "string" as const },
    topRecommendation: { type: "string" as const },
  },
  required: ["timeBreakdown", "automationOpportunities", "overallAssessment", "topRecommendation"],
  additionalProperties: false,
};
```

### Pattern 2: Server Action Orchestration

**What:** Server actions validate session, call library functions, return serializable results. No direct DB imports in actions -- delegate to services.
**When:** All user-triggered operations.

```typescript
// app/actions/workflow-diagnostic.ts
"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchGmailMetadata } from "@/lib/gmail-fetcher";
import { analyzeWorkflow } from "@/lib/workflow-analyzer";
import { matchSkills } from "@/lib/gmail-skill-matcher";
import { saveDiagnostic, getLatestDiagnostic } from "@everyskill/db/services/workflow-diagnostics";
import { getGmailTokens } from "@everyskill/db/services/gmail-tokens";

export async function runDiagnostic() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  // Verify Gmail is connected
  const tokens = await getGmailTokens(session.user.id, tenantId);
  if (!tokens) return { error: "Gmail not connected" };

  // 1. Fetch metadata (10-30 seconds)
  const metadata = await fetchGmailMetadata(session.user.id, tenantId);

  // 2. AI analysis (5-15 seconds)
  const analysis = await analyzeWorkflow(metadata);

  // 3. Match skills (1-3 seconds)
  const skillMatches = await matchSkills(analysis.automationOpportunities, session.user.id);

  // 4. Persist
  const diagnosticId = await saveDiagnostic({
    userId: session.user.id,
    tenantId,
    ...analysis,
    emailCount: metadata.totalMessages,
    dateRangeStart: new Date(metadata.dateRange.start),
    dateRangeEnd: new Date(metadata.dateRange.end),
    skillMatches,
  });

  return { diagnosticId };
}
```

### Pattern 3: Tenant-Scoped Schema (Mandatory for All New Tables)

**What:** Every new table follows the established multi-tenancy pattern.
**Source:** All 17+ existing tables use this pattern.

```typescript
export const gmailTokens = pgTable(
  "gmail_tokens",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // ... fields
  },
  (table) => [
    index("gmail_tokens_tenant_id_idx").on(table.tenantId),
    uniqueIndex("gmail_tokens_tenant_user_unique").on(table.tenantId, table.userId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 4: Token Encryption at Rest (AES-256-GCM)

**What:** Encrypt OAuth tokens before database storage. Decrypt only when making API calls.
**Why:** SOC2 requirement. The existing `accounts` table stores tokens in plaintext (Auth.js default), but for Gmail API tokens with data access scope, encrypt at rest.

```typescript
// apps/web/lib/gmail-auth.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY!; // 32 bytes hex (64 chars)

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivB64, tagB64, dataB64] = encryptedToken.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return decipher.update(Buffer.from(dataB64, "base64"), undefined, "utf8") + decipher.final("utf8");
}
```

### Pattern 5: Fire-and-Forget for Non-Critical Operations

**What:** Operations that should not block the primary flow use `.catch(() => {})`.
**Already used:** `generateSkillEmbedding()` in `apps/web/lib/embedding-generator.ts`.
**Apply to:** Search query logging during skill matching, audit log writes.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Auth.js Provider Scopes

**What:** Adding `gmail.metadata` to the Google provider's default scopes in `auth.config.ts`.
**Why bad:** Forces ALL users to consent to Gmail access on first login, even if they never use diagnostics. Users who decline Gmail scope cannot sign in. Also triggers Google's restricted scope verification for the entire app consent flow.
**Instead:** Separate OAuth flow triggered only when user requests the diagnostic feature.

### Anti-Pattern 2: Storing Raw Email Content

**What:** Persisting raw email subjects, sender addresses, or body content.
**Why bad:** Email content is PII. Storage requires encryption, retention policies, right-to-deletion compliance, and triggers Google's most stringent security assessment. Massive liability for minimal value.
**Instead:** Aggregate metadata into anonymous patterns in-memory. Only persist AI-generated analysis (categories, percentages, recommendations). Raw data is discarded after aggregation.

### Anti-Pattern 3: Using Auth.js Accounts Table for Gmail Tokens

**What:** Updating the `accounts` table row with Gmail-specific tokens.
**Why bad:** Auth.js `DrizzleAdapter` manages this table. The `jwt` callback in `auth.ts` reads from it for session management. Modifying tokens could break authentication. The account row stores identity tokens (for sign-in), while Gmail tokens serve a different purpose (API data access).
**Instead:** Separate `gmail_tokens` table with its own lifecycle, encryption, and revocation.

### Anti-Pattern 4: Synchronous Full Pipeline Without Progress

**What:** Running Gmail fetch + AI analysis + skill matching in one request with no UI feedback.
**Why bad:** Combined time is 15-45 seconds. Exceeds typical request timeouts. No progress indicator = user thinks it's broken.
**Instead:** Show a loading state with phase indicators:
- "Fetching email metadata..." (10-30s)
- "Analyzing workflow patterns..." (5-15s)
- "Matching skills..." (1-3s)
Use React's loading states. The server action runs to completion; the page shows a spinner with status text. On completion, results are persisted and the page re-renders with data.

### Anti-Pattern 5: Sending PII to the AI

**What:** Passing raw email subjects, sender addresses, or thread content to Claude.
**Why bad:** Privacy violation. AI providers may log inputs. Even with Anthropic's data policies, sending user email content to a third-party API without explicit consent creates compliance risk.
**Instead:** The aggregation layer (Phase B, step 8) is the privacy firewall. Only anonymous patterns (domain distributions, temporal patterns, keyword clusters) reach the AI.

---

## Integration with Google Cloud Project

The existing Google Cloud project already has:
- OAuth 2.0 credentials (used by Auth.js for SSO)
- Consent screen configured

To enable Gmail diagnostics:
1. Enable the Gmail API in the Google Cloud Console
2. Add `https://www.googleapis.com/auth/gmail.metadata` to the OAuth consent screen's scopes
3. The restricted scope will trigger Google's verification process:
   - Brand verification (2-3 business days)
   - Restricted scope verification (several weeks)
   - Security assessment by Google-approved assessor (if storing/transmitting restricted data)
4. During development, the app works in "Testing" mode (100 test users max)
5. For production, verification must be completed before the 100-user limit is lifted

**This is a significant timeline dependency.** The verification process should be initiated early (Phase 1), even before the code is complete. Development and testing can proceed in "Testing" mode.

---

## Environment Variables

New variables needed:

| Variable | Value | Purpose |
|----------|-------|---------|
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 64-character hex string (32 bytes) | AES-256-GCM encryption key for Gmail tokens |

Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Existing variables reused:
- `AUTH_GOOGLE_ID` -- Same Google OAuth client ID
- `AUTH_GOOGLE_SECRET` -- Same Google OAuth client secret
- `ANTHROPIC_API_KEY` -- For workflow analysis

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Gmail API quota | 250 units/user/sec. 500 messages = ~10s. Fine. | Same per-user quota. No issue (user-initiated). | Same. Google quotas are per-user. |
| Token storage | 100 rows, trivial | 10K rows with UNIQUE index. Fast lookup. | Partition by tenant. Encryption adds ~50% storage. |
| Diagnostic storage | Small JSONB rows | Add composite index (user_id, created_at) | Archive diagnostics older than 1 year |
| AI analysis cost | ~$0.015/diagnostic (Sonnet) | $150 for full cohort | Rate limit (max 1 per user per day) |
| Gmail fetch time | 10-30s per user, acceptable | N/A (user-initiated, not batch) | N/A |
| Skill matching | 5-15 hybrid searches per diagnostic (~1s each) | Same per-user | Cache frequently matched queries |

---

## Build Order (Dependency-Driven)

```
Phase 1: Foundation (no inter-dependencies)
  |-- gmail_tokens schema + migration
  |-- gmail-auth.ts (encryption, OAuth URL builder, token refresh)
  |-- workflow_diagnostics + diagnostic_skill_matches schema + migration
  |-- googleapis dependency added to package.json
  |-- Initiate Google restricted scope verification (timeline dependency!)

Phase 2: OAuth Flow (depends on Phase 1 schema)
  |-- /api/gmail/callback route
  |-- middleware.ts exemption for /api/gmail/callback
  |-- gmail-connect-button.tsx component
  |-- connectGmail + disconnectGmail server actions

Phase 3: Data Pipeline (depends on Phase 1 schema, parallel with Phase 2)
  |-- gmail-fetcher.ts (Gmail API metadata fetch + aggregation)
  |-- workflow-analyzer.ts (Anthropic analysis with structured output)
  |-- gmail-skill-matcher.ts (thin wrapper around existing hybrid search)
  |-- workflow-diagnostics.ts service (CRUD)
  |-- gmail-tokens.ts service (CRUD with encryption)

Phase 4: Dashboard (depends on Phase 2 + Phase 3)
  |-- /workflow-diagnostic page
  |-- workflow-time-chart.tsx (Recharts PieChart)
  |-- automation-opportunities.tsx (BarChart + skill cards)
  |-- diagnostic-history.tsx (previous runs list)
  |-- runDiagnostic server action (orchestrates full pipeline)
  |-- Navigation link in layout

Phase 5: Polish (depends on Phase 4)
  |-- Historical comparison between diagnostics
  |-- Re-run with configurable time range (7d, 30d, 90d)
  |-- Disconnect Gmail flow with token revocation
  |-- Loading states with phase indicators
  |-- E2E tests (mock Gmail API)
```

**Parallelism:** Phase 2 and Phase 3 can run in parallel after Phase 1 (no shared files). Phase 4 depends on both completing. Phase 5 depends on Phase 4.

---

## Sources

### HIGH Confidence (Official Documentation + Codebase)
- [Google Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- scope classification, verification requirements
- [Google OAuth2 Web Server Flow](https://developers.google.com/identity/protocols/oauth2/web-server) -- incremental authorization, token exchange
- [Google Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) -- verification timeline, security assessment
- [Google Incremental Authorization](https://developers.google.com/identity/sign-in/web/incremental-auth) -- include_granted_scopes pattern
- [Google Granular Permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) -- handling partial scope grants
- [Node.js Gmail API Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs) -- googleapis client setup
- [googleapis NPM Package](https://www.npmjs.com/package/googleapis) -- Gmail API client
- [Auth.js OAuth Provider Configuration](https://authjs.dev/guides/configuring-oauth-providers) -- scope override pattern
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- token refresh pattern
- Direct codebase analysis (all files listed in Component Boundaries section)

### MEDIUM Confidence (GitHub Discussions, Community)
- [Auth.js Discussion #11819: Persist Gmail Permissions](https://github.com/nextauthjs/next-auth/discussions/11819) -- confirms limitations
- [Auth.js Discussion #4557: Set Scopes on signIn](https://github.com/nextauthjs/next-auth/discussions/4557) -- per-request scope not supported
- [Auth.js Discussion #2068: Override Scopes](https://github.com/nextauthjs/next-auth/discussions/2068) -- workarounds
- [Google Provider Refresh Token Issue #8205](https://github.com/nextauthjs/next-auth/issues/8205) -- refresh token edge cases
- [Node.js AES-256-GCM Examples](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) -- encryption implementation
