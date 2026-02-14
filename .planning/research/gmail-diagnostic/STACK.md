# Technology Stack: Gmail Workflow Diagnostic

**Project:** EverySkill — Gmail Workflow Diagnostic Milestone
**Researched:** 2026-02-14
**Scope:** Stack ADDITIONS only for Gmail diagnostic features. Existing stack unchanged (Next.js 16.1.6, PostgreSQL + pgvector, Drizzle ORM 0.42.0, Auth.js v5, Anthropic SDK 0.72.1, Recharts 3.7.0, Tailwind CSS 4, Playwright).

---

## Executive Summary

The Gmail Workflow Diagnostic requires **1 new npm dependency** (`@googleapis/gmail` if not already installed from v3.0) and **0 existing dependency changes**. Everything else is built with the existing stack. The key engineering work is:

1. **OAuth scope extension** for `gmail.metadata` (not `gmail.readonly`) -- narrowest scope that gives us headers, labels, and timestamps without message bodies
2. **Token management** using the existing Auth.js DrizzleAdapter `accounts` table which already stores `access_token`, `refresh_token`, `expires_at`, and `scope`
3. **Granular consent handling** -- Google's new consent UI (rolled out Nov 2025) allows users to uncheck individual scopes, so Gmail access must degrade gracefully
4. **AI analysis** using the existing Anthropic SDK with structured JSON output (same pattern as `ai-review.ts`)
5. **Dashboard visualization** using existing Recharts 3.7.0 (BarChart, AreaChart, PieChart -- all available, already in use)

No NLP libraries, no job queues, no new charting libraries. Claude does the classification. Recharts does the visualization. The Gmail API provides the data. The privacy model is analyze-and-discard: email metadata is fetched, analyzed in-memory, results are stored as aggregate statistics only, and raw metadata is never persisted.

---

## Recommended Stack

### Gmail API Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@googleapis/gmail` | ^15.0.0 | Fetch email metadata (headers, labels, thread structure) | Individual package (~1.1MB) vs `googleapis` monolith (200MB). Already planned for v3.0. Gmail API v1 is the only version |

**Note:** If v3.0 milestone installs `@googleapis/gmail` first, this milestone inherits it. No duplicate install needed. The version planned in v3.0 research was `^16.1.1` -- use whatever is current at implementation time. The API surface is identical across minor versions.

**Why `@googleapis/gmail` over raw `fetch` to Gmail REST API:**
- Handles OAuth token refresh via `google-auth-library` (transitive dependency)
- Handles pagination with `nextPageToken` automatically
- TypeScript types for all request/response objects
- Retry logic for transient 5xx errors built-in

### OAuth Scope

| Scope | URI | Restriction Level | What It Provides | Why This One |
|-------|-----|-------------------|------------------|--------------|
| `gmail.metadata` | `https://www.googleapis.com/auth/gmail.metadata` | **Restricted** | Message headers (From, To, Subject, Date, Message-ID, In-Reply-To), labels, history records | Narrowest scope that provides what we need. Does NOT expose message bodies or attachments |

**Why `gmail.metadata` over `gmail.readonly`:**
- Both are "Restricted" scope level (same verification burden)
- `gmail.metadata` explicitly excludes message body and attachments
- Signals privacy intent to users in the consent screen -- "read metadata" not "read all your email"
- Provides everything needed for workflow analysis: sender/recipient patterns, timestamps, thread structure, labels
- Reduces data exposure surface area

**Why NOT `gmail.readonly`:**
- Grants access to full message bodies and attachments -- more access than needed
- Users will be more hesitant to grant broader permissions
- More data to handle correctly in privacy review
- Violates principle of least privilege

### Existing Stack (No Changes Required)

| Technology | Current Version | Role in This Feature | Notes |
|------------|----------------|---------------------|-------|
| Anthropic SDK (`@anthropic-ai/sdk`) | ^0.72.1 | Classify email patterns, generate workflow recommendations | Same `output_config: json_schema` pattern as `ai-review.ts`. No streaming needed -- batch analysis |
| Recharts | ^3.7.0 | Dashboard charts: BarChart (top senders/categories), AreaChart (volume over time), PieChart (category distribution) | Already used in `overview-tab.tsx`, `skill-analytics-modal.tsx`, `usage-area-chart.tsx` |
| Zod | ^3.25.0 | Validate AI classification output, validate API response shapes | Already used in `ai-review.ts` for `ReviewOutputSchema` |
| Auth.js v5 (`next-auth`) | 5.0.0-beta.30 | Google OAuth, token storage in `accounts` table, JWT session | Google provider already configured in `auth.config.ts`. Scope extension is a config change |
| Drizzle ORM | ^0.42.0 | Store diagnostic results (aggregate stats, not raw email data) | New table(s) for diagnostic snapshots |
| Tailwind CSS 4 | ^4.0.0 | Dashboard layout and styling | No additions needed |

