# Phase 22: Web Remote MCP - Research

**Researched:** 2026-02-05
**Domain:** MCP Streamable HTTP transport, Next.js API routes, bearer token auth, CORS
**Confidence:** HIGH

## Summary

Phase 22 adds an HTTP entry point to Relay's existing MCP tools (list, search, deploy) so Claude.ai browser users can access them. The existing tool handlers in `apps/mcp/src/tools/` are already factored into standalone functions (`handleListSkills`, `handleSearchSkills`, `handleDeploySkill`) separate from `server.registerTool()` calls, making them reusable from an HTTP route.

The standard approach is `mcp-handler` (Vercel's MCP adapter, v1.0.7) which handles Streamable HTTP transport inside a Next.js dynamic route at `app/api/mcp/[transport]/route.ts`. It provides `createMcpHandler` for tool registration and `withMcpAuth` for bearer token verification. The existing `@modelcontextprotocol/sdk` (already at ^1.25.0 in the project) is a peer dependency. Authentication uses the existing `validateApiKey()` service from `@everyskill/db` inside a custom `withMcpAuth` verification callback.

The critical architectural insight is that the existing tool handlers import auth state from a module-level cache (`apps/mcp/src/auth.ts`) designed for long-lived stdio processes. For HTTP, auth is per-request via bearer token. The handlers must be adapted to accept a `userId` parameter rather than calling `getUserId()` from the cached auth module.

**Primary recommendation:** Use `mcp-handler ^1.0.7` with `withMcpAuth` for bearer token validation, re-register the existing handler functions as tools in the `createMcpHandler` callback, and pass `userId` from `extra.authInfo` into each handler.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mcp-handler | ^1.0.7 | MCP Streamable HTTP adapter for Next.js | Vercel's official adapter; handles transport detection, session management, and `[transport]` dynamic routing. Already decided in STATE.md |
| @modelcontextprotocol/sdk | ^1.25.2 | MCP protocol implementation | Already in project at ^1.25.0. Must use >=1.25.1 due to security vulnerability in earlier versions |
| zod | ^3.25.0 | Input schema validation | Already in project; required by both mcp-handler and tool definitions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @everyskill/db (workspace) | workspace:* | API key validation, usage tracking | Bearer token validation via `validateApiKey()`, usage event recording |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mcp-handler | Raw @modelcontextprotocol/sdk StreamableHTTPServerTransport | More control but must hand-roll transport detection, session management, CORS. mcp-handler is decided. |
| In-memory rate limiter | @upstash/ratelimit with Redis | Redis-backed is production-grade but adds infrastructure dependency. In-memory is fine for single-process deployment. |

**Installation:**
```bash
cd apps/web && npm install mcp-handler@^1.0.7
```

Note: `@modelcontextprotocol/sdk` is already a dependency of `apps/mcp`. It will also need to be added to `apps/web/package.json` as a peer/direct dependency since `mcp-handler` requires it. Update the existing `^1.25.0` constraint to `^1.25.2` in `apps/mcp/package.json` to patch the security vulnerability.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/app/api/mcp/
  [transport]/
    route.ts           # createMcpHandler + withMcpAuth + tool registrations

apps/mcp/src/tools/
  list.ts              # handleListSkills (existing, needs userId param)
  search.ts            # handleSearchSkills (existing, needs userId param)
  deploy.ts            # handleDeploySkill (existing, needs userId param)

apps/web/app/
  (authenticated)/
    settings/
      mcp-connect/     # "Connect to Claude.ai" UI page (or section in settings)
```

### Pattern 1: createMcpHandler with withMcpAuth

**What:** Register tools inside `createMcpHandler` callback, wrap with `withMcpAuth` for bearer token verification.
**When to use:** Every request to the MCP HTTP endpoint.

```typescript
// apps/web/app/api/mcp/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { handleListSkills } from "@everyskill/mcp/tools/list"; // shared handler
import { handleSearchSkills } from "@everyskill/mcp/tools/search";
import { handleDeploySkill } from "@everyskill/mcp/tools/deploy";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "list_skills",
      "List available skills in the Relay marketplace.",
      {
        category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
        limit: z.number().min(1).max(50).default(20),
      },
      async ({ category, limit }, extra) => {
        const userId = (extra.authInfo?.extra as any)?.userId as string;
        return handleListSkills({ category, limit, userId });
      }
    );
    // ... register search_skills, deploy_skill, server_info similarly
  },
  {},
  { basePath: "/api/mcp", maxDuration: 60 }
);

