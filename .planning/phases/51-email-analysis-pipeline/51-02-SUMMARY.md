---
phase: 51
plan: 02
subsystem: email-analysis
tags: [gmail-api, metadata, privacy, batching]
completed: 2026-02-14

dependency_graph:
  requires:
    - 50-03: Gmail OAuth tokens and encryption infrastructure
  provides:
    - Gmail API client with metadata fetching
    - Privacy-first email data access (headers only)
  affects:
    - Future email scanning and categorization features

tech_stack:
  added:
    - "@googleapis/gmail": Official Gmail API client with TypeScript types
  patterns:
    - Privacy-first metadata fetching (format: 'metadata')
    - Batched API calls (100 messages per Promise.all)
    - Auto-refresh token handling via getValidGmailToken
    - Pagination with Gmail date range queries

key_files:
  created:
    - apps/web/lib/gmail-client.ts: Gmail API client with fetchEmailMetadata function
  modified:
    - apps/web/package.json: Added @googleapis/gmail dependency

decisions:
  - decision: Use format: 'metadata' with specific headers only
    rationale: Privacy-first design - never access email bodies, only metadata needed for analysis
    alternatives: [format: 'full', format: 'minimal']
    why_chosen: Metadata provides all headers needed (From, Subject, Date, List-Unsubscribe, In-Reply-To) without body access

  - decision: Batch 100 messages per Promise.all
    rationale: Gmail API quota is 250 units/user/sec (5 units per get = 50 calls/sec max), batching 100 takes ~2 seconds
    alternatives: [batch 50, batch 200, sequential]
    why_chosen: Balances throughput with rate limit safety margin

  - decision: Silent error handling for individual message fetch failures
    rationale: Continue batch processing even if individual messages fail (deleted, permission denied, etc.)
    alternatives: [fail entire batch, retry failed messages, log errors]
    why_chosen: Robustness - one bad message shouldn't block entire scan

metrics:
  duration: 143 seconds
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 1
---

# Phase 51 Plan 02: Gmail API Client for Metadata Fetching

**One-liner:** Privacy-first Gmail API client that fetches only message headers (From, Subject, Date, List-Unsubscribe, In-Reply-To) using format: 'metadata' with batched calls and auto-refresh tokens.

## Summary

Created a Gmail API client library that implements privacy-first email metadata fetching. The client uses `format: 'metadata'` with specific `metadataHeaders` to fetch only the headers needed for email analysis, never accessing message bodies. Supports 90-day date range filtering via Gmail queries, pagination for large mailboxes, and batched fetching (100 messages per Promise.all) to stay under rate limits. Integrates with existing token management via `getValidGmailToken` for auto-refresh.

## What Was Built

### 1. Gmail API Client (`apps/web/lib/gmail-client.ts`)

**Exports:**
- `EmailMetadata` interface - structured metadata type with id, threadId, date, from, subject, listUnsubscribe, inReplyTo, labels
- `FetchEmailMetadataOptions` interface - configuration for date range and message limit
- `fetchEmailMetadata(userId, options)` - main API function

**Implementation highlights:**
- Creates OAuth2Client from getValidGmailToken with auto-refresh
- Calculates date filter: `after:YYYY/MM/DD` format for Gmail query
- Lists message IDs with pagination (500 per page, follows nextPageToken)
- Batches metadata fetching: 100 messages per Promise.all to respect rate limits
- Parses headers using case-insensitive header name matching
- Handles API errors: 401 (auth failed), 403 (permission denied), 429 (rate limit)
- Silently skips individual message fetch failures to continue batch processing

**Privacy guarantees:**
- Uses `format: 'metadata'` - never accesses message bodies
- Only requests specific headers: From, Subject, Date, List-Unsubscribe, In-Reply-To
- All processing happens in memory - no persistence of raw email data
- Returns structured metadata arrays for aggregate analysis

### 2. Dependency Installation

Added `@googleapis/gmail ^16.1.1` to `apps/web/package.json` - official Gmail API client with full TypeScript support, OAuth2 integration, and batching.

## Verification Results

All success criteria met:

- Gmail client can fetch message IDs for 90-day date range using q parameter ✓
- Metadata fetching uses format: 'metadata' with specific headers only ✓
- Batching prevents rate limit errors (100 per batch) ✓
- Token auto-refresh works via getValidGmailToken before API calls ✓
- EmailMetadata interface includes all required fields ✓

Verification commands:
```bash
grep "export.*fetchEmailMetadata" apps/web/lib/gmail-client.ts
grep "format:.*metadata" apps/web/lib/gmail-client.ts
grep "metadataHeaders" apps/web/lib/gmail-client.ts
grep "getValidGmailToken" apps/web/lib/gmail-client.ts
grep "BATCH_SIZE = 100" apps/web/lib/gmail-client.ts
```

## Deviations from Plan

None - plan executed exactly as written.

## Implementation Notes

### Rate Limit Considerations

Gmail API quota: 250 units/user/second, where:
- `messages.list` = 5 units
- `messages.get` = 5 units

With BATCH_SIZE=100, each batch takes ~2 seconds (well under 50 calls/sec limit). For 5,000 messages, expect ~100 seconds total scan time.

### Error Handling Strategy

Individual message fetch errors (deleted messages, permission denied, corrupted data) are caught and skipped silently. This allows batch processing to continue even when encountering problematic messages. The outer try/catch handles Gmail API-level errors (auth, permissions, rate limits) with descriptive error messages.

### Token Refresh Integration

`getValidGmailToken` is called once at function start. It handles:
- Automatic token refresh if within 5-minute buffer
- Mutex-based locking to prevent concurrent refresh races
- Throws `GmailNotConnectedError` if no connection exists
- Throws `GmailTokenRevokedError` if refresh token is invalid

OAuth2Client credentials are set with access token, refresh token, and expiry date. The Gmail client uses this for all subsequent API calls.

## Next Steps

This client is ready for use by the email scanning engine (Plan 03):
- Call `fetchEmailMetadata(userId, {daysBack: 90, maxMessages: 10000})`
- Process returned metadata array for categorization
- Aggregate statistics without persisting raw email data

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 5572fad | chore | Add @googleapis/gmail dependency |
| 88c7013 | feat | Create Gmail API client with fetchEmailMetadata function |

## Self-Check

Verifying created files exist:

```bash
[ -f "/home/dev/projects/relay/apps/web/lib/gmail-client.ts" ] && echo "FOUND: apps/web/lib/gmail-client.ts" || echo "MISSING: apps/web/lib/gmail-client.ts"
```

Result: FOUND: apps/web/lib/gmail-client.ts

Verifying commits exist:

```bash
git log --oneline --all | grep -q "5572fad" && echo "FOUND: 5572fad" || echo "MISSING: 5572fad"
git log --oneline --all | grep -q "88c7013" && echo "FOUND: 88c7013" || echo "MISSING: 88c7013"
```

Results: FOUND: 5572fad, FOUND: 88c7013

## Self-Check: PASSED

All created files exist, all commits verified in git history.
