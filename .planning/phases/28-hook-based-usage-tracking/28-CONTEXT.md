# Phase 28: Hook-Based Usage Tracking - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Every Claude Code tool invocation against a deployed skill is deterministically tracked via PostToolUse hooks firing to the production endpoint. Replaces the honor-system `log_skill_usage` MCP tool with automatic, invisible tracking. Hooks are injected into skill files on upload and verified on deploy.

</domain>

<decisions>
## Implementation Decisions

### Hook injection strategy
- Inject hooks at upload time (server-side, after content submission) AND verify/refresh on deploy
- Hooks are **invisible** to the skill author — injected server-side, never shown in the authoring UI
- Hook type: **PostToolUse only** — fires after each tool invocation within the skill
- Payload includes **full context**: skill ID, timestamp, tool name, user API key, tool input/output snippets for rich analytics

### Tracking endpoint design
- `POST /api/track` endpoint
- Auth: **Bearer token (API key)** — simplest SOC2-compliant approach. API key resolves to userId + tenantId, scoping every event to its tenant. HTTPS provides transport security.
- Rate limiting: **100 requests/minute per API key**
- Response: **Minimal ACK** — just 200 OK or 4xx/5xx status code. No data returned to the hook.
- Data handling: **Validate + enrich** — validate required fields, normalize timestamps to UTC, reject malformed payloads, resolve skill name from ID, add server timestamp

### API key lifecycle
- Expiration: **Soft expiry** — expired keys keep working but are flagged in the system. Admin dashboard shows which users have expired keys. No tracking interruption.
- Notification: **Dashboard + admin alert** — dashboard shows key status/expiry dates, tenant admins get a summary of expiring/expired keys (email delivery deferred to Phase 33)
- Expiry policy: **Per-tenant configurable** — tenant admins can set key expiry duration (e.g., 30/60/90/180 days). Default 90 days.
- Multi-key: **Multiple active keys allowed** per user — supports multi-device usage (one key per machine)

### Failure & resilience
- Retry policy: **Retry once after 5 seconds** on failure (network error, 5xx, timeout)
- User visibility: **Silent with local log** — no user-visible output in Claude Code, but failures logged to a local file for debugging
- Deduplication: **None** — every callback counts as one event, including retries. Accept minor inflation over complexity.
- Extended downtime: **Local queue on user machine** — failed events are queued locally and retried later when endpoint is reachable. No data loss.

### Claude's Discretion
- Hook frontmatter syntax and exact curl command structure
- Local queue implementation details (file-based, SQLite, etc.)
- Server-side validation rules for required fields
- Enrichment query optimization (batch vs per-request skill name resolution)
- Exact error response codes and messages

</decisions>

<specifics>
## Specific Ideas

- Hook should use async curl (fire-and-forget from Claude Code's perspective) to never block the user's session
- The `EVERYSKILL_API_KEY` env var is already established in the MCP auth flow — reuse the same key for hook auth
- Full context in payloads enables future analytics like "which tools are most used per skill" and "average tool call duration"
- Soft expiry chosen because hard-blocking tracking over an expired key punishes the org's analytics, not the user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-hook-based-usage-tracking*
*Context gathered: 2026-02-08*