const authHandler = withMcpAuth(
  handler,
  async (_req: Request, bearerToken?: string) => {
    if (!bearerToken) return undefined;
    const result = await validateApiKey(bearerToken);
    if (!result) return undefined;
    return {
      token: bearerToken,
      clientId: result.keyId,
      scopes: [],
      extra: { userId: result.userId },
    };
  },
  { required: true }
);

export { authHandler as GET, authHandler as POST };
```

### Pattern 2: Shared Tool Handlers with userId Injection

**What:** Refactor existing tool handlers to accept `userId` as a parameter instead of reading from module-level cache.
**When to use:** Any tool handler that needs to work across both stdio and HTTP transports.

```typescript
// Current signature (stdio only):
export async function handleListSkills({ category, limit }: { ... }) {
  const userId = getUserId(); // reads from module-level cache
  // ...
}

// Refactored signature (both transports):
export async function handleListSkills({ category, limit, userId }: { ...; userId?: string }) {
  // userId passed in directly; no dependency on auth module cache
  await trackUsage({ toolName: "list_skills", userId, metadata: { ... } });
  // ...
}
```

The stdio entry point (`apps/mcp/src/tools/list.ts` `server.registerTool` call) passes `getUserId()` as the `userId` parameter. The HTTP entry point passes `extra.authInfo.extra.userId`.

### Pattern 3: CORS Headers for Claude.ai

**What:** Set CORS headers allowing Claude.ai to make cross-origin requests to the MCP endpoint.
**When to use:** All responses from `/api/mcp/*`.

Required CORS headers:
```
Access-Control-Allow-Origin: https://claude.ai
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Mcp-Session-Id
Access-Control-Expose-Headers: Mcp-Session-Id
Access-Control-Max-Age: 86400
```

Note: `mcp-handler` may handle some CORS internally. If not, add CORS handling in the route or via Next.js middleware. The `Mcp-Session-Id` header is protocol-critical and must be exposed to browser clients.

The exact Claude.ai origin needs empirical testing. Start with `https://claude.ai` and also allow `https://claude.com` (Anthropic docs indicate the domain may migrate). Consider allowing both during the transition period.

### Pattern 4: Rate Limiting (In-Memory)

**What:** Simple sliding-window rate limiter per API key.
**When to use:** Before processing any MCP request.

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(keyId: string, maxPerMinute = 60): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}
```

Rate limit should be checked after auth (so we have the keyId) but before tool execution. Return HTTP 429 with `Retry-After` header when exceeded.

### Pattern 5: Middleware Exemption

**What:** Exempt `/api/mcp` routes from Next.js auth middleware.
**When to use:** The MCP endpoint uses bearer tokens, not session cookies.

```typescript
// apps/web/middleware.ts
const isMcpApi = req.nextUrl.pathname.startsWith("/api/mcp");

if (isAuthApi || isDevLogin || isInstallCallback || isMcpApi) {
  return; // skip session auth
}
```

### Anti-Patterns to Avoid

- **Sharing McpServer instance between stdio and HTTP:** `mcp-handler` creates its own server; don't try to reuse the stdio server instance. Share the handler *functions* instead.
- **Reading auth from module-level cache in HTTP context:** The `apps/mcp/src/auth.ts` module caches userId for the stdio process lifetime. HTTP requests have per-request auth. Pass userId explicitly.
- **Using `*` for CORS origin:** Security risk. Always allowlist specific origins.
- **Blocking on rate limit cleanup:** Use lazy cleanup (check on access) rather than setInterval timers that can leak.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP Streamable HTTP transport | Custom HTTP-to-MCP adapter | mcp-handler | Handles transport detection, session management, protocol compliance |
| MCP JSON-RPC protocol | Custom JSON-RPC parser | @modelcontextprotocol/sdk | Protocol is complex with notifications, error codes, capabilities negotiation |
| API key validation | Custom hash-and-compare | Existing `validateApiKey()` from `@everyskill/db` | Already handles SHA-256 hashing, timing-safe comparison, expiry, revocation |
| Usage tracking | Custom event logging | Existing `trackUsage()` from `apps/mcp/src/tracking/events.ts` | Already handles DB insertion and skill metrics increment |
| Bearer token extraction | Custom header parsing | `withMcpAuth` from mcp-handler | Handles Authorization header parsing, passes token to verification callback |

**Key insight:** This phase is a transport layer addition. The tool logic, auth validation, and usage tracking all exist. The only new code is the HTTP route handler, tool re-registration, CORS config, rate limiting, a server info tool, and the "Connect to Claude.ai" UI button.

## Common Pitfalls

### Pitfall 1: Module-Level Auth State in HTTP Context
**What goes wrong:** Tool handlers call `getUserId()` from the stdio auth module, which returns the cached userId from process startup (or null). In HTTP, every request has a different user.
**Why it happens:** The auth module was designed for long-lived stdio processes where one API key = one process.
**How to avoid:** Pass `userId` as a parameter to all handler functions. The stdio registration passes `getUserId()`, the HTTP registration passes `extra.authInfo.extra.userId`.
**Warning signs:** All HTTP requests showing the same userId or null userId in tracking events.

### Pitfall 2: Anonymous Nudge Logic in HTTP
**What goes wrong:** The anonymous nudge counter (`incrementAnonymousCount`, `shouldNudge`) is meaningless in HTTP because auth is required. The counter would accumulate across different users' requests.
**Why it happens:** The nudge logic was designed for stdio where anonymous usage is possible.
**How to avoid:** Skip the nudge logic entirely for HTTP requests. HTTP requires bearer token auth, so anonymous access is not possible. This is a discretion area from CONTEXT.md -- recommendation is to skip the nudge for HTTP.
**Warning signs:** HTTP responses containing "Tip: Set EVERYSKILL_API_KEY to track your usage" messages.

### Pitfall 3: CORS Preflight (OPTIONS) Not Handled
**What goes wrong:** Browser sends OPTIONS preflight request, server returns 405 or redirect, Claude.ai cannot connect.
**Why it happens:** Next.js middleware may intercept OPTIONS requests and redirect to login. `mcp-handler` may not handle OPTIONS.
**How to avoid:** Ensure middleware exempts `/api/mcp` paths. If `mcp-handler` doesn't handle OPTIONS, export an OPTIONS handler in the route file that returns proper CORS headers.
**Warning signs:** Claude.ai shows "connection failed" with no request reaching the handler.

### Pitfall 4: Deploy Response Contains File System Instructions
**What goes wrong:** `handleDeploySkill` returns instructions like "Save this skill to your project's .claude/skills/ directory" which makes no sense in a browser context.
**Why it happens:** Deploy handler was written for Claude Code (local file system).
**How to avoid:** The HTTP variant of deploy should return the content with a browser-appropriate message like "This skill is now available in this conversation."
**Warning signs:** Claude.ai showing confusing file system instructions to browser users.

### Pitfall 5: Security Vulnerability in SDK < 1.25.1
**What goes wrong:** Using `@modelcontextprotocol/sdk` versions prior to 1.25.1 exposes the server to a known security vulnerability.
**Why it happens:** mcp-handler README explicitly warns about this.
**How to avoid:** Pin `@modelcontextprotocol/sdk@^1.25.2` in both `apps/web` and `apps/mcp` package.json.
**Warning signs:** npm audit warnings during install.

### Pitfall 6: Missing Mcp-Session-Id in Exposed Headers
**What goes wrong:** Browser cannot read the `Mcp-Session-Id` response header due to CORS restrictions, breaking protocol compliance.
**Why it happens:** By default, browsers can only read "simple" response headers. `Mcp-Session-Id` is a custom header.
**How to avoid:** Include `Mcp-Session-Id` in `Access-Control-Expose-Headers`.
**Warning signs:** Stateful sessions not working from browser clients.

## Code Examples

### Complete Route Handler (verified pattern from mcp-handler docs)

```typescript
// apps/web/app/api/mcp/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { validateApiKey } from "@everyskill/db/services/api-keys";

const handler = createMcpHandler(
  (server) => {
    // Register all tools here - using server.tool() API
    server.tool(
      "list_skills",
      "List available skills in the Relay marketplace.",
      {
        category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional()
          .describe("Filter by skill category"),
        limit: z.number().min(1).max(50).default(20)
          .describe("Maximum number of results"),
      },
      async ({ category, limit }, extra) => {
        const userId = (extra.authInfo?.extra as Record<string, unknown>)?.userId as string;
        // Call shared handler with injected userId
        return handleListSkills({ category, limit, userId });
      }
    );

    server.tool(
      "server_info",
      "Get Relay server information, connected user details, and available categories.",
      {},
      async (_params, extra) => {
        const userId = (extra.authInfo?.extra as Record<string, unknown>)?.userId as string;
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              name: "Relay Skills",
              version: "1.0.0",
              categories: ["prompt", "workflow", "agent", "mcp"],
              user: { id: userId },
            }, null, 2)
          }]
        };
      }
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
    verboseLogs: false,
  }
);

// Bearer token verification using existing validateApiKey
const authHandler = withMcpAuth(
  handler,
  async (_req: Request, bearerToken?: string) => {
    if (!bearerToken) return undefined;
    const result = await validateApiKey(bearerToken);
    if (!result) return undefined;
    return {
      token: bearerToken,
      clientId: result.keyId,
      scopes: [],
      extra: { userId: result.userId },
    };
  },
  { required: true }
);

export { authHandler as GET, authHandler as POST };
```

### Middleware Exemption

```typescript
// apps/web/middleware.ts - add to existing exemptions
const isMcpApi = req.nextUrl.pathname.startsWith("/api/mcp");

if (isAuthApi || isDevLogin || isInstallCallback || isMcpApi) {
  return;
}
```

### CORS OPTIONS Handler (if mcp-handler doesn't handle it)

```typescript
// apps/web/app/api/mcp/[transport]/route.ts - add if needed
const ALLOWED_ORIGINS = ["https://claude.ai", "https://claude.com"];

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
```

### Deploy Handler Adaptation for HTTP

```typescript
// HTTP-specific deploy response (no file system instructions)
const httpDeployResult = {
  content: [{
    type: "text" as const,
    text: JSON.stringify({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        content: skill.content,
        hoursSaved: skill.hoursSaved,
      },
      message: "This skill is now available in this conversation. You can use it directly.",
    }, null, 2)
  }]
};
```

### Connect to Claude.ai Config URL

```typescript
// The URL format Claude.ai expects for MCP server configuration
// Users add this in Claude.ai Settings > Connectors
const mcpServerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/mcp`;
// Bearer token is the user's API key (rlk_...)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP+SSE transport | Streamable HTTP | MCP spec 2025-03-26 | SSE deprecated; Streamable HTTP is the standard |
| @vercel/mcp-adapter | mcp-handler | v1.0.0 (July 2024) | Package renamed; same functionality |
| server.tool() | server.registerTool() | SDK recent versions | registerTool is recommended for new code |
| Session-required | Stateless option | SDK v1.10.1 | sessionIdGenerator: undefined for stateless mode |

**Deprecated/outdated:**
- **HTTP+SSE transport:** Claude support may be deprecated soon. Use Streamable HTTP.
- **@vercel/mcp-adapter:** Package renamed to `mcp-handler`. Do not use the old name.
- **@modelcontextprotocol/sdk < 1.25.1:** Known security vulnerability. Use >= 1.25.2.

## Open Questions

1. **Exact Claude.ai CORS origin**
   - What we know: Claude.ai uses `https://claude.ai` currently. Anthropic docs mention possible migration to `https://claude.com`.
   - What's unclear: The exact origin header Claude.ai sends in cross-origin MCP requests.
   - Recommendation: Allow both `https://claude.ai` and `https://claude.com`. Verify empirically after deployment.

2. **Whether mcp-handler handles CORS automatically**
   - What we know: mcp-handler has `metadataCorsOptionsRequestHandler` for OAuth metadata. Unclear if it handles CORS for the main transport endpoint.
   - What's unclear: Whether the `[transport]` route handler automatically adds CORS headers.
   - Recommendation: Test empirically. If not automatic, add explicit OPTIONS handler and CORS headers in the route.

3. **How Claude.ai connects to authenticated (non-OAuth) MCP servers**
   - What we know: Claude.ai Settings > Connectors supports "authless" and "OAuth-based" servers. Bearer token auth (without full OAuth) is unclear.
   - What's unclear: Whether Claude.ai can send a static bearer token (like our `rlk_` keys) without OAuth flow.
   - Recommendation: Build the bearer token auth. If Claude.ai requires OAuth, the `withMcpAuth` wrapper already supports it and we can add OAuth later. The bearer approach still works for Claude Code and other MCP clients.

4. **Import path for shared tool handlers**
   - What we know: Handler functions are in `apps/mcp/src/tools/`. The web app needs to import them.
   - What's unclear: Whether cross-app imports work in this monorepo setup, or if handlers should be extracted to a shared package.
   - Recommendation: Since `apps/web` already imports from `@everyskill/db`, the simplest approach is to either: (a) import directly from `@everyskill/mcp` if the package exports them, or (b) extract the handler functions into a shared location (e.g., `packages/mcp-tools/`). Option (a) is preferred if the monorepo resolution supports it.

## Sources

### Primary (HIGH confidence)
- [vercel/mcp-handler GitHub](https://github.com/vercel/mcp-handler) - README, API docs, route patterns
- [mcphandler.org/docs](https://mcphandler.org/docs) - createMcpHandler API, withMcpAuth, authInfo access
- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) - SDK docs, StreamableHTTPServerTransport, stateless mode
- [MCP Transport Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) - Streamable HTTP protocol spec
- Existing codebase: `apps/mcp/src/` (tool handlers, auth, tracking)

### Secondary (MEDIUM confidence)
- [Claude Help Center - Remote MCP Servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) - Claude.ai connector setup, OAuth callbacks
- [MCPcat CORS Guide](https://mcpcat.io/guides/implementing-cors-policies-web-based-mcp-servers/) - CORS headers for MCP servers
- [Clerk MCP + Next.js](https://clerk.com/docs/nextjs/guides/development/mcp/build-mcp-server) - withMcpAuth bearer token verification pattern

### Tertiary (LOW confidence)
- Claude.ai CORS origin specifics (needs empirical testing)
- Whether Claude.ai supports static bearer tokens without OAuth flow (needs testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mcp-handler is decided, SDK is already in use, versions verified
- Architecture: HIGH - Route handler pattern well-documented, tool handler refactoring path clear from codebase analysis
- Pitfalls: HIGH - Auth state management, CORS, deploy response all identified from code inspection
- CORS specifics: LOW - Exact Claude.ai origins need empirical testing
- Claude.ai bearer auth: MEDIUM - OAuth is documented, static bearer less clear

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days; mcp-handler and MCP spec are actively evolving)
