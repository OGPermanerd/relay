# Feature Landscape: Employee Analytics, MCP Auth, Remote MCP

**Domain:** Internal skill marketplace -- per-employee usage tracking, API key auth, install analytics, usage dashboards, web remote MCP, extended search
**Researched:** 2026-02-05
**Confidence:** HIGH for auth/analytics patterns, MEDIUM for remote MCP Claude.ai integration specifics

## Context

Relay is an internal skill marketplace with a critical gap: the MCP server runs as an anonymous local stdio process. Usage events are tracked, but `userId` is never set because the MCP server has no authentication. Enterprise rollout (500+ users) requires knowing WHO is using WHICH skills. This milestone addresses identity, analytics, remote access, and search completeness.

**Existing infrastructure being extended:**
- `usage_events` table with `userId` column (always NULL today)
- `trackUsage()` function in MCP server (no identity)
- Google Workspace SSO on web app (Auth.js + DrizzleAdapter)
- Full-text search with `searchVector` tsvector on name/description
- Web search already matches author name and tags via ILIKE (line 68-69 of search-skills.ts)
- MCP search only matches name/description in-memory (no tags, no author)
- `@modelcontextprotocol/sdk` v1.25.3 installed (has `StreamableHTTPServerTransport`, `AuthInfo`, `requireBearerAuth`)
- Platform stats dashboard with aggregate FTE Days Saved, contributor leaderboard
- Install modal generates platform-specific bash/PowerShell scripts (download only, no callback)

---

## Table Stakes

Features users expect. Missing these = the feature feels broken or incomplete.

