# Research Summary: v1.4 Employee Analytics & Remote MCP

**Project:** Relay - Internal Skill Marketplace
**Domain:** Developer Tool Catalog / Internal Platform with Employee Analytics
**Researched:** 2026-02-05
**Confidence:** HIGH

---

## Executive Summary

v1.4 transforms Relay from an anonymous skill marketplace into an enterprise-grade platform with employee-level attribution, usage analytics, and web-accessible MCP via Streamable HTTP. The research confirms that all six capabilities can be achieved by extending the existing Next.js 15 + PostgreSQL + MCP stdio architecture without major rewrites.

**The core architectural insight:** The current MCP server is stdio-only and completely anonymous. Adding authentication requires a dual-transport approach: (1) keep the existing stdio server working with optional API key via environment variable, and (2) add a new Streamable HTTP endpoint inside the Next.js app using `mcp-handler`. This avoids breaking existing users while enabling web-based Claude.ai access and employee attribution.

**Critical success factor:** Authentication cannot be retrofitted. It must be designed as a parallel system with graceful degradation (anonymous usage continues working) to avoid breaking the 500+ target employee rollout. The `usage_events.userId` column exists but is never populated — this milestone fixes that foundational gap.

**Key risks mitigated:** API key leakage (environment variables + prefix scanning), trust erosion from employee surveillance (transparency-first dashboard), and remote MCP security (Origin validation + bearer auth from day one).

---

## Key Findings

### Recommended Stack

v1.4 requires two new dependencies that integrate cleanly with the existing stack. Both are server-side only with no client bundle impact (except recharts on analytics pages).

**Core technologies:**
- **`mcp-handler` ^1.0.7** — Vercel's official adapter for hosting MCP in Next.js route handlers. Handles Streamable HTTP transport, includes `withMcpAuth` for bearer token validation. Last released Jan 9, 2026. Enables remote MCP without spinning up a separate Express server.
- **`recharts` ^3.7.0** — Most popular React charting library (24.8k stars). Used by shadcn/ui and Tremor under the hood. SVG-based, composable components that work with Tailwind CSS. ~45kb gzipped, only loaded on analytics pages.

**Database changes:**
- New `api_keys` table (id, userId, keyHash SHA-256, keyPrefix for display, name, lastUsedAt, createdAt, revokedAt)
- New `install_events` table (id, userId, platform, os, metadata jsonb, createdAt)
- Populate existing `usage_events.userId` column (currently always NULL)

**What NOT to add:**
- **Full OAuth 2.1 server** — Internal tool, employees already authenticated via Google SSO. OAuth adds authorization server, token refresh, PKCE complexity with zero benefit for single-org internal use. Simple API keys validated against DB hash are sufficient.
- **Separate Express server for remote MCP** — `mcp-handler` bridges MCP SDK to Next.js route handlers natively. Adding Express duplicates DB connections, auth logic, and deployment complexity.
- **Redis for MCP sessions** — `mcp-handler` lists Redis as dependency but only for stateful mode. Stateless mode (recommended) never connects. No need to provision Redis infrastructure.
- **Separate analytics database** — PostgreSQL handles 500 users × 100 events/month (~50k rows/month) trivially with proper indexes. Separate DB adds infrastructure for no benefit at this scale.

### Expected Features

**Must have (table stakes):**
- **Per-employee usage tracking** — `userId` populated in every MCP tool call via API key authentication
- **Org API key management** — Generate, revoke, list keys from web UI profile page
- **Install callback analytics** — Phone-home script step tracks successful installs with platform/OS metadata
- **Personal usage dashboard** — "My Usage" page showing skills used, FTE days saved, activity timeline
- **Web remote MCP** — Streamable HTTP endpoint at `/api/mcp/[transport]` for Claude.ai browser access
- **Extended search** — MCP search matches author names and tags (parity with existing web search)

**Should have (competitive, defer to next iteration):**
- Department-level analytics (requires org hierarchy data)
- API key scoping (read vs deploy permissions)
- Key rotation with grace period
- Weekly impact digest emails
- Skill adoption funnel (viewed → installed → used)

**Anti-features (explicitly NOT building):**
- **Real-time usage streaming dashboard** — Server Components with revalidation sufficient, WebSocket overhead unjustified
- **Individual employee surveillance** — Timestamp-level individual tracking is surveillance. Aggregate team metrics only; personal view is self-service.
- **Mandatory API key** — Breaks existing installations. Graceful degradation: track as anonymous if no key, show nudge to configure.
- **Cross-user usage comparison** — Comparing individual usage creates toxic competition. Leaderboard by skills contributed (existing), not skills consumed.

### Architecture Approach