---

## OAuth Integration Details

### Scope Extension in Auth.js

The Google provider in `auth.config.ts` currently requests default scopes (`openid email profile`). Adding Gmail access requires extending the `authorization.params.scope`:

```typescript
// In auth.config.ts
Google({
  authorization: {
    params: {
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.metadata",
      ].join(" "),
      access_type: "offline",    // Required for refresh_token
      prompt: "consent",          // Required to get refresh_token on re-auth
    },
  },
})
```

**Critical: Granular OAuth Consent (Nov 2025 rollout)**

Google's granular consent screen now shows checkboxes for individual scopes. Users can uncheck Gmail access while keeping sign-in scopes. This means:

1. The `account.scope` field in the JWT callback contains the **actually granted** scopes (may be a subset of requested)
2. The app MUST check whether `gmail.metadata` was granted before attempting Gmail API calls
3. Gmail features must degrade gracefully -- show "Gmail access not granted" with a re-authorization button

**Scope verification pattern:**

```typescript
// In jwt callback, store granted scopes
async jwt({ token, account }) {
  if (account) {
    token.access_token = account.access_token;
    token.refresh_token = account.refresh_token;
    token.expires_at = account.expires_at;
    token.granted_scopes = account.scope; // Actual granted scopes string
  }
  return token;
}

// Before any Gmail API call
function hasGmailAccess(grantedScopes: string | undefined): boolean {
  return !!grantedScopes?.includes("gmail.metadata");
}
```

### Token Storage and Refresh

The existing `accounts` table (in `packages/db/src/schema/auth.ts`) already has all required columns:

| Column | Type | Purpose |
|--------|------|---------|
| `access_token` | text | Current Google access token |
| `refresh_token` | text | Long-lived refresh token for offline access |
| `expires_at` | integer | Token expiry (Unix seconds) |
| `scope` | text | Granted scope string -- check this for `gmail.metadata` |

**Token refresh approach:** Use `google-auth-library`'s `OAuth2Client` (transitive dependency of `@googleapis/gmail`). It auto-refreshes expired tokens when making API calls. After refresh, update the `accounts` table with new `access_token` and `expires_at`.

```typescript
import { OAuth2Client } from "google-auth-library";
import { gmail_v1 } from "@googleapis/gmail";

async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const account = await getGoogleAccount(userId); // Read from accounts table

  const oauth2Client = new OAuth2Client(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Listen for token refresh to persist new tokens
  oauth2Client.on("tokens", async (tokens) => {
    await updateGoogleTokens(userId, {
      access_token: tokens.access_token,
      expires_at: tokens.expiry_date
        ? Math.floor(tokens.expiry_date / 1000)
        : undefined,
      refresh_token: tokens.refresh_token ?? undefined,
    });
  });

  return new gmail_v1.Gmail({ auth: oauth2Client });
}
```

### Google Cloud Console Configuration

**For internal (Workspace domain-only) apps:**

If EverySkill only serves users within a single Google Workspace domain, set the OAuth consent screen to "Internal" user type. This **bypasses Google's restricted scope verification entirely** -- no security assessment, no review process.

**For external apps:**

If EverySkill serves users across multiple domains, `gmail.metadata` requires:
1. Sensitive scope verification (privacy policy, homepage, etc.)
2. Restricted scope verification (additional security assessment, CASA tier 2)
3. Annual re-assessment

**Recommendation:** Start with "Internal" app type during development and initial deployment. This avoids the multi-week verification process. Only switch to "External" when cross-domain access is needed.

---

## Gmail API Usage Patterns

### API Methods and Quota Costs

