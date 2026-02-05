# Phase 22: Web Remote MCP - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose the existing MCP tools (list, search, deploy) over Streamable HTTP so Claude.ai browser users can access Relay skills. This is a transport layer addition — the tools already exist and work over stdio. This phase adds an HTTP entry point with bearer token auth and CORS.

</domain>

<decisions>
## Implementation Decisions

### Endpoint design
- Next.js API route inside the existing web app (not a separate service)
- Route structure: `/api/mcp/[transport]` with dynamic segment for future transport variants
- Stateless — each request includes bearer token and is fully self-contained
- Shareable config link — Relay provides a "Connect to Claude.ai" button that copies/opens a config URL for easy setup

### Transport behavior
- Simple JSON request/response — no SSE streaming, each MCP call returns a single JSON payload
- Errors use MCP error protocol — proper JSON-RPC error objects with codes, not HTTP status codes for app-level errors
- Rate limiting per API key (e.g., 60 req/min) to prevent abuse
- 60 second request timeout to accommodate slow DB queries or large skill content

### Parity & differences
- Deploy over HTTP returns content + usage hint ("This skill is now available in this conversation") since there's no local file system in browser context
- Same 3 tools (list, search, deploy) plus a new server info tool that returns Relay version, connected user info, and available categories
- No transport distinction in usage tracking — a deploy is a deploy regardless of transport

### Claude's Discretion
- Whether to skip the anonymous nudge for HTTP (HTTP requires auth by definition, so nudge may be irrelevant)
- CORS origin allowlist specifics (needs empirical testing with Claude.ai)
- Exact rate limit numbers
- Server info tool response shape

</decisions>

<specifics>
## Specific Ideas

- The "Connect to Claude.ai" button should make setup as frictionless as possible — one click to get connected
- Deploy responses should feel natural in a conversation context rather than referencing local file system operations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-web-remote-mcp*
*Context gathered: 2026-02-05*