All v1.4 features integrate with existing Next.js 15 App Router + Server Components architecture. The key innovation is dual-transport MCP: stdio for local use (Claude Code, Claude Desktop) and Streamable HTTP for browser use (Claude.ai).

**Major components:**
1. **API Keys service** (`packages/db/src/services/api-keys.ts`) — createKey, validateKey, revokeKey, listKeys. Stores SHA-256 hash only, never plaintext.
2. **Remote MCP endpoint** (`apps/web/app/api/mcp/[transport]/route.ts`) — Uses `mcp-handler` to serve HTTP transport, shares tool handlers with stdio server via imports.
3. **Shared tool handlers** (`apps/mcp/src/tools/*.ts`) — Existing handlers already export functions separately from registration. Both stdio and HTTP servers import the same logic.
4. **Analytics queries** (`apps/web/lib/employee-analytics.ts`) — Server Component queries aggregating `usage_events` by userId, reusing existing `platform-stats.ts` patterns.
5. **Install callback** (`apps/web/app/api/callbacks/install/route.ts`) — Bearer auth API route for phone-home tracking.

**Dual-transport MCP architecture:**
```
Browser (Claude.ai)           CLI (Claude Code/Desktop)
       |                              |
   Streamable HTTP                stdio
       |                              |
 apps/web/app/api/mcp/         apps/mcp/src/index.ts
   [transport]/route.ts          StdioServerTransport
   (mcp-handler)                 + RELAY_API_KEY env var
       |                              |
       +----------v-------------------+
          Shared Tool Handlers
          (handleListSkills, handleSearchSkills, handleDeploySkill)
                    |
                    v
          packages/db (PostgreSQL)
          trackUsage() with userId from auth context
```

**Data flow changes:**
- **BEFORE:** `Claude → stdio MCP → trackUsage(toolName, skillId) → usage_events { userId: NULL }`
- **AFTER:** `Claude → MCP (stdio or HTTP) → validate API key → trackUsage(toolName, skillId, userId) → usage_events { userId: populated }`

### Critical Pitfalls

Top 5 risks based on v1.4 research (all have concrete mitigations):