| Method | Quota Units | Use Case |
|--------|-------------|----------|
| `users.messages.list` | 5 per request | List message IDs with optional query filter |
| `users.messages.get` (format: METADATA) | 5 per request | Get individual message headers |
| `users.threads.list` | 10 per request | List thread IDs (groups messages by conversation) |
| `users.threads.get` (format: METADATA) | 10 per request | Get all messages in a thread with headers |

**Rate limits:**
- Per-project: 1,200,000 quota units per minute
- Per-user: 15,000 quota units per minute
- No daily quota cap (only per-minute enforcement)

**Practical throughput for diagnostic scan:**
- At 15,000 units/min per user, and 5 units per messages.list + 5 units per messages.get:
- ~1,500 message headers per minute per user
- A 90-day scan of ~3,000 emails takes ~2 minutes
- Well within limits for a user-initiated diagnostic

### Recommended Data Fetching Strategy

**Use `threads.list` + `threads.get` (not `messages.list` + `messages.get`):**

Threads are the natural unit of email workflow analysis. A thread captures the full conversation: who initiated it, who replied, response times between messages, and total depth. This is exactly the data shape needed for workflow pattern detection.

```typescript
// Fetch threads from last 90 days
const threads = await gmail.users.threads.list({
  userId: "me",
  q: "after:2025/11/15",       // Gmail search query syntax
  maxResults: 100,              // Per page, paginate with nextPageToken
});

// For each thread, get metadata-only details
const threadDetails = await gmail.users.threads.get({
  userId: "me",
  id: threadId,
  format: "metadata",
  metadataHeaders: ["From", "To", "Cc", "Subject", "Date", "In-Reply-To", "Message-ID"],
});
```

**Why threads over individual messages:**
- One API call per thread gives ALL messages in the conversation
- Thread structure reveals response patterns (who replied to whom, when)
- Threads are Gmail's native grouping -- no need to reconstruct conversations from In-Reply-To headers
- Fewer API calls: 500 threads covers ~2,000+ messages

### Metadata Headers to Request

