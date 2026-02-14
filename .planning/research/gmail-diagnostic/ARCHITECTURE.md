# Architecture Patterns: Gmail Workflow Diagnostic

**Domain:** Email metadata analysis with AI classification and aggregate storage
**Researched:** 2026-02-14

## Recommended Architecture

### Component Overview

```
User clicks "Run Diagnostic"
  |
  v
[Server Action: runGmailDiagnostic]
  |
  |-- 1. Verify Gmail scope granted (check accounts.scope)
  |-- 2. Create Gmail API client (OAuth2Client from accounts table tokens)
  |-- 3. Fetch email metadata (threads.list + threads.get, paginated)
  |-- 4. Transform to analysis-ready format (in-memory)
  |-- 5. Classify via Claude (batched, structured output)
  |-- 6. Compute aggregate statistics (counts, distributions, response times)
  |-- 7. Store diagnostic snapshot (aggregates only, not raw data)
  |-- 8. Return results to UI
  |
  v
[Dashboard Page: /diagnostic]
  |-- Recharts: BarChart, AreaChart, PieChart
  |-- Skill recommendations with install links
  |-- Historical comparison (if previous snapshot exists)
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| `GmailDiagnosticPage` | Dashboard UI, chart rendering, recommendation display | `apps/web/app/(protected)/diagnostic/page.tsx` | Server actions |
| `runDiagnostic` server action | Orchestrates full scan: fetch -> classify -> aggregate -> store | `apps/web/app/actions/diagnostic.ts` | Gmail service, AI classifier, DB |
| `GmailService` | Gmail API wrapper: fetch threads, handle pagination, token refresh | `apps/web/lib/gmail-service.ts` | Gmail API via `@googleapis/gmail`, accounts table |
| `EmailClassifier` | Send metadata batches to Claude, parse structured response | `apps/web/lib/email-classifier.ts` | Anthropic SDK |
| `DiagnosticAggregator` | Compute stats from classified emails: distributions, response times, patterns | `apps/web/lib/diagnostic-aggregator.ts` | In-memory data only |
| `diagnostic_snapshots` table | Store aggregate results per user per scan | `packages/db/src/schema/diagnostic-snapshots.ts` | Drizzle ORM |
| `GmailScopeGate` | UI component: check if user has Gmail scope, show grant button if not | `apps/web/components/gmail-scope-gate.tsx` | Session (granted_scopes from JWT) |

### Data Flow

```
Gmail API  -->  Raw Metadata  -->  AI Classification  -->  Aggregation  -->  Storage
(threads)      (in-memory)        (in-memory)             (in-memory)      (DB: aggregates only)
                                                                               |
                                                                               v
                                                                          Dashboard UI
```

**Privacy boundary:** Raw metadata (From, To, Subject headers) never crosses from in-memory processing into persistent storage. Only computed aggregates (counts, percentages, averages) are stored.

## Patterns to Follow

### Pattern 1: Scope-Gated Feature Access

**What:** Check granted OAuth scopes before rendering feature UI. Show a clear "enable" path if scope is missing.
**When:** Any feature that depends on optional OAuth scopes (Gmail, Drive, Calendar).

```typescript
// components/gmail-scope-gate.tsx
"use client";

interface GmailScopeGateProps {
  grantedScopes: string | undefined;
  children: React.ReactNode;
}

export function GmailScopeGate({ grantedScopes, children }: GmailScopeGateProps) {
  const hasGmail = grantedScopes?.includes("gmail.metadata");

  if (!hasGmail) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h3 className="text-lg font-semibold text-amber-900">Gmail Access Required</h3>
        <p className="mt-2 text-sm text-amber-700">
          Sign out and sign back in to grant Gmail metadata access.
          We only read email headers -- never message content.
        </p>
        {/* Re-auth button triggers signOut + signIn with new scopes */}
      </div>
    );
  }

  return <>{children}</>;
}
```

### Pattern 2: Analyze-and-Discard Processing

**What:** Process sensitive data in-memory within a single server action invocation. Never persist raw data. Store only computed aggregates.
**When:** Any feature that processes user data from external APIs (email, calendar, files).

```typescript
// In server action -- entire pipeline is in-memory
export async function runDiagnostic(dateRange: { from: Date; to: Date }) {
  // 1. Fetch (raw metadata lives in this variable only)
  const threads = await fetchGmailThreads(userId, dateRange);

  // 2. Classify (raw metadata sent to Claude, response is categories)
  const classified = await classifyEmails(threads);

  // 3. Aggregate (convert individual classifications to statistics)
  const aggregates = computeAggregates(classified);

  // 4. Store (ONLY aggregates go to DB)
  await saveSnapshot(userId, aggregates);

  // 5. Raw data is garbage-collected when this function returns
  return aggregates;
}
```

### Pattern 3: Batched AI Classification

**What:** Send metadata to Claude in batches with structured JSON output, same pattern as skill reviews.
**When:** Processing multiple items that need AI classification.

```typescript
// lib/email-classifier.ts
const BATCH_SIZE = 75; // emails per Claude call