### 1. Per-Employee MCP Usage Tracking

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| User identity in usage events | Cannot answer "who uses what" without it | LOW | API key auth (#2) |
| userId populated on every tool call | Existing column is always NULL; must fill it | LOW | API key resolution to userId |
| Graceful degradation for unauthenticated use | Users with old config should not break | LOW | None |
| Usage attribution in metadata | Include user email/name in event metadata for debugging | LOW | API key lookup |

**Expected behavior:** Every MCP tool invocation (list_skills, search_skills, deploy_skill) records the authenticated user's ID in `usage_events.userId`. If no API key is provided, tracking continues anonymously (backward compatible). The trackUsage call already accepts userId -- it just needs to be passed from the authentication layer.

**Implementation pattern:** The MCP SDK's `StreamableHTTPServerTransport.handleRequest()` accepts `req.auth?: AuthInfo`. For stdio transport, the authentication token should come from environment variables (standard MCP pattern per spec: "Implementations using STDIO transport SHOULD retrieve credentials from the environment"). The API key resolves to a userId via database lookup, and that userId flows into trackUsage().

**Confidence:** HIGH -- The `usage_events` table already has the `userId` column with a foreign key to `users.id`. The `trackUsage()` function accepts it as an optional field. This is a plumbing exercise.

### 2. API Key Management for MCP Authentication

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Generate API key from web UI | Users need a key to configure MCP | LOW | Auth (existing SSO) |
| View active API keys | See what keys exist | LOW | API keys table |
| Revoke API key | Security hygiene | LOW | Soft delete or hard delete |
| API key shown once on creation | Standard security pattern -- never show full key again | LOW | Hash storage |
| Key prefix for identification | `rlk_...` prefix to identify Relay keys in config files | LOW | Generation logic |
| Copy-to-clipboard for new key | Reduce friction in install flow | LOW | Existing clipboard pattern |
| Key hashing in database | Store SHA-256 hash, not plaintext | MEDIUM | Crypto implementation |
| Key linked to user account | 1:N relationship user->keys | LOW | Foreign key |

**Expected behavior:** Users visit their profile or a settings page, click "Generate API Key," receive a key like `rlk_a1b2c3d4e5f6...` shown exactly once. The key is stored as a SHA-256 hash in an `api_keys` table. The key prefix (`rlk_`) is stored in cleartext for display (e.g., "rlk_a1b2...created Jan 15"). When the MCP server receives a request with an API key, it hashes the key and looks up the matching row to resolve the userId.

**API key schema pattern:**
```
api_keys table:
  id: uuid PK
  userId: text FK -> users.id
  keyPrefix: text (first 8 chars, e.g., "rlk_a1b2")
  keyHash: text (SHA-256 of full key)
  name: text (user-supplied label, e.g., "Work laptop")
  lastUsedAt: timestamp
  createdAt: timestamp
  revokedAt: timestamp (NULL = active)
```

**Key generation pattern:** `rlk_` + 32 bytes of `crypto.randomBytes()` encoded as base62. Total key length ~48 characters. Industry standard is 32+ random characters. Store only SHA-256 hash. Show full key exactly once at creation.

**Why NOT OAuth for local MCP:** The MCP spec says "Implementations using STDIO transport SHOULD NOT follow [the OAuth] specification, and instead retrieve credentials from the environment." API keys are the correct pattern for local stdio servers. OAuth is for remote HTTP servers (covered in feature #5). This aligns with how GitHub Personal Access Tokens, Notion API keys, and Brave API keys work with their respective MCP servers.

**Confidence:** HIGH -- This is an extremely well-established pattern. The MCP ecosystem universally uses environment variable API keys for stdio servers (GITHUB_PERSONAL_ACCESS_TOKEN, NOTION_API_KEY, SLACK_BOT_TOKEN, etc.).

### 3. Install Callback/Analytics

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Track install script downloads | Know how many people downloaded the script | LOW | Button click event |
| Phone-home on successful install | Confirm script ran successfully | MEDIUM | API endpoint + script modification |
| Per-user install tracking | Know which users installed (with auth) | LOW | SSO session |
| Install success/failure status | Distinguish download from completion | MEDIUM | Callback endpoint |
| Platform breakdown | macOS vs Windows vs Linux installs | LOW | OS detection (existing) |

**Expected behavior:** When a user clicks "Install" and downloads the script, a web analytics event fires. The install script itself, after successfully writing the config, makes a POST request back to a Relay API endpoint (e.g., `POST /api/install-callback`) with: `{ userId, platform, success: true/false, timestamp }`. This enables a two-stage funnel: "downloaded script" vs "successfully installed."

**Phone-home pattern:** The install scripts (bash/PowerShell) already use `node` to merge JSON config. Adding a `curl` or `fetch` call at the end is trivial. The callback endpoint should be unauthenticated but rate-limited (to allow installs before API key setup). It should accept a one-time install token generated when the script is downloaded.

**Install events table:**
```
install_events table:
  id: uuid PK
  userId: text FK -> users.id (nullable for anonymous)
  platform: text ('macos' | 'windows' | 'linux' | 'claude-code')
  status: text ('downloaded' | 'installed' | 'failed')
  installToken: text (one-time token, ties download to callback)
  userAgent: text
  createdAt: timestamp
```

**Confidence:** HIGH -- CLI analytics callback patterns are well-documented. The key insight from BetterCLI.org: use your own facade endpoint (POST /api/install-callback), not a third-party analytics service. This keeps data in-house and avoids exposing an unprotected analytics endpoint to the internet.

### 4. Per-Employee Usage Analytics Dashboard

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Personal usage history | "What skills have I used?" | MEDIUM | userId in usage_events (#1) |
| Usage frequency per skill | "How often do I use X?" | LOW | GROUP BY query |
| Personal FTE Days Saved | Individual impact metric | LOW | Existing calculation pattern |
| Time-series usage chart | Usage trend over last 30 days | MEDIUM | Existing sparkline pattern |
| Top skills used by this user | Ranked list of personal favorites | LOW | ORDER BY count |
| Team/org aggregate view (manager) | "What does my team use?" | MEDIUM | Role-based access |
| Export personal data | GDPR-adjacent self-service | LOW | CSV/JSON download |

**Expected behavior:** Each user has a "My Usage" section on their profile page or a dedicated analytics page. Shows: total tool invocations, unique skills used, personal FTE Days Saved, usage trend sparkline, and a table of most-used skills. The existing `getUsageTrends()` pattern can be extended with a WHERE userId = ? filter. Privacy-first: users see only their own data unless they have a manager role.

**Dashboard views pattern (three-tier):**
1. **Personal view** (default): Your own usage, always visible to you
2. **Team view** (manager): Aggregate stats for direct reports, no individual drill-down by default
3. **Platform view** (admin): Already exists -- aggregate FTE Days Saved, leaderboard

**Privacy considerations for internal tools:** Show aggregate patterns, not surveillance timestamps. "Alice used 47 skills this month" is useful. "Alice used deploy_skill at 11:43pm on Saturday" is creepy. Aggregate to day-level minimum. Let employees see what is tracked about them (self-visibility builds trust).

**Confidence:** HIGH -- The existing platform-stats.ts and usage-trends.ts patterns translate directly. This is adding a userId WHERE clause to proven queries.

### 5. Web Remote MCP (Streamable HTTP Transport)

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Streamable HTTP endpoint (`/mcp`) | Required for remote MCP per spec | HIGH | New Express server or Next.js API route |
| OAuth 2.1 authorization flow | Required for Claude.ai connectors | HIGH | Auth server implementation |
| Session management | Stateful or stateless transport | MEDIUM | Transport configuration |
| Tool registration (same tools) | list_skills, search_skills, deploy_skill | LOW | Reuse existing tool handlers |
| Claude.ai connector compatibility | Works when added as custom connector | HIGH | OAuth callback, metadata endpoints |
| HTTPS requirement | All auth endpoints must be HTTPS | LOW | Deployment config |

**Expected behavior:** A publicly accessible HTTPS endpoint (e.g., `https://relay.company.com/mcp`) serves the same three tools as the stdio server. Claude.ai users (Pro/Max/Team/Enterprise plans) add this URL as a custom connector via Settings > Connectors. On first use, an OAuth flow authenticates the user (via Google Workspace SSO, same as web app). After authentication, the user's identity flows through the `AuthInfo.extra` field to `trackUsage()`.

**Critical detail -- Claude.ai connector requirements:**
- Claude.ai requires OAuth (not simple API keys) for remote connectors
- Claude supports Dynamic Client Registration (DCR)
- Claude's OAuth callback URL: `https://claude.ai/api/mcp/auth_callback`
- Custom Client ID and Client Secret can be specified in "Advanced settings"
- Claude supports tools, prompts, and resources
- Available on Pro, Max, Team, and Enterprise plans

**MCP SDK v1.25.3 already provides:**
- `StreamableHTTPServerTransport` -- handles POST/GET on /mcp endpoint
- `requireBearerAuth()` middleware -- validates Bearer tokens
- `OAuthServerProvider` interface -- full OAuth 2.1 server
- `OAuthTokenVerifier` interface -- slim token verification
- `AuthInfo` type with `extra?: Record<string, unknown>` for user data
- `createMcpExpressApp()` -- pre-configured Express app with DNS rebinding protection

**Architecture decision -- where to host:**
- **Option A: Separate Express server** (recommended) -- New `apps/remote-mcp/` package using `createMcpExpressApp()`. Clean separation. Can be deployed independently.
- **Option B: Next.js API route** -- Embed /mcp endpoint in the existing web app. Simpler deployment but mixes concerns. Next.js 16+ supports streaming responses needed for SSE.

Recommendation: **Option A** because remote MCP has different scaling needs (long-lived connections, SSE streams) than the web app (request/response). Also keeps the MCP SDK dependency out of the web app.

**OAuth integration approach:**
The MCP server acts as both OAuth authorization server and resource server, delegating actual authentication to Google Workspace SSO (same identity provider as the web app). The `OAuthServerProvider` interface in the SDK handles the authorize/token/register endpoints. The `verifyAccessToken()` method resolves the token to an `AuthInfo` with `extra.userId` populated.

**Confidence:** MEDIUM -- The MCP SDK has all the building blocks (verified by reading the installed v1.25.3 type definitions). Claude.ai connector setup is documented. The uncertainty is in the OAuth server implementation complexity -- the SDK provides the interface but building a compliant OAuth server is non-trivial. Consider using Auth0 or a lightweight adapter over the existing Auth.js setup.

### 6. Extended Search (Author Names and Tags in MCP)

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Search by author name in MCP | "Search skills by Alice" | MEDIUM | JOIN with users table in MCP |
| Search by tags in MCP | "Search skills tagged 'code-review'" | MEDIUM | Query tags array |
| Include tags in full-text search vector | Tags should boost search relevance | LOW | Schema migration |
| Author name in search results | Show who made the skill | LOW | Add to result payload |
| Tags in search results | Show skill tags | LOW | Add to result payload |

**Expected behavior:** The MCP `search_skills` tool should match against author names and tags in addition to skill name and description. When a user asks Claude "find code review skills by Alice," the search should match on both the topic and the author. The web app already does this (line 68-69 of search-skills.ts has `users.name ILIKE` and `array_to_string(tags, ' ') ILIKE`), but the MCP server does simple in-memory name/description filtering.

**Current gap analysis:**
- Web search: matches name, description, author name, tags (with ILIKE fallback) -- COMPLETE
- MCP search: matches name, description only (in-memory filter) -- INCOMPLETE
- Full-text search vector: only includes name (weight A) and description (weight B) -- MISSING tags

**Implementation approach:**
1. Update `searchVector` generated column to include tags: `setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')`
2. Rewrite MCP search_skills to use the database full-text search (like the web version) instead of in-memory filtering
3. Include author name via JOIN
4. Return tags and author name in MCP search results

**Confidence:** HIGH -- The web app already implements this exact pattern. The MCP server just needs to be brought to parity.

---

## Differentiators

Features that set Relay apart from other internal tool marketplaces. Not required but high-value.

### Per-Employee Analytics

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Skills I Use" recommendations | ML-based personal recommendations from usage history | HIGH | Requires usage volume first |
| Department-level analytics | "Engineering uses X, Design uses Y" | MEDIUM | Requires org hierarchy mapping |
| Impact attribution | "Alice's skills saved the company 47 FTE days" | LOW | Extend leaderboard with user filtering |
| Usage heatmap by day/hour | Visual patterns of when skills are used | MEDIUM | date_trunc aggregation |
| Skill adoption funnel | Viewed -> Installed -> Used -> Repeated | MEDIUM | Multi-event correlation |
| Weekly digest email | "You saved 3.2 FTE days this week" | MEDIUM | Email service integration |

### MCP Authentication

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| API key scoping (read-only vs deploy) | Fine-grained permissions per key | MEDIUM | Scope column on api_keys |
| Key rotation with grace period | Both old and new key work during transition | MEDIUM | Overlap window logic |
| Usage alerts | "Your key was used 1000 times today" | MEDIUM | Threshold monitoring |
| Key expiry with auto-renewal prompt | Keys expire after 90 days, nudge to rotate | LOW | TTL column + cron check |
| SSO-linked key provisioning | Auto-generate key on first SSO login | LOW | Callback hook in Auth.js |

### Remote MCP

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Prompts and Resources (not just Tools) | Expose skill content as MCP resources | MEDIUM | MCP SDK supports all three |
| Server-sent notifications | Push new skill alerts to connected clients | HIGH | SSE streaming via GET |
| Mobile support via Claude iOS/Android | Remote MCP works on mobile too | LOW | Free if web connector works |
| Multi-tenant support | Shared server, isolated per-org data | HIGH | Token scoping |

### Install Analytics

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Install-to-first-use funnel | Track conversion from install to active usage | MEDIUM | Correlate install_events with usage_events |
| Automated install health check | Script verifies config is loadable after write | LOW | Node.js JSON.parse in script |
| Reinstall detection | Distinguish fresh install from reconfiguration | LOW | Check for existing config entry |
| Platform usage correlation | "Windows users deploy 2x more skills" | LOW | Join install_events with usage_events |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Tempting | Why Problematic | Do Instead |
|--------------|-------------|-----------------|------------|
| **Full OAuth for local stdio MCP** | "OAuth is more secure" | MCP spec explicitly says stdio should use environment credentials, not OAuth. Adds massive complexity for zero benefit on local connections. | API key in environment variable, matching ecosystem patterns (GITHUB_PERSONAL_ACCESS_TOKEN, etc.) |
| **Real-time usage streaming dashboard** | "Live analytics are cool" | WebSocket overhead for an internal tool with ~500 users is unjustified. Server Components with revalidation sufficient. | Refresh on navigation; 5-minute cache if needed |
| **Individual employee surveillance** | "Managers want to see everything" | Destroys trust, violates privacy norms, legal risk in many jurisdictions. Timestamp-level individual tracking is surveillance. | Aggregate team metrics; personal view is self-service only |
| **Mandatory API key for MCP** | "Force everyone to authenticate" | Breaks existing installations. Users with old config get 401 errors. | Graceful degradation: track as anonymous if no key, but show nudge to configure key |
| **Custom OAuth server from scratch** | "Full control" | OAuth is complex and security-critical. Bugs lead to token leaks. | Use MCP SDK's built-in auth framework + delegate to existing identity provider (Google Workspace SSO) |
| **API key in URL query parameters** | "Easier to configure" | Keys visible in server logs, browser history, proxy logs. MCP spec explicitly forbids access tokens in URI query string. | Authorization: Bearer header for HTTP; environment variable for stdio |
| **Install scripts that auto-restart Claude** | "Seamless experience" | Killing user processes without consent is hostile UX. Different Claude versions have different process names. | Show "Restart Claude Desktop to activate" message |
| **Cross-user usage comparison** | "Gamification" | Comparing individual usage creates toxic competition. "Low usage" is not "low value." | Leaderboard by skills contributed (existing), not skills consumed |
| **Blocking search without auth** | "Protect data" | Skills are internal, not secret. Adding friction to discovery hurts adoption. | Allow unauthenticated read; require auth only for deploy_skill tracking |
| **Phone-home with PII in install script** | "Identify the installer" | Script runs before API key exists. Sending email/name from environment is a privacy violation. | Use one-time install token generated at download time, resolve to userId server-side |

---

## Feature Dependencies

```
[API Key Management] (#2)
    |--requires--> [SSO Authentication] (existing Google Workspace)
    |--creates---> [api_keys table] (new)
    |--enables---> [Per-Employee MCP Usage Tracking] (#1)
    |--enables---> [Per-Employee Usage Dashboard] (#4)

[Per-Employee MCP Usage Tracking] (#1)
    |--requires--> [API Key Management] (#2)
    |--extends---> [usage_events table] (existing, userId column)
    |--extends---> [trackUsage()] (existing function)
    |--feeds-----> [Per-Employee Usage Dashboard] (#4)

[Install Callback/Analytics] (#3)
    |--extends---> [Install Scripts] (existing bash/PowerShell)
    |--requires--> [API endpoint] (new /api/install-callback)
    |--creates---> [install_events table] (new)
    |--enhances--> [Platform Stats Dashboard] (existing)
    |--independent of--> [API Key Management] (uses install token, not API key)

[Per-Employee Usage Dashboard] (#4)
    |--requires--> [Per-Employee MCP Usage Tracking] (#1)
    |--extends---> [Profile Page] (existing /profile)
    |--reuses----> [usage-trends.ts pattern] (existing)
    |--reuses----> [platform-stats.ts pattern] (existing)
    |--reuses----> [sparkline components] (existing react-sparklines)

[Web Remote MCP] (#5)
    |--requires--> [OAuth 2.1 Server] (new, using MCP SDK auth)
    |--requires--> [StreamableHTTPServerTransport] (MCP SDK v1.25.3)
    |--reuses----> [Tool Handlers] (existing list/search/deploy)
    |--requires--> [HTTPS Deployment] (infrastructure)
    |--enables---> [Claude.ai Integration] (Pro/Max/Team/Enterprise)
    |--uses------> [Per-Employee Tracking] (#1) via AuthInfo

[Extended Search] (#6)
    |--extends---> [MCP search_skills tool] (existing)
    |--extends---> [searchVector generated column] (existing)
    |--references-> [Web search-skills.ts] (existing pattern to replicate)
    |--independent of--> [Authentication] (search works without auth)
```

### Critical Path

```
API Key Management (#2)
    --> Per-Employee Tracking (#1)
        --> Per-Employee Dashboard (#4)

Extended Search (#6) -- independent, can parallelize

Install Analytics (#3) -- independent, can parallelize

Web Remote MCP (#5) -- independent of #1-4 but benefits from them
```

---

## MVP Recommendation

### Must Have for This Milestone

**API Key Management (#2) -- Build First:**
- [ ] `api_keys` table (id, userId, keyPrefix, keyHash, name, lastUsedAt, createdAt, revokedAt)
- [ ] Generate key endpoint (POST /api/keys)
- [ ] List keys endpoint (GET /api/keys)
- [ ] Revoke key endpoint (DELETE /api/keys/:id)
- [ ] Key generation: `rlk_` prefix + 32 bytes random, SHA-256 hash storage
- [ ] Show key exactly once on creation with copy button
- [ ] Key management UI on profile page

**Per-Employee Tracking (#1) -- Build Second:**
- [ ] API key resolution middleware (hash incoming key, look up userId)
- [ ] Pass userId to trackUsage() in all tool handlers
- [ ] Accept API key via `RELAY_API_KEY` environment variable in stdio MCP
- [ ] Backward compatible: anonymous tracking when no key provided
- [ ] Update install scripts to include `RELAY_API_KEY` env var placeholder

**Extended Search (#6) -- Build in Parallel:**
- [ ] Update MCP search_skills to use database full-text search (match web app)
- [ ] Include author name and tags in MCP search results
- [ ] Update searchVector to include tags as weight C
- [ ] Schema migration for searchVector column

**Per-Employee Dashboard (#4) -- Build Third:**
- [ ] Personal usage stats on profile page (skills used, FTE days saved)
- [ ] Personal usage trend sparkline (reuse existing pattern)
- [ ] Top skills used table
- [ ] Usage frequency per skill

**Install Analytics (#3) -- Build in Parallel:**
- [ ] `install_events` table
- [ ] Install token generation on script download
- [ ] Phone-home callback in install scripts (curl/Invoke-WebRequest)
- [ ] POST /api/install-callback endpoint
- [ ] Install metrics on admin dashboard

### Defer to Next Milestone

**Web Remote MCP (#5):**
- [ ] OAuth 2.1 server implementation
- [ ] Streamable HTTP transport endpoint
- [ ] Claude.ai connector registration
- [ ] HTTPS deployment infrastructure

**Rationale for deferring remote MCP:** It is the highest complexity feature, requires OAuth server implementation, HTTPS infrastructure, and is only usable by Claude.ai paid plan users. The API key + stdio approach covers Claude Code and Claude Desktop (the primary use cases for 500+ employee rollout). Remote MCP can be added after the identity/analytics foundation is solid.

### Future Consideration

- [ ] Department-level analytics (requires org hierarchy)
- [ ] API key scoping (read vs deploy permissions)
- [ ] Key rotation with grace period
- [ ] Weekly impact digest emails
- [ ] Skill adoption funnel (viewed -> installed -> used)
- [ ] MCP prompts and resources (not just tools)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| API key generation & management | HIGH (enables everything) | LOW | LOW | P0 |
| userId in usage_events via API key | HIGH (core requirement) | LOW | LOW | P0 |
| MCP search parity (author + tags) | MEDIUM | LOW | LOW | P1 |
| Personal usage dashboard | HIGH (employee value) | MEDIUM | LOW | P1 |
| Install callback analytics | MEDIUM | MEDIUM | LOW | P1 |
| Install funnel dashboard | MEDIUM | LOW | LOW | P2 |
| Team-level usage aggregates | MEDIUM | MEDIUM | MEDIUM | P2 |
| Web remote MCP + OAuth | HIGH (Claude.ai access) | HIGH | HIGH | P2 (defer) |
| API key scoping | LOW | MEDIUM | LOW | P3 |
| Key rotation with grace period | LOW | MEDIUM | LOW | P3 |
| Department analytics | MEDIUM | HIGH | MEDIUM | P3 |

---

## Implementation Considerations

### API Key for Stdio MCP -- Config Integration

The install scripts currently generate config like:
```json
{
  "mcpServers": {
    "relay-skills": {
      "command": "npx",
      "args": ["-y", "@relay/mcp"]
    }
  }
}
```

With API key auth, this becomes:
```json
{
  "mcpServers": {
    "relay-skills": {
      "command": "npx",
      "args": ["-y", "@relay/mcp"],
      "env": {
        "RELAY_API_KEY": "rlk_YOUR_KEY_HERE"
      }
    }
  }
}
```

This is the standard MCP pattern used by GitHub (`GITHUB_PERSONAL_ACCESS_TOKEN`), Notion (`NOTION_API_KEY`), Brave Search (`BRAVE_API_KEY`), etc.

### API Key Validation in MCP Server

```typescript
// In MCP server startup (apps/mcp/src/index.ts)
const apiKey = process.env.RELAY_API_KEY;
let currentUserId: string | undefined;

if (apiKey) {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });
  if (keyRecord && !keyRecord.revokedAt) {
    currentUserId = keyRecord.userId;
    // Update lastUsedAt
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id));
  }
}

// Pass to trackUsage in tool handlers
await trackUsage({
  toolName: "search_skills",
  userId: currentUserId,
  metadata: { ... },
});
```

### Remote MCP OAuth Flow (When Built)

The MCP SDK v1.25.3 provides the complete OAuth framework:

1. **Express app:** `createMcpExpressApp({ host: '0.0.0.0' })` for remote binding
2. **Bearer auth:** `requireBearerAuth({ verifier })` middleware
3. **Transport:** `StreamableHTTPServerTransport` for /mcp endpoint
4. **AuthInfo:** `req.auth?.extra?.userId` flows to tool handlers

The OAuth server would delegate to Google Workspace SSO (same IdP as web app):
```
Claude.ai -> POST /mcp -> requireBearerAuth -> resolve userId -> tool handler -> trackUsage(userId)
```

### Install Callback Script Modification

Bash (macOS/Linux) -- add at end of existing script:
```bash
# Phone home (non-blocking, failure OK)
curl -s -X POST "https://relay.company.com/api/install-callback" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"INSTALL_TOKEN\",\"platform\":\"$(uname -s)\",\"status\":\"installed\"}" \
  > /dev/null 2>&1 || true
```

PowerShell (Windows) -- add at end:
```powershell
# Phone home (non-blocking, failure OK)
try {
  Invoke-WebRequest -Uri "https://relay.company.com/api/install-callback" `
    -Method POST -ContentType "application/json" `
    -Body '{"token":"INSTALL_TOKEN","platform":"windows","status":"installed"}' `
    -UseBasicParsing | Out-Null
} catch {}
```

---

## Competitor/Domain Analysis

| Capability | GitHub (PATs) | Notion (API Keys) | Slack (Bot Tokens) | Relay Approach |
|-----------|---------------|--------------------|--------------------|----------------|
| Auth for CLI/local tools | Personal Access Tokens (PAT) | Integration API keys | Bot tokens + OAuth | API keys (rlk_ prefix) |
| Key storage | Hashed | Hashed | Encrypted | SHA-256 hashed |
| Key scoping | Fine-grained (repo, read, write) | Workspace-level | Bot scopes | User-level (scope later) |
| Usage analytics | Audit log (Enterprise) | Analytics API | Usage stats | Per-employee dashboard |
| Install tracking | GitHub CLI telemetry (opt-in) | N/A | App install events | Phone-home callback |
| Remote access | github.com API | Notion API | Slack API | Remote MCP (streamable HTTP) |

---

## Sources

### MCP Protocol & SDK (HIGH confidence)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization) -- Official spec; "STDIO transport SHOULD NOT follow this specification, and instead retrieve credentials from the environment"
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- Streamable HTTP transport spec
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- Official SDK; v1.25.3 has StreamableHTTPServerTransport, auth middleware
- Installed SDK type definitions at `@modelcontextprotocol/sdk` v1.25.3 -- Verified AuthInfo, OAuthServerProvider, requireBearerAuth interfaces

### Claude.ai Remote MCP (HIGH confidence)
- [Building Custom Connectors via Remote MCP Servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) -- Official Claude help; OAuth requirement, callback URL, DCR support
- [Getting Started with Custom Connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) -- Setup steps for Team/Enterprise

### MCP Auth Patterns (MEDIUM confidence)
- [Auth0: MCP Streamable HTTP Security](https://auth0.com/blog/mcp-streamable-http/) -- Why streamable HTTP improves auth
- [Auth0: MCP Specs Update June 2025](https://auth0.com/blog/mcp-specs-update-all-about-auth/) -- Resource Indicators, token scoping
- [Stytch: MCP Auth Implementation Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/) -- Enterprise auth patterns
- [Scalekit: Migrating API Keys to OAuth](https://www.scalekit.com/blog/migrating-from-api-keys-to-oauth-mcp-servers/) -- Client Credentials grant for M2M

### API Key Best Practices (MEDIUM confidence)
- [MultitaskAI: API Key Management Best Practices 2025](https://multitaskai.com/blog/api-key-management-best-practices/) -- Hashing, rotation, 32+ character keys
- [DEV.to: API Keys Complete Guide 2025](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980) -- Prefix patterns, storage
- [GitGuardian: API Key Rotation Best Practices](https://blog.gitguardian.com/api-key-rotation-best-practices/) -- 90-day rotation, grace periods

### Analytics & Tracking (MEDIUM confidence)
- [BetterCLI.org: Collecting CLI Analytics](https://bettercli.org/design/collecting-analytics/) -- Facade endpoint pattern, opt-in/opt-out
- [Worklytics: Privacy-Compliant AI Adoption Dashboard](https://www.worklytics.co/resources/privacy-compliant-dashboard-employee-ai-adoption-2025) -- Three-layer dashboard architecture, privacy-first design
- [Hubstaff: Employee Performance Dashboards](https://hubstaff.com/blog/employee-performance-dashboard/) -- Role-based views, aggregate vs individual

### Existing Codebase (HIGH confidence)
- `/home/dev/projects/relay/packages/db/src/schema/usage-events.ts` -- userId column exists, always NULL
- `/home/dev/projects/relay/apps/mcp/src/tracking/events.ts` -- trackUsage accepts userId optionally
- `/home/dev/projects/relay/apps/web/lib/search-skills.ts` -- Web search already matches author + tags
- `/home/dev/projects/relay/apps/mcp/src/tools/search.ts` -- MCP search only matches name + description
- `/home/dev/projects/relay/apps/mcp/src/index.ts` -- StdioServerTransport, no auth
- `/home/dev/projects/relay/apps/web/auth.ts` -- Google Workspace SSO, JWT strategy
- `/home/dev/projects/relay/apps/web/lib/install-script.ts` -- Install scripts, no callback

---

*Feature research for: Relay employee analytics, MCP authentication, install tracking, remote MCP*
*Researched: 2026-02-05*
*Confidence: HIGH for auth/analytics patterns (well-established domain), MEDIUM for remote MCP (SDK verified, OAuth complexity uncertain)*