| Header | Purpose |
|--------|---------|
| `From` | Sender identification, frequency analysis |
| `To` | Recipient patterns, collaboration graph |
| `Cc` | CC behavior patterns (over-CC'ing is a workflow smell) |
| `Subject` | Topic clustering (for AI classification) |
| `Date` | Timing analysis, response time calculation |
| `In-Reply-To` | Thread structure verification |
| `Message-ID` | Unique message identification |
| `List-Unsubscribe` | Distinguish marketing/newsletter from human email |

---

## AI Classification Approach

### Use Existing Anthropic SDK (Not NLP Libraries)

**Decision: Claude does ALL email classification. No NLP libraries.**

**Why NOT add `nlp.js`, `natural`, `winkjs`, or `compromise`:**
- These libraries do basic NLP: tokenization, stemming, Naive Bayes classification
- They require training data and manual category definitions
- Claude already understands email patterns, sender intent, urgency, and workflow context
- The classification accuracy from a prompted LLM vastly exceeds rule-based NLP for this domain
- Adding NLP libraries means maintaining training data, feature engineering, and model updates
- The existing Anthropic SDK + Zod structured output pattern (`ai-review.ts`) is proven in this codebase

**Classification approach:**

Feed batches of email metadata (headers only, no bodies) to Claude with a structured output schema. Claude classifies each email's:
- Category (human collaboration, automated notification, newsletter, calendar, transactional)
- Urgency level (needs response, FYI, can ignore)
- Response time requirement (time-sensitive, normal, no response needed)
- Automation potential (could be handled by a skill/automation)

```typescript
// Same pattern as generateSkillReview() in ai-review.ts
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",  // Fast + accurate for classification
  max_tokens: 4096,
  system: EMAIL_CLASSIFICATION_SYSTEM_PROMPT,
  messages: [{ role: "user", content: emailBatchJSON }],
  output_config: {
    format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA },
  },
});
```

**Batch size:** ~50-100 email metadata records per Claude call. Each metadata record is ~200 bytes (headers only). A batch of 100 is ~20KB input -- well within token limits.

**Cost estimate:** Sonnet at ~$3/M input tokens, $15/M output tokens. A 3,000-email diagnostic scan produces ~600KB of metadata. Classification in 30 batches of 100: ~$0.02 input + ~$0.15 output = **~$0.17 per full diagnostic scan**.

---

## Dashboard Visualization

### Use Existing Recharts (No New Charting Libraries)

Recharts 3.7.0 provides every chart type needed for the diagnostic dashboard:

| Chart Type | Component | Use Case |
|------------|-----------|----------|
| `BarChart` | Top senders by volume, response time by category | Already used in `overview-tab.tsx` |
| `AreaChart` | Email volume over time (daily/weekly) | Already used in `usage-area-chart.tsx` |
| `PieChart` | Category distribution (human vs automated vs newsletter) | Available in Recharts, not yet used but trivial |
| `Tooltip` | Hover details on all charts | Already used |
| `ResponsiveContainer` | Container sizing | Already used |

**What about calendar heatmaps?**

If a GitHub-style contribution heatmap is desired (email activity by day), options are:
- `@uiw/react-heat-map` (~15KB) -- lightweight, purpose-built
- Build it with Tailwind CSS grid (no dependency, ~50 lines of JSX)

**Recommendation:** Build the heatmap with Tailwind CSS grid. The visualization is simple (7x52 grid of colored squares) and adding a dependency for one chart type is not worth it. If the scope expands to need it, `@uiw/react-heat-map` is the fallback.

---

## Privacy and Data Handling

### Analyze-and-Discard Pattern

The privacy model is critical. Email metadata is sensitive even without message bodies. The approach:

1. **Fetch phase:** Pull email metadata from Gmail API (headers only via `gmail.metadata` scope)
2. **Analysis phase:** Classify in-memory using Claude. Compute aggregate statistics (counts, averages, distributions)
3. **Storage phase:** Store ONLY aggregate results. Never persist individual email metadata, sender addresses, or subjects
4. **Discard phase:** Raw metadata is garbage-collected after the server action completes

**What IS stored (in a `diagnostic_snapshots` table):**
- Scan date range and message count
- Category distribution (e.g., "42% human, 31% automated, 27% newsletter")
- Response time statistics (median, p90 by category)
- Top workflow patterns identified (anonymized: "frequent collaboration with 5 contacts" not email addresses)
- AI-generated recommendations
- Timestamp of scan

**What is NEVER stored:**
- Individual email headers (From, To, Subject)
- Email addresses (sender or recipient)
- Message content or bodies (scope prevents access anyway)
- Thread IDs or Message IDs
- Any data that could reconstruct individual emails

### Why `gmail.metadata` Scope Supports This

The `gmail.metadata` scope gives us headers but NOT bodies. Combined with the analyze-and-discard pattern:
- We request the minimum data needed (headers and labels)
- We process it transiently (in-memory during a server action)
- We store only aggregates (statistics and recommendations)
- The scope itself prevents accessing message content

This aligns with GDPR Article 5(1)(c) data minimization and Google's API Services User Data Policy.

---

## Schema Changes Required

### New Table

```typescript
// packages/db/src/schema/diagnostic-snapshots.ts
export const diagnosticSnapshots = pgTable("diagnostic_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanDateFrom: timestamp("scan_date_from", { withTimezone: true }).notNull(),
  scanDateTo: timestamp("scan_date_to", { withTimezone: true }).notNull(),
  messageCount: integer("message_count").notNull(),
  threadCount: integer("thread_count").notNull(),
  // Aggregate statistics as JSONB
  categoryDistribution: jsonb("category_distribution").notNull(),  // {human: 42, automated: 31, ...}
  responseTimeStats: jsonb("response_time_stats").notNull(),       // {median: 3600, p90: 86400, ...}
  topPatterns: jsonb("top_patterns").notNull(),                    // [{pattern, count, description}, ...]
  recommendations: jsonb("recommendations").notNull(),             // [{title, description, skillSuggestion}, ...]
  scanDurationMs: integer("scan_duration_ms"),                     // How long the scan took
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

### Modified Tables

None. The existing `accounts` table already stores everything needed for OAuth token management.

### Environment Variables

```bash
# No new env vars needed.
# Gmail uses the same Google OAuth client: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
# AI classification uses: ANTHROPIC_API_KEY (existing)
```

---

## Installation

```bash
# Only if @googleapis/gmail is not already installed from v3.0 milestone
pnpm --filter web add @googleapis/gmail

# No other new packages
```

**Total new packages: 0-1** (depending on v3.0 milestone status)
**Estimated node_modules impact:** ~1.1MB if `@googleapis/gmail` not already present. If v3.0 already installed the Google API packages, the shared `googleapis-common` dependency is already deduped.

---

## Alternatives Considered and Rejected

| Category | Decision | Alternative | Why Not |
|----------|----------|-------------|---------|
| Gmail scope | `gmail.metadata` | `gmail.readonly` | Both restricted. metadata is narrower -- no body/attachment access. Better privacy posture, same verification burden |
| Email classification | Anthropic SDK (Claude) | `nlp.js` / `natural` / `winkjs` | NLP libs require training data, manual categories. Claude classifies with zero training, higher accuracy, and structured output. Already in stack |
| Email classification | Anthropic SDK (Claude) | OpenAI GPT-4 | Already paying for Anthropic. Same API key. Proven structured output pattern in codebase |
| Charting | Recharts (existing) | `chart.js` / `nivo` / `visx` | Recharts already installed and used in 3 components. Adding another chart library creates inconsistency |
| Calendar heatmap | Tailwind CSS grid (custom) | `@uiw/react-heat-map` | One simple grid visualization does not justify a new dependency |
| Background processing | Server action (synchronous) | `bull` / `pg-boss` job queue | Scan takes ~2 min for 90 days of email. Server action with progress reporting is sufficient. No infra needed |
| Token storage | Auth.js `accounts` table | Separate encrypted token store | Auth.js adapter already handles this. Adding encryption layer adds complexity with minimal benefit -- DB is already behind RLS + network isolation |
| NLP preprocessing | None (raw headers to Claude) | Tokenization, stemming, TF-IDF | Preprocessing adds complexity, loses context. Claude understands "Re: Q4 Budget Review" better than a stemmer |

---

## What NOT to Add

| Technology | Why Skip It | Risk If Added |
|------------|-------------|---------------|
| `googleapis` (monolithic) | 200MB package for one API. Individual package is 1.1MB | Bloated node_modules, slow install |
| `nlp.js` / `natural` / `compromise` | Claude classifies email better than rule-based NLP. Zero training needed | Maintenance burden of training data, lower accuracy, redundant with existing Anthropic SDK |
| `bull` / `pg-boss` / `inngest` | Server action handles 2-min scan fine. Progress via streaming | Infrastructure complexity for a user-initiated, infrequent operation |
| `@uiw/react-heat-map` | Tailwind CSS grid covers the single heatmap view | Another charting dependency alongside Recharts |
| `googleapis-common` (direct install) | Already transitive dep of `@googleapis/gmail` | Duplicate, version conflict risk |
| `google-auth-library` (direct install) | Already transitive dep of `@googleapis/gmail` | Duplicate, version conflict risk |
| Vercel AI SDK | Not needed here. No streaming chat. Batch classification with existing Anthropic SDK | Over-engineering. Would add 2 packages for something the existing SDK handles |
| Redis / caching layer | Diagnostic runs are infrequent (weekly/monthly). No caching needed | Infra complexity for a feature used once per user per week |

---

## Compatibility Matrix

| Component | React 19 | Next.js 16.1.6 | Node 22+ | Auth.js v5 | Drizzle 0.42 |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `@googleapis/gmail@^15.0.0` | N/A | N/A | Yes | Tokens from accounts table | N/A |
| `gmail.metadata` scope | N/A | N/A | N/A | Extend Google provider config | N/A |
| Recharts 3.7.0 (existing) | Yes | Yes | N/A | N/A | N/A |
| Anthropic SDK 0.72.1 (existing) | N/A | N/A | Yes | N/A | N/A |
| Zod 3.25.0 (existing) | N/A | N/A | Yes | N/A | N/A |

All existing dependencies remain compatible. The only new dependency (`@googleapis/gmail`) has no peer dep conflicts.

---

## Incremental Authorization Strategy

**Option A: Bundle Gmail scope with login (simpler)**
Add `gmail.metadata` to the Google provider scopes in `auth.config.ts`. All users see the Gmail permission request on their next login. Users who uncheck it get the app without Gmail features.

**Option B: Incremental authorization (better UX)**
Keep login scopes minimal (`openid email profile`). When user clicks "Run Gmail Diagnostic," redirect to Google OAuth with `gmail.metadata` scope added via `include_granted_scopes=true`. This requests only the new scope incrementally.

**Recommendation: Option A for initial implementation, migrate to Option B later.**

Rationale:
- Option A is ~5 lines of config change. Option B requires a separate OAuth flow, custom redirect handling, and scope merge logic
- Auth.js v5 does not natively support incremental authorization -- it would require bypassing Auth.js for the Gmail scope grant
- With granular consent, users can already opt out of Gmail during the bundled flow
- Option B is a UX improvement for a later iteration once the core diagnostic is proven

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Gmail API package | HIGH | `@googleapis/gmail` is Google's official, actively maintained Node.js client. Already validated in v3.0 research |
| `gmail.metadata` scope | HIGH | Verified via official Google Workspace documentation. Explicitly provides headers without bodies. Restriction level confirmed as "Restricted" |
| OAuth token storage | HIGH | `accounts` table columns verified by reading `packages/db/src/schema/auth.ts`. DrizzleAdapter auto-populates on sign-in |
| Granular consent handling | HIGH | Google's granular consent rollout confirmed via official Workspace blog (Nov 2025). Account `scope` field contains granted scopes |
| AI classification approach | HIGH | Same pattern as existing `ai-review.ts`. Anthropic structured output with Zod validation is proven in this codebase |
| Recharts sufficiency | HIGH | BarChart, AreaChart, PieChart all available and already used. Verified by reading existing chart components |
| Internal app scope bypass | MEDIUM | Google documentation states internal apps skip restricted scope verification. Confirmed across multiple official sources. Risk: policy changes |
| Cost per diagnostic scan | MEDIUM | Estimated ~$0.17 based on Sonnet pricing and metadata volumes. Actual cost depends on email volume and batch efficiency |
| Analyze-and-discard compliance | MEDIUM | Pattern aligns with GDPR data minimization. Not legal advice -- actual compliance depends on privacy policy wording and jurisdiction |

---

## Sources

### Official Documentation
- [Gmail API Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) -- `gmail.metadata` and `gmail.readonly` scope definitions, restriction levels
- [Gmail API Usage Limits](https://developers.google.com/workspace/gmail/api/reference/quota) -- Per-method quota costs (5 units for messages.list/get, 10 for threads.list/get), rate limits (15,000 units/user/min)
- [Gmail API threads.get](https://developers.google.com/gmail/api/reference/rest/v1/users.threads/get) -- Format options (FULL, METADATA, MINIMAL), metadataHeaders parameter
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) -- Scope configuration, offline access, refresh tokens
- [Auth.js Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) -- JWT callback token persistence pattern with Google
- [Auth.js Configuring OAuth Providers](https://authjs.dev/guides/configuring-oauth-providers) -- Custom scope override via deep merge
- [Google Granular OAuth Consent](https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html) -- Nov 2025 rollout, users can uncheck individual scopes
- [Handling Granular Permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions) -- Check `scope` field for actually granted scopes
- [Google OAuth Consent Screen Configuration](https://developers.google.com/workspace/guides/configure-oauth-consent) -- Internal app type skips restricted scope verification
- [Restricted Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) -- Security assessment requirements for external apps
- [Google API User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) -- Data minimization, privacy policy requirements

### Codebase Verification (2026-02-14)
- `apps/web/auth.config.ts` -- Current Google provider config with default scopes, scope extension point confirmed
- `apps/web/auth.ts` -- JWT callback with tenantId injection, account token handling confirmed
- `packages/db/src/schema/auth.ts` -- `accounts` table with `access_token`, `refresh_token`, `expires_at`, `scope` columns confirmed
- `apps/web/lib/ai-review.ts` -- Existing Anthropic SDK structured output pattern with `output_config: json_schema` confirmed
- `apps/web/components/usage-area-chart.tsx` -- Existing Recharts AreaChart usage confirmed
- `apps/web/components/overview-tab.tsx` -- Existing Recharts usage confirmed
- `apps/web/components/skill-analytics-modal.tsx` -- Existing Recharts usage confirmed
- `apps/web/package.json` -- Current dependency versions confirmed

### NPM Registry
- [@googleapis/gmail](https://www.npmjs.com/package/@googleapis/gmail) -- v15.0.0 current, ~1.1MB unpacked
- [googleapis](https://www.npmjs.com/package/googleapis) -- v171+ at 200MB (rejected)

---

*Stack research for: EverySkill Gmail Workflow Diagnostic Milestone*
*Researched: 2026-02-14*