interface EmailMetadata {
  threadId: string;
  messageCount: number;
  subject: string;       // Truncated to 100 chars
  senderDomain: string;  // Domain only, not full email
  hasListUnsubscribe: boolean;
  timestamps: string[];  // ISO dates of each message
}

interface ClassifiedEmail {
  threadId: string;
  category: "human" | "automated" | "newsletter" | "calendar" | "transactional";
  urgency: "response_needed" | "fyi" | "ignorable";
  automationPotential: "high" | "medium" | "low";
}

async function classifyBatch(batch: EmailMetadata[]): Promise<ClassifiedEmail[]> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: CLASSIFICATION_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(batch) }],
    output_config: {
      format: { type: "json_schema", schema: CLASSIFICATION_ARRAY_SCHEMA },
    },
  });
  // Parse and validate with Zod
  return ClassifiedEmailArraySchema.parse(JSON.parse(textBlock.text));
}
```

**Privacy note in the batch data:** Send `senderDomain` (e.g., "company.com") not full email address. Send truncated subject, not full. This minimizes PII sent to the Anthropic API.

### Pattern 4: Token Refresh with Persistence

**What:** Use `google-auth-library`'s auto-refresh with a listener that updates the Auth.js `accounts` table.
**When:** Any Google API call using stored OAuth tokens.

```typescript
// lib/gmail-service.ts
oauth2Client.on("tokens", async (tokens) => {
  // Persist refreshed tokens back to accounts table
  await db.update(accounts)
    .set({
      access_token: tokens.access_token ?? undefined,
      expires_at: tokens.expiry_date
        ? Math.floor(tokens.expiry_date / 1000)
        : undefined,
      // Only update refresh_token if a new one was issued
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "google")
      )
    );
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Raw Email Metadata
**What:** Persisting individual email headers, sender addresses, or subjects to the database
**Why bad:** Creates a shadow copy of the user's email. Massive privacy liability. If breached, exposes email patterns of all users.
**Instead:** Compute aggregates in-memory, store only statistics. A category distribution (`{human: 42%}`) cannot be reverse-engineered to individual emails.

### Anti-Pattern 2: Requesting `gmail.readonly` "Just in Case"
**What:** Using the broader `gmail.readonly` scope because "we might need body access later"
**Why bad:** Over-requesting scopes reduces user trust, triggers stricter Google review, and creates temptation to access data you should not.
**Instead:** Use `gmail.metadata`. If body access is ever needed (it should not be for diagnostics), request it incrementally at that time.

### Anti-Pattern 3: Synchronous Full Scan Without Progress
**What:** Server action that takes 2 minutes with no feedback to the user
**Why bad:** User thinks it is broken, refreshes page, triggers duplicate scan, wastes API quota.
**Instead:** Return progress updates. Options: (a) streaming response with progress events, (b) poll an endpoint for scan status, (c) use `ReadableStream` from the server action to emit progress chunks.

### Anti-Pattern 4: Classifying Each Email Individually
**What:** One Claude API call per email (3,000 calls for 3,000 emails)
**Why bad:** API cost ($0.17 batched vs ~$5 individual), latency (30 batched calls vs 3,000), rate limits.
**Instead:** Batch 50-100 emails per classification call. Claude handles arrays naturally with structured output.

### Anti-Pattern 5: Displaying Individual Sender Emails
**What:** Showing "john@company.com sent you 47 emails" in the dashboard
**Why bad:** Turns a diagnostic into surveillance. Users may share reports with managers -- exposing colleague email patterns.
**Instead:** Anonymize: "Your top 5 contacts account for 60% of your email volume." Report patterns, not identities.

## Scalability Considerations

| Concern | At 10 users | At 100 users | At 1,000 users |
|---------|-------------|--------------|----------------|
| Gmail API rate limits | No concern (15K units/user/min) | No concern (per-user limit) | Per-project limit (1.2M/min) may need staggering |
| Anthropic API cost | ~$1.70/month (10 scans) | ~$17/month | ~$170/month. Consider Haiku for classification to cut cost 10x |
| Scan concurrency | No concern | May want to queue scans | Definitely queue with concurrency limit |
| Snapshot storage | Negligible (10 rows) | Minimal (100 rows) | Still small -- JSONB aggregates are ~2KB each |
| Token refresh storms | N/A | Unlikely | Possible if many tokens expire simultaneously after bulk sign-in |

**Scaling lever:** At 1,000+ users, switch classification model from Sonnet to Haiku. Classification is a well-defined task that Haiku handles well at ~10% the cost.

## Sources

- Existing `ai-review.ts` architecture for AI classification pattern
- Existing `auth.ts` and `auth.config.ts` for OAuth integration pattern
- Gmail API rate limit documentation for scalability analysis
- Anthropic pricing for cost estimates