1. **Adding Auth to Existing Anonymous MCP Breaks All Current Users** (Pitfall #32) — Existing users have stdio configured without auth. Switching to mandatory auth breaks every installation simultaneously. Mitigation: Run authenticated and anonymous in parallel. Keep stdio working without API key. Add optional `RELAY_API_KEY` env var. Grace period with deprecation warnings.

2. **API Key Leakage Through MCP Config Files** (Pitfall #33) — Keys stored in config files get committed to git repos, shared in screenshots, or exposed through dotfile syncing. Mitigation: Use environment variable references (`"${RELAY_API_KEY}"`), generate keys with `rlk_` prefix for secret scanning, implement 90-day expiration with rotation reminders, run git secret scanning on company org.

3. **Stdio Transport Cannot Carry User Identity Natively** (Pitfall #35) — MCP spec says stdio "SHOULD NOT follow [OAuth] specification, and instead retrieve credentials from the environment." Claude Code/Desktop control the MCP client; Relay cannot inject auth headers into stdio pipe. Mitigation: Read identity from `RELAY_API_KEY` environment variable set during install. Validate at server startup. Cache userId for session lifetime. NEVER trust tool parameters for identity (LLM provides these).

4. **Remote MCP Server Exposed Without Authentication** (Pitfall #36) — FastMCP and MCP SDK default to no auth on HTTP transport. Developers focus on getting transport working, plan to "bolt on" auth later. Mitigation: Implement auth middleware BEFORE first HTTP endpoint goes live. Use `withMcpAuth` from mcp-handler. Return 401 with `WWW-Authenticate` header. Bind to 127.0.0.1 in development.

5. **Tracking Individual Employee Activity Without Transparency Creates Trust Crisis** (Pitfall #40) — Employees discover tracking without disclosure, react with fear/distrust. "Big Brother" narrative spreads. Adoption drops. Mitigation: Display what is tracked in UI ("Relay tracks which skills you use to calculate FTE Days Saved"). Let employees see their own data. Track WHAT (skills used), not HOW (prompt content). Aggregate team metrics by default. Publish data retention policy. Get explicit buy-in before launch.

---

## Implications for Roadmap

Based on dependency analysis, the research reveals a linear implementation order with one parallel path:

### Phase 20: API Keys & MCP Authentication (Foundation)

**Rationale:** Every authenticated feature depends on API keys. This is the foundation that unlocks MCP auth, install callbacks, and remote MCP. Without this, userId remains NULL forever.

**Delivers:**
- `api_keys` schema with migration
- API key service (createKey, validateKey, revokeKey, listKeys)
- Key validation API route (`/api/auth/validate-key`)
- MCP stdio key validation on startup (read `RELAY_API_KEY` env var, validate, cache userId)
- API key management UI on profile page (create, revoke, list with last-used timestamps)
- Key format: `rlk_` prefix + 32 random bytes (base62), SHA-256 hash storage

**Tech from STACK.md:** Drizzle ORM (existing), crypto module (built-in Node.js)

**Avoids:** Pitfall #32 (anonymous breakage) by making key optional, #33 (leakage) by using env vars + prefix scanning

**Research needs:** Standard pattern, skip `/gsd:research-phase`

---

### Phase 21: Employee Usage Tracking (Core Value)

**Rationale:** Once API keys exist, wiring userId is a small change that immediately starts collecting attributable data. Install callbacks also land here since they use the same API key validation pattern.

**Delivers:**
- Wire userId through all MCP tool handlers (search, list, deploy)
- Pass userId to `trackUsage()` in every call
- `install_events` schema with migration
- Install callback API route (`/api/callbacks/install`)
- Update install scripts with curl/Invoke-WebRequest callback step
- Middleware exemption for `/api/callbacks/` paths

**Tech from STACK.md:** Existing MCP tools, existing install script generation

**Avoids:** Pitfall #35 (stdio identity) by using environment variable, not tool parameters

**Research needs:** Standard plumbing, skip `/gsd:research-phase`

---

### Phase 22: Remote MCP (Web Access)

**Rationale:** Depends on API keys being built and auth pattern proven. The install callback API route provides precedent for auth-exempt routes. Remote MCP enables Claude.ai web users.

**Delivers:**
- Install `mcp-handler` package
- Create `/api/mcp/[transport]/route.ts` using `createMcpHandler`
- Add `withMcpAuth` for Bearer token validation
- Import shared tool handlers from `apps/mcp/src/tools/*.ts`
- Register tools with HTTP transport (same as stdio)
- Origin validation for CORS security
- Middleware exemption for `/api/mcp/` paths

**Tech from STACK.md:** `mcp-handler` ^1.0.7, `@modelcontextprotocol/sdk` ^1.26.0

**Avoids:** Pitfall #36 (no auth) by using `withMcpAuth` from day one, #37 (DNS rebinding) by validating Origin header

**Research needs:** Standard integration pattern, skip `/gsd:research-phase`

---

### Phase 23: Analytics Dashboard (Visibility)

**Rationale:** Needs data in `usage_events.userId` to be meaningful. Building after tracking has been active means there's data to display. Uses existing Server Component pattern (no new architecture).

**Delivers:**
- Employee analytics queries (`apps/web/lib/employee-analytics.ts`)
- Analytics overview page (`/analytics/page.tsx`)
- Employee list page (`/analytics/employees/page.tsx`)
- Employee detail page (`/analytics/employees/[id]/page.tsx`)
- Install analytics queries (`apps/web/lib/install-analytics.ts`)
- Chart components using recharts (area charts, bar charts, stat cards)
- "My Usage" section on profile page

**Tech from STACK.md:** `recharts` ^3.7.0, existing Drizzle queries pattern

**Avoids:** Pitfall #40 (trust crisis) by transparency-first design, self-service personal view

**Research needs:** Standard dashboard pattern, skip `/gsd:research-phase`

---

### Phase 24: Extended Search (Polish)

**Rationale:** Completely independent. Can be built in parallel with any other phase. Placed last because it's the simplest change (code refactoring, not new capabilities).

**Delivers:**
- Move `searchSkills()` from `apps/web/lib/search-skills.ts` to `packages/db/src/services/search.ts`
- Update MCP search tool to import shared search function
- Ensure MCP search matches author names and tags (same as web search)

**Tech from STACK.md:** Existing PostgreSQL full-text search, Drizzle ORM

**Avoids:** Search divergence between web and MCP

**Research needs:** Refactoring existing code, skip `/gsd:research-phase`

---

### Phase Ordering Rationale

- **API keys first** — Foundation for all auth-related features. Cannot proceed without it.
- **Tracking second** — Small change with immediate value. Install callbacks share auth pattern.
- **Remote MCP third** — Depends on API keys. Install callback proves auth-exempt route pattern.
- **Analytics fourth** — Needs populated `userId` data. Building after tracking ensures data exists.
- **Extended search last** — Independent, simple refactoring. Can be parallelized but has lowest priority.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 20:** API key management is well-established pattern (GitHub PATs, Notion API keys)
- **Phase 21:** Plumbing userId through existing code paths
- **Phase 22:** `mcp-handler` is documented with examples
- **Phase 23:** Server Component data fetching matches existing homepage pattern
- **Phase 24:** Refactoring existing search function

**Potential uncertainty (MEDIUM confidence):**
- **Phase 22:** Exact CORS headers required by Claude.ai web (test during implementation)
- **Phase 22:** OAuth vs API key for Claude.ai connectors (research suggests API key works for custom connectors)

**No phases need `/gsd:research-phase`** — All patterns are standard or documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | `mcp-handler` verified on npm (v1.0.7, last updated Jan 9, 2026). `recharts` is de facto standard (24.8k stars). Both have active maintenance. |
| **Features** | HIGH | Table stakes align with enterprise rollout requirements. Anti-features prevent scope creep. Deferral rationale is sound (OAuth is complex, department analytics needs org data). |
| **Architecture** | HIGH | Dual-transport approach preserves backward compatibility. Shared tool handlers avoid code duplication. New schemas follow existing Drizzle patterns. Server Component data fetching matches homepage/profile. |
| **Pitfalls** | HIGH | Critical pitfalls have concrete mitigations. All major risks (key leakage, anonymous breakage, auth bypass, trust crisis) addressed. MCP spec warnings directly incorporated. |

**Overall Confidence: HIGH**

The research is internally consistent, backed by official documentation (MCP spec, mcp-handler GitHub, Claude API docs), and grounded in existing codebase patterns. The four parallel researchers identified the same architectural approach (dual-transport MCP, environment-based stdio auth, HTTP bearer auth) without coordination, suggesting convergence on the correct solution.

### Gaps to Address

**Minor gaps (address during implementation):**
1. Exact Claude.ai connector requirements for OAuth vs. API key (test both paths during Phase 22)
2. CORS header specifics for Claude.ai requests (MCP spec provides guidance, verify empirically)
3. PostgreSQL query performance with 100k+ usage_events (add indexes on `user_id` and `created_at` if slow)
4. API key rotation UX details (grace period overlap, renewal reminders)

**Not gaps (explicitly deferred to next milestone):**
- Full OAuth 2.1 server implementation (deferred to v1.5+)
- Multi-tenant API key scoping (start with user-level, add later if needed)
- Real-time analytics (Server Components sufficient, no streaming needed)
- Department-level analytics (requires org hierarchy data not yet available)

---

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — v1.26.0, StreamableHTTPServerTransport API
- [MCP Transports Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP protocol definition
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) — OAuth 2.1, bearer token flow, stdio environment credentials
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) — v1.0.7, createMcpHandler, withMcpAuth API
- [mcp-handler npm](https://www.npmjs.com/package/mcp-handler) — Package verified Jan 9, 2026
- [Recharts](https://recharts.org/) — v3.7.0 documentation
- [Claude Remote MCP Server Guide](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) — OAuth requirement, callback URL, DCR support
- [Claude API Rate Limits](https://docs.claude.com/en/api/rate-limits) — Token bucket algorithm, ITPM limits, prompt caching
- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — Hybrid rendering patterns

### Secondary (MEDIUM confidence)
- [Auth0 MCP Security Blog](https://auth0.com/blog/mcp-streamable-http/) — Streamable HTTP security benefits over SSE
- [Vercel MCP Template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js) — Next.js route handler pattern
- [API Key Management Best Practices - MultitaskAI](https://multitaskai.com/blog/api-key-management-best-practices/) — Hashing, rotation, 32+ character keys
- [API Key Security Best Practices 2026 - DEV](https://dev.to/alixd/api-key-security-best-practices-for-2026-1n5d) — Prefix patterns, storage
- [Workplace Privacy Report - Employee Monitoring](https://www.workplaceprivacyreport.com/2025/06/articles/artificial-intelligence/managing-the-managers-governance-risks-and-considerations-for-employee-monitoring-platforms/) — Privacy-first dashboard design

### Existing Codebase (HIGH confidence)
- `/home/dev/projects/relay/apps/mcp/src/index.ts` — StdioServerTransport, no auth
- `/home/dev/projects/relay/apps/mcp/src/tools/*.ts` — Exported handler functions (handleListSkills, handleSearchSkills, handleDeploySkill)
- `/home/dev/projects/relay/apps/mcp/src/tracking/events.ts` — trackUsage() with optional userId parameter
- `/home/dev/projects/relay/packages/db/src/schema/usage-events.ts` — userId column exists, always NULL
- `/home/dev/projects/relay/apps/web/lib/search-skills.ts` — Full search with author + tags (ILIKE fallback)
- `/home/dev/projects/relay/apps/web/middleware.ts` — Auth redirect with API route exemptions
- `/home/dev/projects/relay/apps/web/auth.ts` — Auth.js v5, Google SSO, JWT strategy

---

*Research completed: 2026-02-05*
*Ready for roadmap: yes*
